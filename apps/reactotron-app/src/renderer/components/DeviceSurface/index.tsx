import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ipcRenderer } from "electron"
import {
  MdAdd,
  MdHome,
  MdOutlineLink,
  MdPhoneIphone,
  MdRefresh,
  MdRotateRight,
  MdScreenshot,
} from "react-icons/md"
import styled from "styled-components"

type Simulator = {
  name: string
  runtime: string
  udid: string
}

type SimulatorCreationOption = {
  deviceTypeIdentifier: string
  name: string
  runtimeName: string
}

type Surface = Simulator & {
  previewUrl: string
  orientation: "portrait" | "landscape_left"
}

type IPCResponse = {
  ok: boolean
  message?: string
}

const Panel = styled.aside<{ $isOpen: boolean; $isResizing: boolean; $width: number }>`
  display: flex;
  position: relative;
  flex: 0 0 ${(props) => (props.$isOpen ? `${props.$width}px` : "0")};
  width: ${(props) => (props.$isOpen ? `${props.$width}px` : "0")};
  min-width: ${(props) => (props.$isOpen ? "300px" : "0")};
  overflow: hidden;
  border-left: ${(props) => (props.$isOpen ? `1px solid ${props.theme.chromeLine}` : "0")};
  background-color: ${(props) => props.theme.background};
  transition: ${(props) =>
    props.$isResizing ? "none" : "width 150ms ease, flex-basis 150ms ease"};
`

const ResizeHandle = styled.div`
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  left: -3px;
  width: 6px;
  cursor: col-resize;

  &:hover,
  &:active {
    background-color: ${(props) => props.theme.highlight};
  }
`

const IconButton = styled.button`
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${(props) => props.theme.foregroundDark};
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: ${(props) => props.theme.backgroundLighter};
    color: ${(props) => props.theme.foreground};
  }

  &:disabled {
    cursor: wait;
    opacity: 0.55;
  }
`

const Content = styled.div`
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
`

const TabBar = styled.div`
  display: flex;
  min-height: 44px;
  align-items: stretch;
  gap: 3px;
  padding: 7px 44px 7px 8px;
  overflow-x: auto;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleLight};
`

const TabActions = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: 3px;
  margin-left: auto;
`

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  min-width: 0;
  max-width: 180px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid ${(props) => (props.$active ? props.theme.highlight : "transparent")};
  border-radius: 4px;
  background-color: ${(props) => (props.$active ? props.theme.backgroundLighter : "transparent")};
  color: ${(props) => (props.$active ? props.theme.foreground : props.theme.foregroundDark)};
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;

  &:hover {
    color: ${(props) => props.theme.foreground};
  }
`

const TabName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`

const ToolBar = styled.div`
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
`

const DeviceName = styled.div`
  overflow: hidden;
  color: ${(props) => props.theme.foregroundLight};
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Actions = styled.div`
  display: flex;
  gap: 3px;
`

const Preview = styled.iframe`
  width: 100%;
  min-height: 0;
  flex: 1;
  border: 0;
  background: #111217;
`

const PreviewContainer = styled.div`
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  background: #000;
`

const DevicePickerMask = styled.div`
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  width: 248px;
  height: 72px;
  background: #000;
`

const EmptyState = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px;
  text-align: center;
`

const EmptyIcon = styled(MdPhoneIphone)`
  margin-bottom: 14px;
  color: ${(props) => props.theme.highlight};
`

const EmptyTitle = styled.h2`
  margin: 0;
  color: ${(props) => props.theme.foregroundLight};
  font-size: 17px;
`

const EmptyCopy = styled.p`
  max-width: 270px;
  margin: 8px 0 20px;
  color: ${(props) => props.theme.foregroundDark};
  font-size: 13px;
  line-height: 1.45;
`

const DeviceSelect = styled.select`
  width: 100%;
  max-width: 300px;
  min-height: 34px;
  margin-bottom: 10px;
  padding: 0 9px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 4px;
  outline: none;
  background: ${(props) => props.theme.backgroundLighter};
  color: ${(props) => props.theme.foreground};
`

const PrimaryButton = styled.button`
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid ${(props) => props.theme.highlight};
  border-radius: 4px;
  background: ${(props) => props.theme.highlight};
  color: ${(props) => props.theme.background};
  cursor: pointer;
  font-weight: 700;

  &:disabled {
    cursor: wait;
    opacity: 0.6;
  }
`

const SecondaryButton = styled(PrimaryButton)`
  margin-top: 8px;
  border-color: ${(props) => props.theme.chromeLine};
  background: ${(props) => props.theme.backgroundLighter};
  color: ${(props) => props.theme.foregroundLight};
`

const Status = styled.p<{ $error: boolean }>`
  max-width: 300px;
  margin: 14px 0 0;
  color: ${(props) => (props.$error ? props.theme.warning : props.theme.foregroundDark)};
  font-size: 12px;
  line-height: 1.4;
`

function DeviceSurface({ isOpen }: { isOpen: boolean }) {
  const [isResizing, setIsResizing] = useState(false)
  const [panelWidth, setPanelWidth] = useState(400)
  const [simulators, setSimulators] = useState<Simulator[]>([])
  const [creationOptions, setCreationOptions] = useState<SimulatorCreationOption[]>([])
  const [surfaces, setSurfaces] = useState<Surface[]>([])
  const [activeUdid, setActiveUdid] = useState<string | null>(null)
  const [selectedUdid, setSelectedUdid] = useState("")
  const [selectedDeviceType, setSelectedDeviceType] = useState("")
  const [isChoosing, setIsChoosing] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [isError, setIsError] = useState(false)

  const activeSurface = useMemo(
    () => surfaces.find((surface) => surface.udid === activeUdid) ?? null,
    [activeUdid, surfaces]
  )

  const loadSimulators = useCallback(async () => {
    setIsLoading(true)
    const result = (await ipcRenderer.invoke("list-booted-ios-simulators")) as IPCResponse & {
      simulators: Simulator[]
    }
    setIsLoading(false)
    if (!result.ok) {
      setStatus(result.message || "Could not read iOS simulators.")
      setIsError(true)
      return
    }

    setSimulators(result.simulators)
    setSelectedUdid((current) =>
      result.simulators.some((simulator) => simulator.udid === current)
        ? current
        : result.simulators[0]?.udid || ""
    )
    setStatus(
      result.simulators.length === 0
        ? "No booted iOS simulators found. Boot one in Xcode, then refresh this panel."
        : ""
    )
    setIsError(false)
  }, [])

  const loadCreationOptions = useCallback(async () => {
    const result = (await ipcRenderer.invoke(
      "list-ios-simulator-creation-options"
    )) as IPCResponse & {
      options: SimulatorCreationOption[]
    }
    if (!result.ok) return

    setCreationOptions(result.options)
    setSelectedDeviceType((current) =>
      result.options.some((option) => option.deviceTypeIdentifier === current)
        ? current
        : result.options[0]?.deviceTypeIdentifier || ""
    )
  }, [])

  useEffect(() => {
    loadSimulators().catch(() => undefined)
    loadCreationOptions().catch(() => undefined)
  }, [loadCreationOptions, loadSimulators])

  const openSurface = async () => {
    const simulator = simulators.find((item) => item.udid === selectedUdid)
    if (!simulator) return

    const existingSurface = surfaces.find((surface) => surface.udid === simulator.udid)
    if (existingSurface) {
      setActiveUdid(existingSurface.udid)
      setIsChoosing(false)
      return
    }

    setIsLoading(true)
    setStatus("Starting secure local simulator preview...")
    setIsError(false)
    const result = (await ipcRenderer.invoke(
      "start-ios-simulator-surface",
      simulator.udid
    )) as IPCResponse & {
      previewUrl?: string
    }
    setIsLoading(false)
    if (!result.ok || !result.previewUrl) {
      setStatus(result.message || "Could not start the simulator preview.")
      setIsError(true)
      return
    }

    const surface: Surface = {
      ...simulator,
      previewUrl: result.previewUrl,
      orientation: "portrait",
    }
    setSurfaces((current) => [...current, surface])
    setActiveUdid(simulator.udid)
    setIsChoosing(false)
    setStatus("")
  }

  const createSurface = async () => {
    if (!selectedDeviceType) return

    setIsLoading(true)
    setStatus("Creating and booting iOS Simulator...")
    setIsError(false)
    const result = (await ipcRenderer.invoke(
      "create-ios-simulator-surface",
      selectedDeviceType
    )) as IPCResponse & { previewUrl?: string; simulator?: Simulator }
    setIsLoading(false)
    if (!result.ok || !result.previewUrl || !result.simulator) {
      setStatus(result.message || "Could not create the iOS simulator.")
      setIsError(true)
      return
    }

    const surface: Surface = {
      ...result.simulator,
      previewUrl: result.previewUrl,
      orientation: "portrait",
    }
    setSimulators((current) => [...current, result.simulator!])
    setSurfaces((current) => [...current, surface])
    setActiveUdid(surface.udid)
    setIsChoosing(false)
    setStatus("")
  }

  const runSurfaceCommand = async (command: "home" | "landscape_left" | "portrait") => {
    if (!activeSurface) return
    const result = (await ipcRenderer.invoke(
      "ios-simulator-surface-command",
      activeSurface.udid,
      command
    )) as IPCResponse
    if (!result.ok) {
      setStatus(result.message || "The simulator command failed.")
      setIsError(true)
      return
    }

    if (command !== "home") {
      setSurfaces((current) =>
        current.map((surface) =>
          surface.udid === activeSurface.udid ? { ...surface, orientation: command } : surface
        )
      )
    }
  }

  const reload = async () => {
    const result = (await ipcRenderer.invoke("reload-ios-simulator")) as IPCResponse
    setStatus(result.message || (result.ok ? "Reload requested." : "The reload request failed."))
    setIsError(!result.ok)
  }

  const reconnect = async () => {
    if (!activeSurface) return

    setStatus("Reconnecting simulator preview...")
    setIsError(false)
    const result = (await ipcRenderer.invoke(
      "reconnect-ios-simulator-surface",
      activeSurface.udid
    )) as IPCResponse & { previewUrl?: string }
    if (!result.ok || !result.previewUrl) {
      setStatus(result.message || "Could not reconnect the simulator preview.")
      setIsError(true)
      return
    }

    setSurfaces((current) =>
      current.map((surface) =>
        surface.udid === activeSurface.udid
          ? { ...surface, previewUrl: result.previewUrl! }
          : surface
      )
    )
    setStatus("")
  }

  const saveScreenshot = async () => {
    if (!activeSurface) return
    const result = (await ipcRenderer.invoke(
      "save-ios-simulator-screenshot",
      activeSurface.udid
    )) as IPCResponse & {
      canceled?: boolean
      filePath?: string
    }
    if (!result.canceled) {
      setStatus(
        result.message ||
          (result.ok ? `Saved screenshot to ${result.filePath}` : "Could not save screenshot.")
      )
      setIsError(!result.ok)
    }
  }

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsResizing(true)
    const startX = event.clientX
    const startWidth = panelWidth
    const maxWidth = Math.max(340, window.innerWidth - 350)

    const resize = (moveEvent: PointerEvent) => {
      setPanelWidth(Math.min(maxWidth, Math.max(340, startWidth - (moveEvent.clientX - startX))))
    }
    const finishResize = () => {
      setIsResizing(false)
      window.removeEventListener("pointermove", resize)
      window.removeEventListener("pointerup", finishResize)
    }

    window.addEventListener("pointermove", resize)
    window.addEventListener("pointerup", finishResize)
  }

  return (
    <Panel
      $isOpen={isOpen}
      $isResizing={isResizing}
      $width={panelWidth}
      aria-label="iOS simulator surface"
    >
      {isOpen && (
        <ResizeHandle role="separator" aria-orientation="vertical" onPointerDown={startResize} />
      )}
      {isOpen && (
        <Content>
          <TabBar>
            {surfaces.map((surface) => (
              <Tab
                key={surface.udid}
                type="button"
                $active={surface.udid === activeUdid && !isChoosing}
                onClick={() => {
                  setActiveUdid(surface.udid)
                  setIsChoosing(false)
                }}
                title={surface.name}
              >
                <MdPhoneIphone size={15} />
                <TabName>{surface.name}</TabName>
              </Tab>
            ))}
            <TabActions>
              <IconButton
                type="button"
                title="Add booted iOS simulator"
                onClick={() => {
                  setIsChoosing(true)
                  loadSimulators().catch(() => undefined)
                }}
              >
                <MdAdd size={19} />
              </IconButton>
            </TabActions>
          </TabBar>
          {activeSurface && !isChoosing ? (
            <>
              <ToolBar>
                <DeviceName title={`${activeSurface.name} ${activeSurface.runtime}`}>
                  {activeSurface.name}
                </DeviceName>
                <Actions>
                  <IconButton
                    type="button"
                    title="Home"
                    onClick={() => runSurfaceCommand("home").catch(() => undefined)}
                  >
                    <MdHome size={19} />
                  </IconButton>
                  <IconButton
                    type="button"
                    title="Reload app"
                    onClick={() => reload().catch(() => undefined)}
                  >
                    <MdRefresh size={18} />
                  </IconButton>
                  <IconButton
                    type="button"
                    title="Reconnect simulator preview"
                    onClick={() => reconnect().catch(() => undefined)}
                  >
                    <MdOutlineLink size={18} />
                  </IconButton>
                  <IconButton
                    type="button"
                    title="Rotate simulator"
                    onClick={() =>
                      runSurfaceCommand(
                        activeSurface.orientation === "portrait" ? "landscape_left" : "portrait"
                      ).catch(() => undefined)
                    }
                  >
                    <MdRotateRight size={18} />
                  </IconButton>
                  <IconButton
                    type="button"
                    title="Save screenshot"
                    onClick={() => saveScreenshot().catch(() => undefined)}
                  >
                    <MdScreenshot size={18} />
                  </IconButton>
                </Actions>
              </ToolBar>
              <PreviewContainer>
                <Preview
                  key={activeSurface.previewUrl}
                  src={activeSurface.previewUrl}
                  title={`${activeSurface.name} preview`}
                />
                <DevicePickerMask aria-hidden="true" />
              </PreviewContainer>
              {status && <Status $error={isError}>{status}</Status>}
            </>
          ) : (
            <EmptyState>
              <EmptyIcon size={34} />
              <EmptyTitle>Open a surface</EmptyTitle>
              <EmptyCopy>
                Choose a booted iOS Simulator to stream and control inside Reactotron.
              </EmptyCopy>
              <DeviceSelect
                aria-label="Booted iOS simulators"
                value={selectedUdid}
                disabled={isLoading || simulators.length === 0}
                onChange={(event) => setSelectedUdid(event.target.value)}
              >
                {simulators.map((simulator) => (
                  <option key={simulator.udid} value={simulator.udid}>
                    {simulator.name} ({simulator.runtime})
                  </option>
                ))}
              </DeviceSelect>
              <PrimaryButton
                type="button"
                disabled={!selectedUdid || isLoading}
                onClick={() => openSurface().catch(() => undefined)}
              >
                {isLoading ? "Opening..." : "Open iOS Simulator"}
              </PrimaryButton>
              {creationOptions.length > 0 && (
                <>
                  <DeviceSelect
                    aria-label="New iOS simulator type"
                    value={selectedDeviceType}
                    disabled={isLoading}
                    onChange={(event) => setSelectedDeviceType(event.target.value)}
                  >
                    {creationOptions.map((option) => (
                      <option key={option.deviceTypeIdentifier} value={option.deviceTypeIdentifier}>
                        New {option.name} ({option.runtimeName})
                      </option>
                    ))}
                  </DeviceSelect>
                  <SecondaryButton
                    type="button"
                    disabled={isLoading}
                    onClick={() => createSurface().catch(() => undefined)}
                  >
                    {isLoading ? "Creating..." : "Create iOS Simulator"}
                  </SecondaryButton>
                </>
              )}
              <Status $error={isError}>{status}</Status>
              <IconButton
                type="button"
                title="Refresh booted simulators"
                disabled={isLoading}
                onClick={() => loadSimulators().catch(() => undefined)}
              >
                <MdRefresh size={18} />
              </IconButton>
            </EmptyState>
          )}
        </Content>
      )}
    </Panel>
  )
}

export default DeviceSurface
