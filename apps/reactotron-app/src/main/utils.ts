import childProcess from "child_process"
import fs from "fs"
import http from "http"
import https from "https"
import net from "net"
import path from "path"
import { startAndroidScrcpyStream, type AndroidScrcpyStream } from "./android-scrcpy"
import {
  app,
  type BrowserWindow,
  BrowserWindow as ElectronBrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  type WebContents,
} from "electron"

type IOSSimulator = {
  name: string
  state: string
  udid: string
  runtime: string
}

type IOSSimulatorCreationOption = {
  deviceTypeIdentifier: string
  name: string
  runtimeIdentifier: string
  runtimeName: string
}

type AndroidDevice = {
  id: string
  model: string
  type: "emulator" | "physical"
}

const serveSimProcesses = new Map<
  string,
  { process: childProcess.ChildProcess; previewUrl: string }
>()
const simulatorRecordings = new Map<
  string,
  { filePath: string; process: childProcess.ChildProcess }
>()
const androidRecordings = new Map<
  string,
  { remotePath: string; process: childProcess.ChildProcess }
>()
const iosSimulatorUdid = /^[A-Fa-f0-9-]{36}$/
const androidVideoStreams = new Map<string, AndroidScrcpyStream>()

function runCommand(
  command: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = childProcess.spawn(command, args, { shell: false, env: options?.env })
    let output = ""
    let errorOutput = ""

    process.stdout.on("data", (data) => {
      output += data.toString()
    })
    process.stderr.on("data", (data) => {
      errorOutput += data.toString()
    })
    process.on("error", reject)
    process.on("close", (code) => {
      if (code === 0) {
        resolve(output)
        return
      }

      reject(new Error(errorOutput || output || `${command} exited with code ${code}.`))
    })
  })
}

function assertAndroidDeviceId(deviceId: unknown): asserts deviceId is string {
  if (typeof deviceId !== "string" || !/^[A-Za-z0-9._:-]+$/.test(deviceId)) {
    throw new Error("Invalid Android device identifier.")
  }
}

async function getAndroidDevices(): Promise<AndroidDevice[]> {
  const output = await runCommand("adb", ["devices", "-l"])
  return output
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, state, ...details] = line.split(/\s+/)
      const model = details
        .find((detail) => detail.startsWith("model:"))
        ?.replace("model:", "")
        .replace(/_/g, " ")
      return { id, state, model: model || id }
    })
    .filter((device) => device.state === "device")
    .map(({ id, model }) => ({
      id,
      model,
      type: id.startsWith("emulator-") ? "emulator" : "physical",
    }))
}

async function captureAndroidDeviceScreenshotPng(deviceId: string): Promise<Buffer> {
  assertAndroidDeviceId(deviceId)
  return new Promise<Buffer>((resolve, reject) => {
    const process = childProcess.spawn("adb", ["-s", deviceId, "exec-out", "screencap", "-p"], {
      shell: false,
    })
    const image: Buffer[] = []
    let errorOutput = ""
    process.stdout.on("data", (chunk) => image.push(Buffer.from(chunk)))
    process.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString()
    })
    process.on("error", reject)
    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || `adb screencap exited with code ${code}.`))
        return
      }
      resolve(Buffer.concat(image))
    })
  })
}

async function captureAndroidDeviceScreenshot(deviceId: string) {
  const screenshot = nativeImage.createFromBuffer(await captureAndroidDeviceScreenshotPng(deviceId))
  return screenshot.resize({ width: 480 }).toPNG().toString("base64")
}

async function runAndroidDeviceCommand(
  deviceId: string,
  command: "home" | "back" | "recents" | "reload" | "reverse" | "tap" | "swipe" | "rotate" | "type",
  x?: number,
  y?: number,
  reactotronPort?: number,
  endX?: number,
  endY?: number,
  text?: string
) {
  assertAndroidDeviceId(deviceId)
  if (command === "home")
    return runCommand("adb", ["-s", deviceId, "shell", "input", "keyevent", "3"])
  if (command === "back")
    return runCommand("adb", ["-s", deviceId, "shell", "input", "keyevent", "4"])
  if (command === "recents")
    return runCommand("adb", ["-s", deviceId, "shell", "input", "keyevent", "187"])
  if (command === "reload")
    return runCommand("adb", ["-s", deviceId, "shell", "input", "text", "RR"])
  if (command === "reverse") {
    if (!Number.isInteger(reactotronPort) || !reactotronPort || reactotronPort > 65535) {
      throw new Error("Invalid Reactotron server port.")
    }
    return runCommand("adb", [
      "-s",
      deviceId,
      "reverse",
      `tcp:${reactotronPort}`,
      `tcp:${reactotronPort}`,
    ])
  }
  if (command === "rotate") {
    const currentRotation = (
      await runCommand("adb", [
        "-s",
        deviceId,
        "shell",
        "settings",
        "get",
        "system",
        "user_rotation",
      ])
    ).trim()
    await runCommand("adb", [
      "-s",
      deviceId,
      "shell",
      "settings",
      "put",
      "system",
      "accelerometer_rotation",
      "0",
    ])
    return runCommand("adb", [
      "-s",
      deviceId,
      "shell",
      "settings",
      "put",
      "system",
      "user_rotation",
      currentRotation === "0" ? "1" : "0",
    ])
  }
  if (command === "type") {
    if (typeof text !== "string" || !/^[\x20-\x7e]{1,1000}$/.test(text)) {
      throw new Error("Android keyboard input must be printable ASCII text.")
    }
    return runCommand("adb", ["-s", deviceId, "shell", "input", "text", text.replace(/ /g, "%s")])
  }
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x! < 0 ||
    x! > 1 ||
    y! < 0 ||
    y! > 1 ||
    (command === "swipe" &&
      (!Number.isFinite(endX) ||
        !Number.isFinite(endY) ||
        endX! < 0 ||
        endX! > 1 ||
        endY! < 0 ||
        endY! > 1))
  ) {
    throw new Error("Invalid Android gesture coordinates.")
  }
  const size = await runCommand("adb", ["-s", deviceId, "shell", "wm", "size"])
  const match = size.match(/(?:Physical size|Override size):\s*(\d+)x(\d+)/)
  if (!match) throw new Error("Could not determine Android device screen size.")
  const width = Number(match[1])
  const height = Number(match[2])
  const startX = Math.round(x! * (width - 1))
  const startY = Math.round(y! * (height - 1))
  if (command === "swipe") {
    return runCommand("adb", [
      "-s",
      deviceId,
      "shell",
      "input",
      "swipe",
      String(startX),
      String(startY),
      String(Math.round(endX! * (width - 1))),
      String(Math.round(endY! * (height - 1))),
      "250",
    ])
  }
  return runCommand("adb", [
    "-s",
    deviceId,
    "shell",
    "input",
    "tap",
    String(startX),
    String(startY),
  ])
}

function getServeSimCliPath(): string {
  const cliPath = path.join("node_modules", "serve-sim", "dist", "serve-sim.js")
  const candidates = new Set([
    path.join(process.resourcesPath, "app.asar.unpacked", cliPath),
    path.join(process.resourcesPath, "app", cliPath),
  ])

  for (const startDirectory of [process.cwd(), app.getAppPath(), __dirname]) {
    let directory = startDirectory
    let parentDirectory = path.dirname(directory)
    while (directory !== parentDirectory) {
      candidates.add(path.join(directory, cliPath))
      directory = parentDirectory
      parentDirectory = path.dirname(directory)
    }
  }

  const pathToCli = Array.from(candidates).find((candidate) => fs.existsSync(candidate))

  if (!pathToCli) {
    throw new Error("serve-sim is not installed. Reinstall Reactotron and try again.")
  }

  return pathToCli
}

/**
 * Resolve the Node runtime used to launch the bundled serve-sim CLI.
 *
 * When Reactotron is opened from Finder/Dock the process inherits a minimal
 * PATH that usually does not include a user-installed Node (nvm, Homebrew),
 * so spawning a bare "node" fails with ENOENT. Electron ships its own Node,
 * so by default we re-invoke our own executable with ELECTRON_RUN_AS_NODE=1.
 * Electron's Node 18 runtime does not expose the WebSocket global that
 * serve-sim's control commands require, so the bootstrap supplies it from the
 * bundled `ws` dependency. REACTOTRON_NODE_PATH still overrides this for
 * anyone who needs a specific runtime.
 */
function getServeSimRunner(args: string[]): {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
} {
  const cliPath = getServeSimCliPath()
  const overridePath = process.env.REACTOTRON_NODE_PATH

  if (overridePath) {
    return { command: overridePath, args: [cliPath, ...args], env: process.env }
  }

  return {
    command: process.execPath,
    args: [
      "-e",
      "globalThis.WebSocket ??= require('ws').WebSocket; import(require('node:url').pathToFileURL(process.argv[1]).href)",
      cliPath,
      ...args,
    ],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  }
}

function getAvailablePort(startingPort = 3200): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      const server = net.createServer()
      server.once("error", () => {
        if (port >= startingPort + 49) {
          reject(new Error("No available local port for the simulator preview."))
          return
        }
        tryPort(port + 1)
      })
      server.once("listening", () => {
        server.close(() => resolve(port))
      })
      server.listen(port, "127.0.0.1")
    }

    tryPort(startingPort)
  })
}

async function captureIOSSimulatorScreenshot(udid: string) {
  assertIOSSimulatorUdid(udid)
  const directory = path.join(app.getPath("temp"), "reactotron", "simulator-screenshots")
  await fs.promises.mkdir(directory, { recursive: true })
  const filePath = path.join(directory, `simulator-${udid}-${Date.now()}.png`)
  await runCommand("xcrun", ["simctl", "io", udid, "screenshot", filePath])
  return filePath
}

async function getAvailableIOSSimulators(): Promise<IOSSimulator[]> {
  const output = await runCommand("xcrun", ["simctl", "list", "devices", "--json"])
  const devices = JSON.parse(output).devices as Record<string, Array<Record<string, unknown>>>

  return Object.entries(devices)
    .filter(([runtime]) => runtime.includes("SimRuntime.iOS"))
    .flatMap(([runtime, runtimeDevices]) =>
      runtimeDevices
        .filter((device) => device.isAvailable !== false)
        .map((device) => ({
          name: String(device.name),
          state: String(device.state),
          udid: String(device.udid),
          runtime: runtime.replace("com.apple.CoreSimulator.SimRuntime.", ""),
        }))
    )
}

async function bootIOSSimulator(udid: string): Promise<IOSSimulator> {
  const simulators = await getAvailableIOSSimulators()
  const simulator = simulators.find((item) => item.udid === udid)
  if (!simulator) throw new Error("That iOS simulator is no longer available.")

  if (simulator.state !== "Booted") {
    await runCommand("xcrun", ["simctl", "boot", udid])
    await runCommand("xcrun", ["simctl", "bootstatus", udid, "-b"])
  }

  return { ...simulator, state: "Booted" }
}

async function getIOSSimulatorCreationOptions(): Promise<IOSSimulatorCreationOption[]> {
  const output = await runCommand("xcrun", ["simctl", "list", "runtimes", "--json"])
  const runtimes = JSON.parse(output).runtimes as Array<Record<string, unknown>>
  const [runtime] = runtimes
    .filter(
      (item) =>
        item.platform === "iOS" &&
        item.isAvailable === true &&
        Array.isArray(item.supportedDeviceTypes)
    )
    .sort((left, right) =>
      String(right.version).localeCompare(String(left.version), undefined, { numeric: true })
    )

  if (!runtime) throw new Error("No available iOS Simulator runtime is installed.")

  return (runtime.supportedDeviceTypes as Array<Record<string, unknown>>)
    .filter((deviceType) => deviceType.productFamily === "iPhone")
    .map((deviceType) => ({
      deviceTypeIdentifier: String(deviceType.identifier),
      name: String(deviceType.name),
      runtimeIdentifier: String(runtime.identifier),
      runtimeName: String(runtime.name),
    }))
}

async function startServeSim(
  udid: string
): Promise<{ previewUrl: string; streamUrl: string; wsUrl: string }> {
  const existingSurface = serveSimProcesses.get(udid)
  if (existingSurface && existingSurface.process.exitCode === null) {
    const previewUrl = existingSurface.previewUrl
    return {
      previewUrl,
      streamUrl: `${previewUrl.replace(/\?.*$/, "")}/helper/${udid}/stream.mjpeg`,
      wsUrl: `ws://127.0.0.1:${new URL(previewUrl).port}/helper/${udid}/ws`,
    }
  }

  const port = await getAvailablePort()
  const previewUrl = `http://127.0.0.1:${port}?device=${udid}&session=${Date.now()}`
  const runner = getServeSimRunner(["--port", String(port), "--codec", "auto", udid])
  const serveSimProcess = childProcess.spawn(runner.command, runner.args, {
    shell: false,
    env: runner.env,
  })

  return new Promise((resolve, reject) => {
    let output = ""
    let settled = false
    const timeout = setTimeout(() => {
      finish(new Error("Timed out waiting for serve-sim to start."))
    }, 20000)

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error) {
        serveSimProcess.kill()
        reject(error)
      } else {
        serveSimProcesses.set(udid, { process: serveSimProcess, previewUrl })
        resolve({
          previewUrl,
          streamUrl: `http://127.0.0.1:${port}/helper/${udid}/stream.mjpeg`,
          wsUrl: `ws://127.0.0.1:${port}/helper/${udid}/ws`,
        })
      }
    }

    const receiveOutput = (data: Buffer) => {
      output += data.toString()
      if (output.includes(`http://localhost:${port}`)) finish()
    }

    serveSimProcess.stdout.on("data", receiveOutput)
    serveSimProcess.stderr.on("data", receiveOutput)
    serveSimProcess.on("error", (error) => finish(error))
    serveSimProcess.on("close", (code) => {
      if (serveSimProcesses.get(udid)?.process === serveSimProcess) {
        serveSimProcesses.delete(udid)
      }
      if (!settled) finish(new Error(output || `serve-sim exited with code ${code}.`))
    })
  })
}

function assertIOSSimulatorUdid(udid: unknown): asserts udid is string {
  if (typeof udid !== "string" || !iosSimulatorUdid.test(udid)) {
    throw new Error("Invalid iOS simulator identifier.")
  }
}

function sendServeSimControl(
  udid: string,
  opcode: number,
  message: Record<string, string>,
  requestedWsUrl?: unknown
): Promise<void> {
  const surface = serveSimProcesses.get(udid)
  const wsUrl = typeof requestedWsUrl === "string" ? requestedWsUrl : undefined
  if (!wsUrl && (!surface || surface.process.exitCode !== null)) {
    return Promise.reject(new Error("No simulator preview is running for this device."))
  }

  const controlUrl =
    wsUrl ?? `ws://127.0.0.1:${new URL(surface!.previewUrl).port}/helper/${udid}/ws`
  const url = new URL(controlUrl)
  if (
    url.protocol !== "ws:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== `/helper/${udid}/ws`
  ) {
    return Promise.reject(new Error("Invalid simulator preview control address."))
  }
  // serve-sim already provides this dependency; use its control protocol
  // directly so the command and preview always share the same server.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const WebSocket = require("ws") as typeof import("ws")

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(controlUrl)
    let finished = false
    const finish = (error?: Error) => {
      if (finished) return
      finished = true
      socket.close()
      if (error) reject(error)
      else resolve()
    }

    socket.on("open", () => {
      const payload = Buffer.from(JSON.stringify(message))
      socket.send(Buffer.concat([Buffer.from([opcode]), payload]))
      setTimeout(() => finish(), 50)
    })
    socket.on("error", (error) => finish(error))
  })
}

const reloadReactNativeViaMetro = (metroPort: number) =>
  new Promise<string>((resolve, reject) => {
    const request = http.get(
      {
        host: "localhost",
        port: metroPort,
        path: "/reload",
      },
      (response) => {
        let body = ""

        response.setEncoding("utf8")
        response.on("data", (chunk) => {
          body += chunk
        })
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`Metro returned ${response.statusCode}: ${body}`))
            return
          }

          resolve(body)
        })
      }
    )

    request.setTimeout(3000, () => {
      request.destroy(new Error(`Metro did not respond on port ${metroPort}.`))
    })
    request.on("error", reject)
  })

export type MetroDebuggerTarget = {
  id: string
  title: string
  description?: string
  webSocketDebuggerUrl: string
  reactNative?: {
    logicalDeviceId?: string
    capabilities?: {
      prefersFuseboxFrontend?: boolean
      nativePageReloads?: boolean
      nativeSourceCodeFetching?: boolean
      supportsMultipleDebuggers?: boolean
    }
  }
}

export type MetroDebuggerFrontend = "react-native-devtools" | "legacy-inspector" | "unsupported"

export type ReactotronDebuggerTarget = MetroDebuggerTarget & {
  frontend: MetroDebuggerFrontend
  frontendUrl?: string
  supportMessage: string
}

type MetroEndpoint = { host: string; port: number; protocol: "http" | "https" }

type DebuggerConnection = {
  clientId: string
  platform?: unknown
  debugger?: { metro?: Partial<MetroEndpoint>; platform?: unknown; jsEngine?: unknown }
}

type MetroSourceMap = {
  sources?: unknown
  sourcesContent?: unknown
}

type ReactotronDebuggerSource = {
  path: string
  content?: string
}

type CachedSourceMap = {
  endpoint: MetroEndpoint
  sourceMap: MetroSourceMap
}

type NativeDebuggerSession = {
  clientId: string
  sender: WebContents
  socket: import("ws").WebSocket
  sourceMap?: MetroSourceMap
  traceMap?: unknown
  bundleScriptId?: string
  nextCommandId: number
  pendingCommands: Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }
  >
}

const MAX_SOURCE_MAP_BYTES = 64 * 1024 * 1024
const MAX_SOURCE_CONTENT_BYTES = 512 * 1024
const MAX_INSPECTOR_TARGETS = 5
const MAX_CDP_MESSAGE_BYTES = 64 * 1024 * 1024
const nativeDebuggerSessions = new Map<number, NativeDebuggerSession>()
const sourceMapsByClientId = new Map<string, CachedSourceMap>()

function loadTraceMapping() {
  // electron-webpack rewrites a static require to this package's ESM entry.
  // Resolve it at Electron runtime so Node selects the package's CommonJS export.
  // eslint-disable-next-line no-eval
  return eval("require")("@jridgewell/trace-mapping") as unknown
}

function getMetroEndpoint(connection: DebuggerConnection): MetroEndpoint {
  const fallbackPort = Number(process.env.REACTOTRON_METRO_PORT ?? process.env.METRO_PORT ?? 8081)
  const metro = connection.debugger?.metro
  const host =
    typeof metro?.host === "string" && /^[a-zA-Z0-9.-]+$/.test(metro.host)
      ? metro.host
      : "localhost"
  const port = Number.isInteger(metro?.port) && metro!.port! > 0 ? metro.port! : fallbackPort
  return { host, port, protocol: metro?.protocol === "https" ? "https" : "http" }
}

function requestMetro(
  endpoint: MetroEndpoint,
  requestPath: string,
  onResponse: (response: http.IncomingMessage) => void
) {
  const get = endpoint.protocol === "https" ? https.get : http.get
  return get({ host: endpoint.host, port: endpoint.port, path: requestPath }, onResponse)
}

function readMetroJson<T>(endpoint: MetroEndpoint, requestPath: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = requestMetro(endpoint, requestPath, (response) => {
      let body = ""
      response.setEncoding("utf8")
      response.on("data", (chunk) => {
        body += chunk
      })
      response.on("end", () => {
        if (!response.statusCode || response.statusCode >= 400) {
          reject(new Error(`Metro returned ${response.statusCode ?? "an unknown status"}.`))
          return
        }

        try {
          resolve(JSON.parse(body) as T)
        } catch {
          reject(new Error("Metro returned an invalid debugger target response."))
        }
      })
    })

    request.setTimeout(3000, () => {
      request.destroy(new Error(`Metro did not respond at ${endpoint.host}:${endpoint.port}.`))
    })
    request.on("error", reject)
  })
}

function readMetroText(
  endpoint: MetroEndpoint,
  requestPath: string,
  maxBytes: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = requestMetro(endpoint, requestPath, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        response.resume()
        reject(new Error(`Metro returned ${response.statusCode ?? "an unknown status"}.`))
        return
      }

      let body = ""
      let bytes = 0
      response.setEncoding("utf8")
      response.on("data", (chunk: string) => {
        bytes += Buffer.byteLength(chunk)
        if (bytes > maxBytes) {
          request.destroy(new Error("Metro source map exceeded the debugger size limit."))
          return
        }
        body += chunk
      })
      response.on("end", () => resolve(body))
    })

    request.setTimeout(5000, () => {
      request.destroy(new Error(`Metro did not respond at ${endpoint.host}:${endpoint.port}.`))
    })
    request.on("error", reject)
  })
}

function getMetroSourceMapPath(connection: DebuggerConnection) {
  // Older Reactotron clients expose the platform on the connection itself.
  // Prefer the debugger metadata when available, but do not make source loading
  // depend on it after the Electron process or client reconnects.
  const platform = connection.debugger?.platform ?? connection.platform
  if (platform !== "ios" && platform !== "android") {
    throw new Error("The selected app did not report an iOS or Android Metro platform.")
  }

  const query = new URLSearchParams({ platform, dev: "true", minify: "false" })
  return `/index.map?${query.toString()}`
}

function isApplicationSourcePath(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 1024) return false
  const normalizedPath = value.replace(/\\\\/g, "/")
  return (
    !normalizedPath.includes("/node_modules/") &&
    !normalizedPath.startsWith("node_modules/") &&
    !normalizedPath.endsWith("/__prelude__")
  )
}

function getReactotronDebuggerSources(sourceMap: MetroSourceMap): ReactotronDebuggerSource[] {
  if (!Array.isArray(sourceMap.sources)) {
    throw new Error("Metro returned an invalid source map.")
  }

  const files: ReactotronDebuggerSource[] = []
  const paths = new Set<string>()

  for (let index = 0; index < sourceMap.sources.length; index++) {
    const sourcePath = sourceMap.sources[index]
    if (!isApplicationSourcePath(sourcePath) || paths.has(sourcePath)) continue

    paths.add(sourcePath)
    files.push({ path: sourcePath })
  }

  return files
}

async function getReactotronDebuggerSourceContent(
  cachedSourceMap: CachedSourceMap,
  sourcePath: string
) {
  const { sourceMap } = cachedSourceMap
  if (!Array.isArray(sourceMap.sources) || !sourceMap.sources.includes(sourcePath)) {
    throw new Error("This file is not part of the current Metro source map.")
  }

  const index = sourceMap.sources.indexOf(sourcePath)
  const sourceContent = Array.isArray(sourceMap.sourcesContent)
    ? sourceMap.sourcesContent[index]
    : undefined
  if (typeof sourceContent === "string") {
    if (Buffer.byteLength(sourceContent) > MAX_SOURCE_CONTENT_BYTES) {
      throw new Error("This source file exceeds the debugger text size limit.")
    }
    return sourceContent
  }

  return readMetroText(cachedSourceMap.endpoint, encodeURI(sourcePath), MAX_SOURCE_CONTENT_BYTES)
}

function decodeMetroSourceMapDataUrl(sourceMapUrl: string): MetroSourceMap {
  const match = sourceMapUrl.match(
    /^data:application\/json(?:;charset=utf-8)?;base64,([A-Za-z0-9+/=]+)$/i
  )
  if (!match) throw new Error("The Metro inspector returned an unsupported source map URL.")

  const sourceMap = Buffer.from(match[1], "base64")
  if (sourceMap.length > MAX_SOURCE_MAP_BYTES) {
    throw new Error("Metro source map exceeded the debugger size limit.")
  }

  try {
    return JSON.parse(sourceMap.toString("utf8")) as MetroSourceMap
  } catch {
    throw new Error("Metro returned an invalid source map.")
  }
}

function isMetroBundleScript(value: unknown): value is string {
  return typeof value === "string" && /\.bundle(?:[/?#]|$)/.test(value)
}

function readInspectorSourceMap(target: MetroDebuggerTarget): Promise<MetroSourceMap | undefined> {
  // The inspector endpoint is supplied by Metro's local /json/list response.
  // It is intentionally closed as soon as the bundle's source map is received.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const WebSocket = require("ws") as typeof import("ws")

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: MAX_CDP_MESSAGE_BYTES })
    let settled = false
    const timeout = setTimeout(() => finish(), 5000)

    const finish = (error?: Error, sourceMap?: MetroSourceMap) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.close()
      if (error) reject(error)
      else resolve(sourceMap)
    }

    socket.on("open", () => {
      socket.send(JSON.stringify({ id: 1, method: "Debugger.enable" }))
    })
    socket.on("message", (message) => {
      const messageBuffer = Array.isArray(message) ? Buffer.concat(message) : Buffer.from(message)
      if (messageBuffer.length > MAX_CDP_MESSAGE_BYTES) {
        finish(new Error("Metro inspector message exceeded the debugger size limit."))
        return
      }

      try {
        const event = JSON.parse(messageBuffer.toString("utf8")) as {
          method?: unknown
          params?: { url?: unknown; sourceMapURL?: unknown }
        }
        if (
          event.method !== "Debugger.scriptParsed" ||
          !isMetroBundleScript(event.params?.url) ||
          typeof event.params?.sourceMapURL !== "string"
        ) {
          return
        }

        finish(undefined, decodeMetroSourceMapDataUrl(event.params.sourceMapURL))
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Metro inspector returned invalid data."))
      }
    })
    socket.on("error", (error) => finish(error))
  })
}

async function getMetroInspectorSourceMap(
  endpoint: MetroEndpoint
): Promise<MetroSourceMap | undefined> {
  const response = await readMetroJson<unknown>(endpoint, "/json/list")
  if (!Array.isArray(response)) return undefined

  for (const target of response.filter(isMetroDebuggerTarget).slice(0, MAX_INSPECTOR_TARGETS)) {
    try {
      const sourceMap = await readInspectorSourceMap(target)
      if (sourceMap) return sourceMap
    } catch {
      // Older inspector targets and unrelated pages may not expose a source map.
    }
  }

  return undefined
}

async function getMetroSourceMap(connection: DebuggerConnection): Promise<MetroSourceMap> {
  const cachedSourceMap = sourceMapsByClientId.get(connection.clientId)
  if (cachedSourceMap) return cachedSourceMap.sourceMap

  const endpoint = getMetroEndpoint(connection)
  const inspectorSourceMap = await getMetroInspectorSourceMap(endpoint).catch(() => undefined)
  if (inspectorSourceMap) return inspectorSourceMap

  const sourceMapText = await readMetroText(
    endpoint,
    getMetroSourceMapPath(connection),
    MAX_SOURCE_MAP_BYTES
  )

  try {
    return JSON.parse(sourceMapText) as MetroSourceMap
  } catch (error) {
    if (error instanceof Error && error.message !== "Unexpected end of JSON input") throw error
    throw new Error("Metro returned an invalid source map.")
  }
}

function sendNativeDebuggerState(
  session: NativeDebuggerSession,
  type: "connected" | "paused" | "resumed" | "breakpointResolved" | "disconnected" | "error",
  details: Record<string, unknown> = {}
) {
  if (!session.sender.isDestroyed()) {
    session.sender.send("react-native-debugger-state", {
      type,
      clientId: session.clientId,
      ...details,
    })
  }
}

function closeNativeDebuggerSession(senderId: number, notify = true) {
  const session = nativeDebuggerSessions.get(senderId)
  if (!session) return

  nativeDebuggerSessions.delete(senderId)
  session.pendingCommands.forEach(({ reject, timeout }) => {
    clearTimeout(timeout)
    reject(new Error("React Native debugger disconnected."))
  })
  session.pendingCommands.clear()
  session.socket.close()
  if (notify) sendNativeDebuggerState(session, "disconnected")
}

function getReactNativeBridgeTarget(targets: MetroDebuggerTarget[]) {
  return targets.find(
    (target) =>
      `${target.description ?? ""}`.toLowerCase().includes("react native bridge") &&
      !`${target.title} ${target.description ?? ""}`.toLowerCase().includes("reanimated")
  )
}

function getCdpMessageBuffer(message: import("ws").RawData) {
  return Array.isArray(message) ? Buffer.concat(message) : Buffer.from(message)
}

function sendCdpCommand(
  session: NativeDebuggerSession,
  method: string,
  params?: Record<string, unknown>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (session.socket.readyState !== 1) {
      reject(new Error("React Native debugger is not connected."))
      return
    }

    const id = session.nextCommandId++
    const timeout = setTimeout(() => {
      session.pendingCommands.delete(id)
      reject(new Error(`Timed out waiting for ${method}.`))
    }, 5000)
    session.pendingCommands.set(id, { resolve, reject, timeout })
    session.socket.send(JSON.stringify({ id, method, params }))
  })
}

function getGeneratedPosition(session: NativeDebuggerSession, path: string, line: number) {
  if (!session.traceMap || !session.bundleScriptId) {
    throw new Error("React Native debugger source map is not ready.")
  }

  // trace-mapping is already resolvable by this workspace; keep the optional
  // dependency local to this main-process feature rather than adding a manifest entry.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GREATEST_LOWER_BOUND, eachMapping, generatedPositionFor } = loadTraceMapping() as {
    GREATEST_LOWER_BOUND: number
    eachMapping: (
      map: unknown,
      callback: (mapping: {
        generatedLine: number
        generatedColumn: number
        source: string | null
        originalLine: number | null
      }) => void
    ) => void
    generatedPositionFor: (
      map: unknown,
      position: { source: string; line: number; column: number; bias: number }
    ) => { line: number | null; column: number | null }
  }
  const generated = generatedPositionFor(session.traceMap, {
    source: path,
    line,
    column: 0,
    bias: GREATEST_LOWER_BOUND,
  })
  if (generated.line !== null && generated.column !== null) {
    return {
      scriptId: session.bundleScriptId,
      lineNumber: generated.line - 1,
      columnNumber: generated.column,
    }
  }

  let nextExecutableLocation:
    | { originalLine: number; generatedLine: number; generatedColumn: number }
    | undefined
  eachMapping(session.traceMap, (mapping) => {
    if (
      mapping.source !== path ||
      mapping.originalLine === null ||
      mapping.originalLine < line ||
      (nextExecutableLocation && mapping.originalLine >= nextExecutableLocation.originalLine)
    ) {
      return
    }
    nextExecutableLocation = {
      originalLine: mapping.originalLine,
      generatedLine: mapping.generatedLine,
      generatedColumn: mapping.generatedColumn,
    }
  })
  if (!nextExecutableLocation) {
    throw new Error("Could not map that source location to the Metro bundle.")
  }

  return {
    scriptId: session.bundleScriptId,
    lineNumber: nextExecutableLocation.generatedLine - 1,
    columnNumber: nextExecutableLocation.generatedColumn,
  }
}

function isExplicitlyJscConnection(connection: DebuggerConnection) {
  return connection.debugger?.jsEngine === "jsc"
}

async function connectNativeDebugger(
  sender: WebContents,
  connection: DebuggerConnection
): Promise<void> {
  if (isExplicitlyJscConnection(connection)) {
    throw new Error("React Native breakpoints require a Hermes connection.")
  }

  closeNativeDebuggerSession(sender.id)
  const endpoint = getMetroEndpoint(connection)
  const response = await readMetroJson<unknown>(endpoint, "/json/list")
  const target = Array.isArray(response)
    ? getReactNativeBridgeTarget(response.filter(isMetroDebuggerTarget))
    : undefined
  if (!target) throw new Error("Metro did not expose a React Native Bridge inspector target.")

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const WebSocket = require("ws") as typeof import("ws")
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: MAX_CDP_MESSAGE_BYTES })
    const session: NativeDebuggerSession = {
      clientId: connection.clientId,
      sender,
      socket,
      nextCommandId: 1,
      pendingCommands: new Map(),
    }
    let settled = false
    const timeout = setTimeout(
      () => finish(new Error("Timed out loading the Hermes source map.")),
      5000
    )
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error) {
        socket.close()
        reject(error)
      } else {
        nativeDebuggerSessions.set(sender.id, session)
        sender.once("destroyed", () => closeNativeDebuggerSession(sender.id, false))
        resolve()
      }
    }
    const fail = (error: Error) => {
      sendNativeDebuggerState(session, "error", { message: error.message })
      if (settled) closeNativeDebuggerSession(sender.id)
      else finish(error)
    }

    socket.on("open", () => {
      socket.send(JSON.stringify({ id: 0, method: "Debugger.enable" }))
    })
    socket.on("message", (message) => {
      const messageBuffer = getCdpMessageBuffer(message)
      if (messageBuffer.length > MAX_CDP_MESSAGE_BYTES) {
        fail(new Error("Metro inspector message exceeded the debugger size limit."))
        return
      }

      try {
        const event = JSON.parse(messageBuffer.toString("utf8")) as {
          id?: unknown
          method?: unknown
          params?: {
            scriptId?: unknown
            url?: unknown
            sourceMapURL?: unknown
            breakpointId?: unknown
            location?: unknown
            callFrames?: unknown
          }
          result?: unknown
          error?: { message?: unknown }
        }
        if (typeof event.id === "number") {
          const pending = session.pendingCommands.get(event.id)
          if (!pending) return
          session.pendingCommands.delete(event.id)
          clearTimeout(pending.timeout)
          if (typeof event.error?.message === "string")
            pending.reject(new Error(event.error.message))
          else pending.resolve(event.result)
          return
        }
        if (event.method === "Debugger.scriptParsed" && isMetroBundleScript(event.params?.url)) {
          if (
            typeof event.params?.scriptId !== "string" ||
            typeof event.params.sourceMapURL !== "string"
          )
            return
          const sourceMap = decodeMetroSourceMapDataUrl(event.params.sourceMapURL)
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { TraceMap } = loadTraceMapping() as {
            TraceMap: new (map: MetroSourceMap) => unknown
          }
          session.sourceMap = sourceMap
          session.traceMap = new TraceMap(sourceMap)
          session.bundleScriptId = event.params.scriptId
          sourceMapsByClientId.set(session.clientId, {
            endpoint,
            sourceMap,
          })
          sendNativeDebuggerState(session, "connected")
          finish()
          return
        }
        if (event.method === "Debugger.paused") {
          sendNativeDebuggerState(session, "paused", { callFrames: event.params?.callFrames })
        } else if (event.method === "Debugger.resumed") {
          sendNativeDebuggerState(session, "resumed")
        } else if (event.method === "Debugger.breakpointResolved") {
          sendNativeDebuggerState(session, "breakpointResolved", {
            breakpointId: event.params?.breakpointId,
            location: event.params?.location,
          })
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Metro inspector returned invalid data."
        fail(new Error(message))
      }
    })
    socket.on("error", (error) => fail(error))
    socket.on("close", () => {
      if (nativeDebuggerSessions.get(sender.id) === session) {
        closeNativeDebuggerSession(sender.id)
      } else if (!settled) {
        finish(new Error("React Native debugger disconnected before loading sources."))
      }
    })
  })
}

function isDebuggerConnection(value: unknown): value is DebuggerConnection {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as DebuggerConnection).clientId === "string" &&
    Boolean((value as DebuggerConnection).clientId)
  )
}

function sendNativeDebuggerError(
  sender: WebContents,
  clientId: string | undefined,
  error: unknown
) {
  if (!sender.isDestroyed()) {
    sender.send("react-native-debugger-state", {
      type: "error",
      clientId,
      message: error instanceof Error ? error.message : "React Native debugger failed.",
    })
  }
}

function readBreakpointLocation(value: unknown): { path: string; line: number } {
  if (!value || typeof value !== "object") throw new Error("Invalid breakpoint location.")
  const location = value as { path?: unknown; line?: unknown }
  const line = location.line
  if (
    typeof location.path !== "string" ||
    !location.path ||
    location.path.length > 1024 ||
    typeof line !== "number" ||
    !Number.isInteger(line) ||
    line < 1
  ) {
    throw new Error("Invalid breakpoint location.")
  }
  return { path: location.path, line }
}

function readBreakpointId(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 256) {
    throw new Error("Invalid breakpoint identifier.")
  }
  return value
}

function isMetroDebuggerTarget(value: unknown): value is MetroDebuggerTarget {
  if (!value || typeof value !== "object") return false
  const target = value as Record<string, unknown>
  return (
    typeof target.id === "string" &&
    typeof target.title === "string" &&
    typeof target.webSocketDebuggerUrl === "string"
  )
}

function metroPathExists(endpoint: MetroEndpoint, requestPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = requestMetro(endpoint, requestPath, (response) => {
      response.resume()
      resolve(Boolean(response.statusCode && response.statusCode < 400))
    })

    request.setTimeout(3000, () => {
      request.destroy()
      resolve(false)
    })
    request.on("error", () => resolve(false))
  })
}

function getMetroDebuggerFrontendUrl(
  endpoint: MetroEndpoint,
  target: MetroDebuggerTarget,
  frontend: Exclude<MetroDebuggerFrontend, "unsupported">
) {
  const devServer = new URL(`${endpoint.protocol}://${endpoint.host}:${endpoint.port}`)
  const debuggerSocket = new URL(target.webSocketDebuggerUrl)
  const socketValue =
    debuggerSocket.host === devServer.host
      ? `${debuggerSocket.pathname}${debuggerSocket.search}${debuggerSocket.hash}`
      : `${debuggerSocket.host}${debuggerSocket.pathname}${debuggerSocket.search}${debuggerSocket.hash}`
  const frontendPath =
    frontend === "react-native-devtools"
      ? "/debugger-frontend/rn_fusebox.html"
      : "/debugger-frontend/rn_inspector.html"
  const query = new URLSearchParams([
    [debuggerSocket.protocol.slice(0, -1), socketValue],
    ["sources.hide_add_folder", "true"],
  ])

  return `${devServer.origin}${frontendPath}?${query.toString()}`
}

function buildReactotronDebuggerTarget(
  endpoint: MetroEndpoint,
  target: MetroDebuggerTarget,
  frontends: { fusebox: boolean; inspector: boolean }
): ReactotronDebuggerTarget {
  const capabilities = target.reactNative?.capabilities
  const isModernTarget =
    capabilities?.prefersFuseboxFrontend === true ||
    (capabilities?.nativePageReloads === true && capabilities?.nativeSourceCodeFetching === true)

  if (isModernTarget && frontends.fusebox) {
    return {
      ...target,
      frontend: "react-native-devtools",
      frontendUrl: getMetroDebuggerFrontendUrl(endpoint, target, "react-native-devtools"),
      supportMessage: "React Native DevTools (Hermes/CDP)",
    }
  }

  if (frontends.inspector) {
    return {
      ...target,
      frontend: "legacy-inspector",
      frontendUrl: getMetroDebuggerFrontendUrl(endpoint, target, "legacy-inspector"),
      supportMessage: "Legacy Hermes inspector (best effort)",
    }
  }

  return {
    ...target,
    frontend: "unsupported",
    supportMessage:
      "Metro did not expose a compatible React Native debugger frontend for this target.",
  }
}

async function getMetroDebuggerTargets(
  endpoint: MetroEndpoint
): Promise<ReactotronDebuggerTarget[]> {
  const response = await readMetroJson<unknown>(endpoint, "/json/list")
  if (!Array.isArray(response)) {
    throw new Error("Metro did not return a list of debugger targets.")
  }

  const [fusebox, inspector] = await Promise.all([
    metroPathExists(endpoint, "/debugger-frontend/rn_fusebox.html"),
    metroPathExists(endpoint, "/debugger-frontend/rn_inspector.html"),
  ])

  return response
    .filter(isMetroDebuggerTarget)
    .map((target) => buildReactotronDebuggerTarget(endpoint, target, { fusebox, inspector }))
}

export const setupSimulatorIPCCommands = () => {
  ipcMain.handle("connect-react-native-debugger", async (event, connection: unknown) => {
    if (!isDebuggerConnection(connection)) {
      const message = "Select a React Native app before connecting the debugger."
      sendNativeDebuggerError(event.sender, undefined, new Error(message))
      return { ok: false, message }
    }

    try {
      await connectNativeDebugger(event.sender, connection)
      return { ok: true }
    } catch (error) {
      sendNativeDebuggerError(event.sender, connection.clientId, error)
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Could not connect the React Native debugger.",
      }
    }
  })

  ipcMain.handle("disconnect-react-native-debugger", async (event) => {
    closeNativeDebuggerSession(event.sender.id)
    return { ok: true }
  })

  ipcMain.handle("pause-react-native-debugger", async (event) => {
    const session = nativeDebuggerSessions.get(event.sender.id)
    if (!session) return { ok: false, message: "Connect the React Native debugger first." }

    try {
      await sendCdpCommand(session, "Debugger.pause")
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Could not pause the React Native debugger.",
      }
    }
  })

  ipcMain.handle("resume-react-native-debugger", async (event) => {
    const session = nativeDebuggerSessions.get(event.sender.id)
    if (!session) return { ok: false, message: "Connect the React Native debugger first." }

    try {
      await sendCdpCommand(session, "Debugger.resume")
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Could not resume the React Native debugger.",
      }
    }
  })

  ipcMain.handle("set-react-native-breakpoint", async (event, location: unknown) => {
    const session = nativeDebuggerSessions.get(event.sender.id)
    if (!session) return { ok: false, message: "Connect the React Native debugger first." }

    try {
      const originalLocation = readBreakpointLocation(location)
      const result = (await sendCdpCommand(session, "Debugger.setBreakpoint", {
        location: getGeneratedPosition(session, originalLocation.path, originalLocation.line),
      })) as { breakpointId?: unknown; actualLocation?: unknown }
      if (typeof result.breakpointId !== "string") {
        throw new Error("Hermes did not return a breakpoint identifier.")
      }
      sendNativeDebuggerState(session, "breakpointResolved", {
        breakpointId: result.breakpointId,
        location: result.actualLocation,
      })
      return { ok: true, breakpointId: result.breakpointId, location: result.actualLocation }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Could not set React Native breakpoint.",
      }
    }
  })

  ipcMain.handle("remove-react-native-breakpoint", async (event, breakpointId: unknown) => {
    const session = nativeDebuggerSessions.get(event.sender.id)
    if (!session) return { ok: false, message: "Connect the React Native debugger first." }

    try {
      await sendCdpCommand(session, "Debugger.removeBreakpoint", {
        breakpointId: readBreakpointId(breakpointId),
      })
      return { ok: true }
    } catch (error) {
      sendNativeDebuggerState(session, "error", {
        message:
          error instanceof Error ? error.message : "Could not remove React Native breakpoint.",
      })
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Could not remove React Native breakpoint.",
      }
    }
  })

  ipcMain.handle("list-metro-debugger-targets", async (_event, connection: unknown) => {
    if (
      !connection ||
      typeof connection !== "object" ||
      typeof (connection as DebuggerConnection).clientId !== "string" ||
      !(connection as DebuggerConnection).clientId
    ) {
      return { ok: false, message: "Select a React Native app before opening the debugger." }
    }

    try {
      const targets = await getMetroDebuggerTargets(
        getMetroEndpoint(connection as DebuggerConnection)
      )
      return { ok: true, targets }
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Could not discover Metro debugger targets.",
      }
    }
  })

  ipcMain.handle("list-react-native-debugger-sources", async (_event, connection: unknown) => {
    if (
      !connection ||
      typeof connection !== "object" ||
      typeof (connection as DebuggerConnection).clientId !== "string" ||
      !(connection as DebuggerConnection).clientId
    ) {
      return { ok: false, message: "Select a React Native app before opening the debugger." }
    }

    try {
      const debuggerConnection = connection as DebuggerConnection
      const sourceMap = await getMetroSourceMap(debuggerConnection)
      sourceMapsByClientId.set(debuggerConnection.clientId, {
        endpoint: getMetroEndpoint(debuggerConnection),
        sourceMap,
      })
      return { ok: true, files: getReactotronDebuggerSources(sourceMap) }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Could not load Metro source files.",
      }
    }
  })

  ipcMain.handle("get-react-native-debugger-source-content", async (_event, request: unknown) => {
    if (!request || typeof request !== "object") {
      return { ok: false, message: "Select a source file before opening it." }
    }

    const { clientId, path: sourcePath } = request as { clientId?: unknown; path?: unknown }
    if (
      typeof clientId !== "string" ||
      !clientId ||
      typeof sourcePath !== "string" ||
      !sourcePath
    ) {
      return { ok: false, message: "Select a source file before opening it." }
    }

    try {
      const sourceMap = sourceMapsByClientId.get(clientId)
      if (!sourceMap) {
        return { ok: false, message: "Refresh source files before opening a file." }
      }
      return {
        ok: true,
        content: await getReactotronDebuggerSourceContent(sourceMap, sourcePath),
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Could not load source text.",
      }
    }
  })

  ipcMain.handle("android-device-screenshot-action", async (event, deviceId: unknown) => {
    try {
      assertAndroidDeviceId(deviceId)
      const window = ElectronBrowserWindow.fromWebContents(event.sender)
      const choice = await dialog.showMessageBox(window ?? undefined, {
        title: "Android Screenshot",
        message: "What would you like to do with this screenshot?",
        buttons: ["Save to File", "Copy to Clipboard", "Cancel"],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      })
      if (choice.response === 2) return { ok: true, canceled: true }

      const png = await captureAndroidDeviceScreenshotPng(deviceId)
      if (choice.response === 1) {
        clipboard.writeImage(nativeImage.createFromBuffer(png))
        return { ok: true, action: "copied" }
      }
      const save = await dialog.showSaveDialog(window ?? undefined, {
        title: "Save Android Screenshot",
        defaultPath: "android-screenshot.png",
        filters: [{ name: "PNG image", extensions: ["png"] }],
      })
      if (save.canceled || !save.filePath) return { ok: true, canceled: true }
      await fs.promises.writeFile(save.filePath, png)
      return { ok: true, action: "saved", filePath: save.filePath }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("toggle-android-device-recording", async (event, deviceId: unknown) => {
    try {
      assertAndroidDeviceId(deviceId)
      const activeRecording = androidRecordings.get(deviceId)
      if (activeRecording) {
        if (activeRecording.process.exitCode === null) {
          const finished = new Promise<void>((resolve) =>
            activeRecording.process.once("close", resolve)
          )
          // Stopping the adb client interrupts the transport and leaves a corrupt
          // MP4. Signal screenrecord on the device so it writes its trailer first.
          await runCommand("adb", ["-s", deviceId, "shell", "pkill", "-INT", "screenrecord"])
          await finished
        }
        // Keep naturally completed recordings in the registry until the user
        // presses stop, so the finalized MP4 can still be saved.
        androidRecordings.delete(deviceId)
        const directory = path.join(app.getPath("temp"), "reactotron", "android-recordings")
        await fs.promises.mkdir(directory, { recursive: true })
        const temporaryPath = path.join(directory, `android-recording-${Date.now()}.mp4`)
        await runCommand("adb", ["-s", deviceId, "pull", activeRecording.remotePath, temporaryPath])
        await runCommand("adb", ["-s", deviceId, "shell", "rm", "-f", activeRecording.remotePath])
        const window = ElectronBrowserWindow.fromWebContents(event.sender)
        const save = await dialog.showSaveDialog(window ?? undefined, {
          title: "Save Android Recording",
          defaultPath: "android-recording.mp4",
          filters: [{ name: "MPEG-4 video", extensions: ["mp4"] }],
        })
        if (save.canceled || !save.filePath) {
          await fs.promises.rm(temporaryPath, { force: true })
          return { ok: true, canceled: true, recording: false }
        }
        await fs.promises.copyFile(temporaryPath, save.filePath)
        await fs.promises.rm(temporaryPath, { force: true })
        return { ok: true, recording: false, filePath: save.filePath }
      }

      const remotePath = "/sdcard/reactotron-recording.mp4"
      const recordingProcess = childProcess.spawn(
        "adb",
        ["-s", deviceId, "shell", "screenrecord", "--bit-rate", "12000000", remotePath],
        { shell: false }
      )
      androidRecordings.set(deviceId, { process: recordingProcess, remotePath })
      recordingProcess.on("error", () => {
        if (androidRecordings.get(deviceId)?.process === recordingProcess) {
          androidRecordings.delete(deviceId)
        }
      })
      return { ok: true, recording: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    "start-android-video-stream",
    async (event, deviceId: unknown, streamId: unknown) => {
      try {
        assertAndroidDeviceId(deviceId)
        if (typeof streamId !== "string" || streamId.length > 128) {
          throw new Error("Invalid Android video stream identifier.")
        }
        androidVideoStreams.get(streamId)?.close()
        const stream = await startAndroidScrcpyStream(
          deviceId,
          path.join(app.getPath("userData"), "scrcpy"),
          {
            onMeta: (meta) => {
              if (!event.sender.isDestroyed()) {
                event.sender.send("android-video-stream-meta", { streamId, deviceId, meta })
              }
            },
            onFrame: (frame) => {
              if (!event.sender.isDestroyed()) {
                event.sender.send("android-video-stream-frame", {
                  streamId,
                  deviceId,
                  config: frame.config,
                  keyFrame: frame.keyFrame,
                  data: frame.data,
                })
              }
            },
            onError: (message) => {
              if (!event.sender.isDestroyed()) {
                event.sender.send("android-video-stream-error", { streamId, deviceId, message })
              }
            },
            onClose: () => {
              if (androidVideoStreams.get(streamId) === stream) {
                androidVideoStreams.delete(streamId)
              }
            },
          }
        )
        androidVideoStreams.set(streamId, stream)
        event.sender.once("destroyed", () => stream.close())
        return { ok: true }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle("stop-android-video-stream", async (_event, streamId: unknown) => {
    if (typeof streamId === "string") {
      androidVideoStreams.get(streamId)?.close()
    }
    return { ok: true }
  })

  ipcMain.handle("list-android-devices", async () => {
    try {
      return { ok: true, devices: await getAndroidDevices() }
    } catch (error) {
      return {
        ok: false,
        devices: [],
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle("android-device-screenshot", async (_event, deviceId: unknown) => {
    try {
      assertAndroidDeviceId(deviceId)
      return { ok: true, imageBase64: await captureAndroidDeviceScreenshot(deviceId) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    "android-device-command",
    async (
      _event,
      deviceId: unknown,
      command: unknown,
      options?: {
        x?: unknown
        y?: unknown
        endX?: unknown
        endY?: unknown
        port?: unknown
        text?: unknown
      }
    ) => {
      try {
        assertAndroidDeviceId(deviceId)
        if (
          ![
            "home",
            "back",
            "recents",
            "reload",
            "reverse",
            "tap",
            "swipe",
            "rotate",
            "type",
          ].includes(String(command))
        ) {
          throw new Error("Unsupported Android device command.")
        }
        await runAndroidDeviceCommand(
          deviceId,
          command as
            | "home"
            | "back"
            | "recents"
            | "reload"
            | "reverse"
            | "tap"
            | "swipe"
            | "rotate"
            | "type",
          Number(options?.x),
          Number(options?.y),
          Number(options?.port),
          Number(options?.endX),
          Number(options?.endY),
          typeof options?.text === "string" ? options.text : undefined
        )
        return { ok: true }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle("list-booted-ios-simulators", async () => {
    try {
      return { ok: true, simulators: await getAvailableIOSSimulators() }
    } catch (error) {
      return {
        ok: false,
        simulators: [],
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle("list-ios-simulator-surfaces", async () => {
    try {
      const simulators = await getAvailableIOSSimulators()
      return {
        ok: true,
        simulators: simulators.map((simulator) => ({
          ...simulator,
          streaming: serveSimProcesses.has(simulator.udid),
        })),
      }
    } catch (error) {
      return {
        ok: false,
        simulators: [],
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle("start-ios-simulator-surface", async (_event, udid: unknown) => {
    try {
      assertIOSSimulatorUdid(udid)
      const simulator = await bootIOSSimulator(udid)
      return { ok: true, simulator, ...(await startServeSim(udid)) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("reconnect-ios-simulator-surface", async (_event, udid: unknown) => {
    try {
      assertIOSSimulatorUdid(udid)
      const existingSurface = serveSimProcesses.get(udid)
      if (existingSurface) {
        existingSurface.process.kill()
        serveSimProcesses.delete(udid)
      }

      return { ok: true, ...(await startServeSim(udid)) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("close-ios-simulator-surface", async (_event, udid: unknown) => {
    try {
      assertIOSSimulatorUdid(udid)
      const existingSurface = serveSimProcesses.get(udid)
      if (existingSurface) {
        existingSurface.process.kill()
        serveSimProcesses.delete(udid)
      }
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("shutdown-ios-simulator-surface", async (_event, udid: unknown) => {
    try {
      assertIOSSimulatorUdid(udid)
      const existingSurface = serveSimProcesses.get(udid)
      if (existingSurface) {
        existingSurface.process.kill()
        serveSimProcesses.delete(udid)
      }
      await runCommand("xcrun", ["simctl", "shutdown", udid])
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("list-ios-simulator-creation-options", async () => {
    try {
      return { ok: true, options: await getIOSSimulatorCreationOptions() }
    } catch (error) {
      return {
        ok: false,
        options: [],
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle("create-ios-simulator-surface", async (_event, deviceTypeIdentifier: unknown) => {
    try {
      if (typeof deviceTypeIdentifier !== "string") throw new Error("Invalid iOS simulator type.")
      const options = await getIOSSimulatorCreationOptions()
      const option = options.find((item) => item.deviceTypeIdentifier === deviceTypeIdentifier)
      if (!option) throw new Error("That iOS simulator type is not available.")

      const name = `Reactotron ${option.name} ${new Date().toISOString().replace(/[:.]/g, "-")}`
      const udid = (
        await runCommand("xcrun", [
          "simctl",
          "create",
          name,
          option.deviceTypeIdentifier,
          option.runtimeIdentifier,
        ])
      ).trim()
      assertIOSSimulatorUdid(udid)
      await runCommand("xcrun", ["simctl", "boot", udid])
      await runCommand("xcrun", ["simctl", "bootstatus", udid, "-b"])

      return {
        ok: true,
        simulator: { name, runtime: option.runtimeName, state: "Booted", udid },
        ...(await startServeSim(udid)),
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    "ios-simulator-surface-command",
    async (_event, udid: unknown, command: unknown, wsUrl: unknown) => {
      try {
        assertIOSSimulatorUdid(udid)
        if (command === "home") {
          await sendServeSimControl(udid, 4, { button: "home" }, wsUrl)
        } else if (command === "landscape_left" || command === "portrait") {
          await sendServeSimControl(udid, 7, { orientation: command }, wsUrl)
        } else {
          throw new Error("Unsupported iOS simulator command.")
        }
        return { ok: true }
      } catch (error) {
        console.error("iOS simulator surface command failed", error)
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle("save-ios-simulator-screenshot", async (event, udid: unknown) => {
    try {
      assertIOSSimulatorUdid(udid)
      const window = ElectronBrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showSaveDialog(window ?? undefined, {
        title: "Save Simulator Screenshot",
        defaultPath: "simulator-screenshot.png",
        filters: [{ name: "PNG image", extensions: ["png"] }],
      })
      if (result.canceled || !result.filePath) return { ok: true, canceled: true }

      const temporaryScreenshot = await captureIOSSimulatorScreenshot(udid)
      await fs.promises.copyFile(temporaryScreenshot, result.filePath)
      return { ok: true, filePath: result.filePath }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("ios-simulator-screenshot", async (event, udid: unknown) => {
    try {
      assertIOSSimulatorUdid(udid)
      const window = ElectronBrowserWindow.fromWebContents(event.sender)
      const choice = await dialog.showMessageBox(window ?? undefined, {
        title: "Simulator Screenshot",
        message: "What would you like to do with this screenshot?",
        buttons: ["Save to File", "Copy to Clipboard", "Cancel"],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      })
      if (choice.response === 2) return { ok: true, canceled: true }

      const temporaryScreenshot = await captureIOSSimulatorScreenshot(udid)
      if (choice.response === 1) {
        clipboard.writeImage(nativeImage.createFromPath(temporaryScreenshot))
        return { ok: true, action: "copied" }
      }

      const save = await dialog.showSaveDialog(window ?? undefined, {
        title: "Save Simulator Screenshot",
        defaultPath: "simulator-screenshot.png",
        filters: [{ name: "PNG image", extensions: ["png"] }],
      })
      if (save.canceled || !save.filePath) return { ok: true, canceled: true }
      await fs.promises.copyFile(temporaryScreenshot, save.filePath)
      return { ok: true, action: "saved", filePath: save.filePath }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("capture-ios-simulator-screenshot", async (_event, udid: unknown) => {
    try {
      assertIOSSimulatorUdid(udid)
      const filePath = await captureIOSSimulatorScreenshot(udid)
      const imageBase64 = await fs.promises.readFile(filePath, "base64")
      return { ok: true, filePath, imageBase64, mimeType: "image/png" }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("toggle-ios-simulator-recording", async (event, udid: unknown) => {
    try {
      assertIOSSimulatorUdid(udid)
      const activeRecording = simulatorRecordings.get(udid)
      if (activeRecording) {
        const finished = new Promise<void>((resolve) =>
          activeRecording.process.once("close", resolve)
        )
        activeRecording.process.kill("SIGINT")
        await finished
        simulatorRecordings.delete(udid)
        const window = ElectronBrowserWindow.fromWebContents(event.sender)
        const save = await dialog.showSaveDialog(window ?? undefined, {
          title: "Save Simulator Recording",
          defaultPath: "simulator-recording.mov",
          filters: [{ name: "QuickTime movie", extensions: ["mov"] }],
        })
        if (save.canceled || !save.filePath) {
          await fs.promises.rm(activeRecording.filePath, { force: true })
          return { ok: true, canceled: true, recording: false }
        }
        await fs.promises.copyFile(activeRecording.filePath, save.filePath)
        await fs.promises.rm(activeRecording.filePath, { force: true })
        return { ok: true, recording: false, filePath: save.filePath }
      }

      const directory = path.join(app.getPath("temp"), "reactotron", "simulator-recordings")
      await fs.promises.mkdir(directory, { recursive: true })
      const filePath = path.join(directory, `simulator-recording-${udid}-${Date.now()}.mov`)

      const recordingProcess = childProcess.spawn(
        "xcrun",
        ["simctl", "io", udid, "recordVideo", filePath],
        { shell: false }
      )
      simulatorRecordings.set(udid, { process: recordingProcess, filePath })
      recordingProcess.on("close", () => {
        if (simulatorRecordings.get(udid)?.process === recordingProcess) {
          simulatorRecordings.delete(udid)
        }
      })
      recordingProcess.on("error", () => {
        if (simulatorRecordings.get(udid)?.process === recordingProcess) {
          simulatorRecordings.delete(udid)
        }
      })
      return { ok: true, recording: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("toggle-ios-simulator-appearance", async (_event, udid: unknown) => {
    try {
      assertIOSSimulatorUdid(udid)
      const currentAppearance = (
        await runCommand("xcrun", ["simctl", "ui", udid, "appearance"])
      ).trim()
      const appearance = currentAppearance === "dark" ? "light" : "dark"
      await runCommand("xcrun", ["simctl", "ui", udid, "appearance", appearance])
      return { ok: true, appearance }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle("reload-ios-simulator", async () => {
    const metroPort = Number(process.env.REACTOTRON_METRO_PORT ?? process.env.METRO_PORT ?? 8081)
    console.log(`[Reactotron Desktop] React Native reload requested via Metro port ${metroPort}.`)

    try {
      await reloadReactNativeViaMetro(metroPort)

      const message = `Sent reload request to Metro on port ${metroPort}.`
      console.log(`[Reactotron Desktop] ${message}`)
      return { ok: true, message }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log("[Reactotron Desktop] Failed to reload via Metro.", message)
      return { ok: false, message }
    }
  })
}

export const stopIOSSimulatorSurfaces = () => {
  serveSimProcesses.forEach(({ process }) => process.kill())
  serveSimProcesses.clear()
  simulatorRecordings.forEach(({ process }) => process.kill("SIGINT"))
  simulatorRecordings.clear()
}

// This function sets up numerous IPC commands for communicating with android devices.
// It also watches for android devices being plugged in and unplugged.
//
export const setupAndroidDeviceIPCCommands = (mainWindow: BrowserWindow) => {
  // Allows the main renderer to communicate with the main process and get a list of connected android devices.
  ipcMain.on("get-device-list", () => {
    console.log("Getting Android device list")
    const devicesProcess = childProcess.spawn("adb", ["devices"], {
      shell: true,
    })
    devicesProcess.stdout.setEncoding("utf8")
    devicesProcess.stdout.on("data", (data) => {
      data = data.toString()
      console.log("Got adb device list", data)
      mainWindow.webContents.send("device-list", data)
    })
  })

  // Creates a reverse tunnel to an android device for reactotron and metro.
  ipcMain.on("reverse-tunnel-device", (_event, deviceId, reactotronPort, metroPort) => {
    console.log("Reverse Tunneling Android device", deviceId, reactotronPort, metroPort)

    // First do the reverse tunnel for reactotron:
    const reactotronReverseProcess = childProcess.spawn(
      "adb",
      ["-s", deviceId, "reverse", `tcp:${reactotronPort}`, `tcp:${reactotronPort}`],
      {
        shell: true,
      }
    )
    reactotronReverseProcess.stdout.setEncoding("utf8")
    reactotronReverseProcess.stdout.on("data", () => {
      console.log(`Reverse Tunneling To Reactotron Port ${reactotronPort} Complete.`)
    })

    // Now do the reverse tunnel for react native:
    const metroReverseProcess = childProcess.spawn(
      "adb",
      ["-s", deviceId, "reverse", `tcp:${metroPort}`, `tcp:${metroPort}`],
      {
        shell: true,
      }
    )
    metroReverseProcess.stdout.setEncoding("utf8")
    metroReverseProcess.stdout.on("data", () => {
      console.log(`Reverse Tunneling To Metro Port ${metroPort} Complete.`)
    })
  })

  // Reloads the app on the android device
  ipcMain.on("reload-app", (_event, arg) => {
    console.log("Reloading App on device", arg)
    const reloadAppProcess = childProcess.spawn(
      "adb",
      ["-s", arg, "shell", "input", "text", '"RR"'],
      {
        shell: true,
      }
    )
    reloadAppProcess.stdout.setEncoding("utf8")
    reloadAppProcess.stdout.on("data", (data) => {
      data = data.toString()
      console.log("Reloading App Complete", data)
    })
  })

  // Reloads the app on the android device
  ipcMain.on("shake-device", (_event, arg) => {
    console.log("Showing react-native debug menu", arg)
    const shakeDeviceProcess = childProcess.spawn(
      "adb",
      ["-s", arg, "shell", "input", "keyevent", "82"],
      {
        shell: true,
      }
    )
    shakeDeviceProcess.stdout.setEncoding("utf8")
    shakeDeviceProcess.stdout.on("data", (data) => {
      data = data.toString()
      console.log("Shaking Device Complete", data)
    })
  })

  // Now we need to start watching for android devices being plugged and unplugged
  const trackDevicesProcess = childProcess.spawn("adb", ["track-devices"], {
    shell: true,
  })
  trackDevicesProcess.on("error", (error) => {
    dialog.showMessageBox({
      title: "Android communication problem",
      type: "warning",
      message: "Error occurred running adb track-devices.\n" + error,
    })
  })
  trackDevicesProcess.stdout.setEncoding("utf8")
  trackDevicesProcess.stdout.on("data", (data) => {
    data = data.toString()
    console.log("Got adb track-devices output: ", data)
    ipcMain.emit("get-device-list")
  })
  trackDevicesProcess.stderr.setEncoding("utf8")
  trackDevicesProcess.stderr.on("data", (data) => {
    console.log(data)
  })
  trackDevicesProcess.on("close", (code) => {
    // Warn the user if the process closes.
    switch (code) {
      case 0:
        dialog.showMessageBox({
          title: "Closing adb track-devices",
          type: "info",
          message: "End process.\r\n",
        })
        break
    }
  })
}
