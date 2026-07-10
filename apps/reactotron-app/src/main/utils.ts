import childProcess from "child_process"
import http from "http"
import { type BrowserWindow, dialog, ipcMain } from "electron"

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
