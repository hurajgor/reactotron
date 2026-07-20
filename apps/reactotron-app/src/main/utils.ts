import childProcess from "child_process"
import fs from "fs"
import http from "http"
import net from "net"
import path from "path"
import {
  app,
  type BrowserWindow,
  BrowserWindow as ElectronBrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
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
const iosSimulatorUdid = /^[A-Fa-f0-9-]{36}$/

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

async function captureAndroidDeviceScreenshot(deviceId: string) {
  assertAndroidDeviceId(deviceId)
  return new Promise<string>((resolve, reject) => {
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
      resolve(Buffer.concat(image).toString("base64"))
    })
  })
}

async function runAndroidDeviceCommand(
  deviceId: string,
  command: "home" | "back" | "recents" | "reload" | "reverse" | "tap",
  x?: number,
  y?: number,
  reactotronPort?: number
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
  if (!Number.isFinite(x) || !Number.isFinite(y) || x! < 0 || x! > 1 || y! < 0 || y! > 1) {
    throw new Error("Invalid Android tap coordinates.")
  }
  const size = await runCommand("adb", ["-s", deviceId, "shell", "wm", "size"])
  const match = size.match(/(?:Physical size|Override size):\s*(\d+)x(\d+)/)
  if (!match) throw new Error("Could not determine Android device screen size.")
  const width = Number(match[1])
  const height = Number(match[2])
  return runCommand("adb", [
    "-s",
    deviceId,
    "shell",
    "input",
    "tap",
    String(Math.round(x! * (width - 1))),
    String(Math.round(y! * (height - 1))),
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

export const setupSimulatorIPCCommands = () => {
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
      options?: { x?: unknown; y?: unknown; port?: unknown }
    ) => {
      try {
        assertAndroidDeviceId(deviceId)
        if (!["home", "back", "recents", "reload", "reverse", "tap"].includes(String(command))) {
          throw new Error("Unsupported Android device command.")
        }
        await runAndroidDeviceCommand(
          deviceId,
          command as "home" | "back" | "recents" | "reload" | "reverse" | "tap",
          Number(options?.x),
          Number(options?.y),
          Number(options?.port)
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
