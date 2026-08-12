import childProcess from "child_process"
import crypto from "crypto"
import fs from "fs"
import https from "https"
import net from "net"
import path from "path"
import { getAdbPath } from "./adb-path"

const VERSION = "2.4"
const DEVICE_JAR = "/data/local/tmp/reactotron-scrcpy-server.jar"
const HEADER_BYTES = 65
const FRAME_HEADER_BYTES = 12

export type AndroidVideoFrame = {
  config: boolean
  keyFrame: boolean
  pts: string
  data: ArrayBuffer
}

type Callbacks = {
  onMeta: (meta: { width: number; height: number }) => void
  onFrame: (frame: AndroidVideoFrame) => void
  onError: (message: string) => void
  onClose: () => void
}

export type AndroidScrcpyStream = { close: () => void }

function runAdb(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const process = childProcess.spawn(getAdbPath(), args, { shell: false })
    let output = ""
    let errorOutput = ""
    process.stdout.on("data", (chunk) => (output += chunk))
    process.stderr.on("data", (chunk) => (errorOutput += chunk))
    process.on("error", reject)
    process.on("close", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(errorOutput || output || `adb exited with ${code}.`))
    )
  })
}

/**
 * Locations the scrcpy server is shipped to, in a packaged app and when run
 * from the repository.
 */
function bundledServerJarPaths() {
  const fileName = `scrcpy-server-v${VERSION}`
  // electron-webpack exposes the static directory as __static while running
  // from source; a packaged build carries the same files under resourcesPath.
  const staticDirectory = (global as unknown as { __static?: string }).__static
  return [
    path.join(process.resourcesPath ?? "", "scrcpy", fileName),
    ...(staticDirectory ? [path.join(staticDirectory, "scrcpy", fileName)] : []),
    path.join(__dirname, "..", "..", "static", "scrcpy", fileName),
  ]
}

async function serverJar(directory: string) {
  const filePath = path.join(directory, `scrcpy-server-v${VERSION}`)
  if (fs.existsSync(filePath)) return filePath

  // Downloading needs a trusted certificate chain, and an app opened from the
  // Dock does not inherit the CA configuration a shell provides. That failure
  // leaves the Android preview permanently black, so prefer the copy shipped
  // with the app and treat the download as a fallback for other versions.
  const bundled = bundledServerJarPaths().find((candidate) => fs.existsSync(candidate))
  if (bundled) {
    await fs.promises.mkdir(directory, { recursive: true })
    await fs.promises.copyFile(bundled, filePath)
    return filePath
  }

  await fs.promises.mkdir(directory, { recursive: true })
  const temporaryPath = `${filePath}.tmp`
  await fs.promises.rm(temporaryPath, { force: true })
  const download = (url: string, redirects = 0): Promise<void> =>
    new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          const redirect = response.headers.location
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            redirect
          ) {
            response.resume()
            if (redirects >= 5) {
              reject(new Error("Too many redirects downloading scrcpy server."))
              return
            }
            download(new URL(redirect, url).toString(), redirects + 1).then(resolve, reject)
            return
          }
          if (response.statusCode !== 200) {
            response.resume()
            reject(new Error(`Could not download scrcpy server (${response.statusCode}).`))
            return
          }
          const output = fs.createWriteStream(temporaryPath)
          response.pipe(output)
          output.on("finish", () => output.close(() => resolve()))
          output.on("error", reject)
        })
        .on("error", reject)
    })
  await download(
    `https://github.com/Genymobile/scrcpy/releases/download/v${VERSION}/scrcpy-server-v${VERSION}`
  )
  await fs.promises.rename(temporaryPath, filePath)
  return filePath
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

export async function startAndroidScrcpyStream(
  serial: string,
  directory: string,
  callbacks: Callbacks
): Promise<AndroidScrcpyStream> {
  const jar = await serverJar(directory)
  const scid = (crypto.randomBytes(4).readUInt32BE(0) & 0x7fffffff).toString(16).padStart(8, "0")
  await runAdb(["-s", serial, "push", jar, DEVICE_JAR])
  const port = Number(
    (await runAdb(["-s", serial, "forward", "tcp:0", `localabstract:scrcpy_${scid}`])).trim()
  )
  if (!Number.isInteger(port) || port <= 0) throw new Error("adb did not allocate a scrcpy port.")

  const server = childProcess.spawn(
    getAdbPath(),
    [
      "-s",
      serial,
      "shell",
      `CLASSPATH=${DEVICE_JAR}`,
      "app_process",
      "/",
      "com.genymobile.scrcpy.Server",
      VERSION,
      `scid=${scid}`,
      "tunnel_forward=true",
      "log_level=info",
      "audio=false",
      "control=true",
      "cleanup=true",
      "clipboard_autosync=false",
      "video_codec=h264",
      "max_size=1080",
      "max_fps=30",
      "video_bit_rate=8000000",
    ],
    { shell: false }
  )
  let pending = Buffer.alloc(0)
  let headerRead = false
  let metadataRead = false
  let closed = false
  let socket: net.Socket | null = null
  let controlSocket: net.Socket | null = null
  let serverLog = ""
  const close = () => {
    if (closed) return
    closed = true
    socket?.destroy()
    controlSocket?.destroy()
    server.kill()
    runAdb(["-s", serial, "forward", "--remove", `tcp:${port}`]).catch(() => undefined)
    callbacks.onClose()
  }
  const fail = (message: string) => {
    if (closed) return
    callbacks.onError(message)
    close()
  }
  const handleData = (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk])
    if (!headerRead) {
      if (pending.length < HEADER_BYTES) return
      pending = pending.subarray(HEADER_BYTES)
      headerRead = true
    }
    if (!metadataRead) {
      if (pending.length < 12) return
      callbacks.onMeta({ width: pending.readUInt32BE(4), height: pending.readUInt32BE(8) })
      pending = pending.subarray(12)
      metadataRead = true
    }
    while (pending.length >= FRAME_HEADER_BYTES) {
      const frameFlags = pending[0]
      const size = pending.readUInt32BE(8)
      if (size > 16 * 1024 * 1024) {
        fail("Invalid scrcpy video frame.")
        return
      }
      if (pending.length < FRAME_HEADER_BYTES + size) return
      const data = Buffer.from(pending.subarray(FRAME_HEADER_BYTES, FRAME_HEADER_BYTES + size))
      pending = pending.subarray(FRAME_HEADER_BYTES + size)
      callbacks.onFrame({
        // scrcpy stores config/key-frame flags in the two high bits of the
        // first byte of its unsigned 64-bit PTS field. Avoid BigInt here:
        // this app still targets ES5.
        config: (frameFlags & 0x80) !== 0,
        keyFrame: (frameFlags & 0x40) !== 0,
        pts: "0",
        data: toArrayBuffer(data),
      })
    }
  }
  const openVideoSocket = (attempt: number) => {
    if (closed) return
    const candidate = net.connect(port, "127.0.0.1")
    let connected = false
    let settled = false
    const retry = () => {
      if (settled || closed) return
      settled = true
      candidate.destroy()
      if (attempt >= 100) {
        fail("scrcpy video stream did not start.")
        return
      }
      setTimeout(() => openVideoSocket(attempt + 1), 100)
    }
    candidate.once("data", (chunk: Buffer) => {
      if (settled || closed) return
      settled = true
      connected = true
      candidate.setTimeout(0)
      socket = candidate
      candidate.on("data", handleData)
      candidate.on("error", (error) => fail(error.message))
      candidate.on("close", () => {
        if (!closed) fail("scrcpy video stream closed.")
      })
      handleData(chunk)
      controlSocket = net.connect(port, "127.0.0.1")
      controlSocket.on("error", () => undefined)
    })
    candidate.once("error", retry)
    candidate.once("close", () => {
      if (!connected) retry()
    })
    candidate.setTimeout(2000, retry)
  }
  server.stdout?.on("data", (chunk: Buffer) => (serverLog += chunk.toString()))
  server.stderr?.on("data", (chunk: Buffer) => (serverLog += chunk.toString()))
  server.on("error", (error) => fail(error.message))
  server.on("exit", () => {
    if (!closed && !metadataRead) fail(serverLog.trim() || "scrcpy server exited before streaming.")
  })
  openVideoSocket(0)
  return { close }
}
