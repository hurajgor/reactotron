import childProcess from "child_process"
import fs from "fs"
import http from "http"
import net from "net"
import path from "path"
import {
  app,
  type BrowserWindow,
  BrowserWindow as ElectronBrowserWindow,
  dialog,
  ipcMain,
} from "electron"

type IOSSimulator = {
  name: string
  udid: string
  runtime: string
}

type IOSSimulatorCreationOption = {
  deviceTypeIdentifier: string
  name: string
  runtimeIdentifier: string
  runtimeName: string
}

const serveSimProcesses = new Map<
  string,
  { process: childProcess.ChildProcess; previewUrl: string }
>()
const iosSimulatorUdid = /^[A-Fa-f0-9-]{36}$/

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = childProcess.spawn(command, args, { shell: false })
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

async function getBootedIOSSimulators(): Promise<IOSSimulator[]> {
  const output = await runCommand("xcrun", ["simctl", "list", "devices", "--json"])
  const devices = JSON.parse(output).devices as Record<string, Array<Record<string, unknown>>>

  return Object.entries(devices)
    .filter(([runtime]) => runtime.includes("SimRuntime.iOS"))
    .flatMap(([runtime, runtimeDevices]) =>
      runtimeDevices
        .filter((device) => device.state === "Booted" && device.isAvailable !== false)
        .map((device) => ({
          name: String(device.name),
          udid: String(device.udid),
          runtime: runtime.replace("com.apple.CoreSimulator.SimRuntime.", ""),
        }))
    )
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

async function startServeSim(udid: string): Promise<{ previewUrl: string }> {
  const existingSurface = serveSimProcesses.get(udid)
  if (existingSurface && existingSurface.process.exitCode === null) {
    return { previewUrl: existingSurface.previewUrl }
  }

  const port = await getAvailablePort()
  const previewUrl = `http://127.0.0.1:${port}?device=${udid}&session=${Date.now()}`
  const serveSimProcess = childProcess.spawn(
    process.env.REACTOTRON_NODE_PATH || "node",
    [getServeSimCliPath(), "--port", String(port), "--codec", "auto", udid],
    { shell: false }
  )

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
        resolve({ previewUrl })
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

async function runServeSimCommand(args: string[]) {
  return runCommand(process.env.REACTOTRON_NODE_PATH || "node", [getServeSimCliPath(), ...args])
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
  ipcMain.handle("list-booted-ios-simulators", async () => {
    try {
      return { ok: true, simulators: await getBootedIOSSimulators() }
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
      const simulators = await getBootedIOSSimulators()
      if (!simulators.some((simulator) => simulator.udid === udid)) {
        throw new Error("That simulator is no longer booted.")
      }

      return { ok: true, ...(await startServeSim(udid)) }
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
        simulator: { name, runtime: option.runtimeName, udid },
        ...(await startServeSim(udid)),
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    "ios-simulator-surface-command",
    async (_event, udid: unknown, command: unknown) => {
      try {
        assertIOSSimulatorUdid(udid)
        if (command === "home") {
          await runServeSimCommand(["button", "home", "--device", udid])
        } else if (command === "landscape_left" || command === "portrait") {
          await runServeSimCommand(["rotate", command, "--device", udid])
        } else {
          throw new Error("Unsupported iOS simulator command.")
        }
        return { ok: true }
      } catch (error) {
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

      await runCommand("xcrun", ["simctl", "io", udid, "screenshot", result.filePath])
      return { ok: true, filePath: result.filePath }
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
