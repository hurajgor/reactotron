export type IOSSimulator = {
  name: string
  runtime: string
  state: string
  udid: string
  streaming?: boolean
}

export type IOSSimulatorCreationOption = {
  deviceTypeIdentifier: string
  name: string
  runtimeIdentifier: string
  runtimeName: string
}

export type DesktopHostResult = {
  ok: boolean
  message?: string
  [key: string]: unknown
}

/** Optional desktop-only operations supplied by an Electron host. */
export interface ReactotronDesktopHost {
  listIOSSimulators(): Promise<DesktopHostResult & { simulators?: IOSSimulator[] }>
  listIOSSimulatorCreationOptions(): Promise<DesktopHostResult & { options?: IOSSimulatorCreationOption[] }>
  openIOSSimulator(udid: string): Promise<DesktopHostResult>
  createIOSSimulator(deviceTypeIdentifier: string): Promise<DesktopHostResult>
  reconnectIOSSimulator(udid: string): Promise<DesktopHostResult>
  shutdownIOSSimulator(udid: string): Promise<DesktopHostResult>
  controlIOSSimulator(udid: string, command: "home" | "landscape_left" | "portrait"): Promise<DesktopHostResult>
  reloadIOSSimulator(): Promise<DesktopHostResult>
  toggleIOSSimulatorAppearance(udid: string): Promise<DesktopHostResult>
  captureIOSSimulatorScreenshot(udid: string): Promise<DesktopHostResult & {
    imageBase64?: string
    mimeType?: string
    filePath?: string
  }>
}
