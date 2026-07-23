import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { ipcRenderer } from "electron"
import {
  MdOutlineBugReport,
  MdOutlineChevronRight,
  MdOutlineCode,
  MdOutlineFolder,
  MdOutlineInsertDriveFile,
  MdOutlineRefresh,
  MdOutlineSearch,
} from "react-icons/md"
import { EmptyState, Header } from "@hurajgor/reactotron-core-ui"
import styled from "styled-components"

import StandaloneContext from "../../contexts/Standalone"

type SourceFile = { path: string; content?: string }
type SourceResponse = { ok: boolean; files?: SourceFile[]; message?: string }
type SourceContentResponse = { ok: boolean; content?: string; message?: string }
type DebuggerStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "paused"
  | "disconnecting"
  | "error"
type DebuggerStateEvent = {
  type?: unknown
  clientId?: unknown
  message?: unknown
}
type BreakpointResponse = { ok: boolean; breakpointId?: string; message?: string }

type FileTreeNode = {
  name: string
  path?: string
  children: Map<string, FileTreeNode>
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
`

const Workspace = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 18px 22px 28px;
  gap: 14px;
`

const Sidebar = styled.aside`
  display: flex;
  flex: 0 0 290px;
  min-width: 180px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 8px;
  background: ${(props) => props.theme.backgroundLighter};
`

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  color: ${(props) => props.theme.foreground};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`

const RefreshButton = styled.button`
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  place-items: center;
  color: ${(props) => props.theme.foregroundDark};
  background: transparent;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: ${(props) => props.theme.highlight};
    background: ${(props) => props.theme.background};
  }

  &:disabled {
    cursor: wait;
  }
`

const Search = styled.label`
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 10px;
  padding: 0 9px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 5px;
  color: ${(props) => props.theme.foregroundDark};
  background: ${(props) => props.theme.background};
`

const SearchInput = styled.input`
  min-width: 0;
  width: 100%;
  padding: 8px 0;
  border: 0;
  outline: none;
  color: ${(props) => props.theme.foreground};
  background: transparent;
  font-size: 13px;
`

const Tree = styled.div`
  overflow: auto;
  padding: 2px 6px 10px;
`

const TreeItem = styled.button<{ $depth: number; $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 5px 7px 5px ${(props) => 7 + props.$depth * 14}px;
  border: 0;
  border-radius: 4px;
  color: ${(props) => props.theme.foregroundDark};
  background: ${(props) => (props.$selected ? props.theme.background : "transparent")};
  text-align: left;
  cursor: pointer;

  &:hover {
    color: ${(props) => props.theme.foreground};
    background: ${(props) => props.theme.background};
  }
`

const TreeLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
`

const TreeIcon = styled.span`
  display: grid;
  flex: 0 0 16px;
  place-items: center;
`

const Viewer = styled.section`
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 8px;
  background: ${(props) => props.theme.background};
`

const SourceHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 49px;
  padding: 0 14px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  color: ${(props) => props.theme.foreground};
`

const SourcePath = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-family: Menlo, Monaco, Consolas, "Liberation Mono", monospace;
`

const DebuggerControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const DebuggerStatusLabel = styled.span<{ $status: DebuggerStatus }>`
  color: ${(props) =>
    props.$status === "connected"
      ? "#9ece6a"
      : props.$status === "error"
        ? "#f7768e"
        : props.theme.foregroundDark};
  font-size: 12px;
  white-space: nowrap;
`

const ConnectionButton = styled.button`
  padding: 6px 9px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 5px;
  color: ${(props) => props.theme.foreground};
  background: ${(props) => props.theme.backgroundLighter};
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${(props) => props.theme.highlight};
    color: ${(props) => props.theme.highlight};
  }

  &:disabled {
    cursor: wait;
    opacity: 0.7;
  }
`

const SourceArea = styled.div`
  flex: 1;
  overflow: auto;
  padding: 12px 0 20px;
  font-family: Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 1.65;
`

const SourceLine = styled.div`
  display: flex;
  min-width: max-content;
  padding-right: 18px;

  &:hover {
    background: ${(props) => props.theme.backgroundLighter};
  }
`

const Breakpoint = styled.button<{ $active: boolean; $pending: boolean }>`
  width: 31px;
  flex: 0 0 31px;
  padding: 0;
  border: 0;
  color: ${(props) => (props.$active ? "#f7768e" : props.theme.foregroundDark)};
  background: transparent;
  cursor: ${(props) => (props.$pending ? "wait" : "pointer")};

  &:hover:not(:disabled) {
    color: #f7768e;
  }

  &:disabled:not([data-pending="true"]) {
    cursor: not-allowed;
  }
`

const LineNumber = styled.span`
  width: 42px;
  flex: 0 0 42px;
  padding-right: 12px;
  color: ${(props) => props.theme.foregroundDark};
  text-align: right;
  user-select: none;
`

const Code = styled.code`
  color: ${(props) => props.theme.foreground};
  white-space: pre;
`

const InlineEmpty = styled.div`
  padding: 18px;
  color: ${(props) => props.theme.foregroundDark};
  font-size: 13px;
`

const DebuggerError = styled.div`
  padding: 0 14px 10px;
  color: #f7768e;
  font-size: 12px;
`

function isSourceFile(value: unknown): value is SourceFile {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as SourceFile).path === "string" &&
    Boolean((value as SourceFile).path)
  )
}

function readSourceResponse(value: unknown): SourceResponse {
  if (!value || typeof value !== "object" || typeof (value as SourceResponse).ok !== "boolean") {
    return { ok: false, message: "The debugger returned an invalid source response." }
  }

  const response = value as SourceResponse
  return {
    ok: response.ok,
    files: Array.isArray(response.files) ? response.files.filter(isSourceFile) : [],
    message: typeof response.message === "string" ? response.message : undefined,
  }
}

function readSourceContentResponse(value: unknown): SourceContentResponse {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as SourceContentResponse).ok !== "boolean"
  ) {
    return { ok: false, message: "The debugger returned an invalid source response." }
  }

  const response = value as SourceContentResponse
  return {
    ok: response.ok,
    content: typeof response.content === "string" ? response.content : undefined,
    message: typeof response.message === "string" ? response.message : undefined,
  }
}

function readBreakpointResponse(value: unknown): BreakpointResponse {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as BreakpointResponse).ok !== "boolean"
  ) {
    return { ok: false, message: "The debugger returned an invalid breakpoint response." }
  }

  const response = value as BreakpointResponse
  return {
    ok: response.ok,
    breakpointId: typeof response.breakpointId === "string" ? response.breakpointId : undefined,
    message: typeof response.message === "string" ? response.message : undefined,
  }
}

function buildTree(files: SourceFile[]): FileTreeNode {
  const root: FileTreeNode = { name: "", children: new Map() }

  files.forEach((file) => {
    const parts = file.path.replace(/\\/g, "/").split("/").filter(Boolean)
    if (!parts.length) return

    let node = root
    parts.forEach((part, index) => {
      let child = node.children.get(part)
      if (!child) {
        child = { name: part, children: new Map() }
        node.children.set(part, child)
      }
      if (index === parts.length - 1) child.path = file.path
      node = child
    })
  })

  return root
}

function SourceTree({
  node,
  depth = 0,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode
  depth?: number
  selectedPath?: string
  onSelect: (path: string) => void
}) {
  return (
    <>
      {Array.from(node.children.values())
        .sort((a, b) => Number(!a.path) - Number(!b.path) || a.name.localeCompare(b.name))
        .map((child) => {
          const isFile = Boolean(child.path)
          return (
            <React.Fragment key={child.path ?? `${depth}-${child.name}`}>
              <TreeItem
                type="button"
                $depth={depth}
                $selected={child.path === selectedPath}
                onClick={() => child.path && onSelect(child.path)}
                disabled={!isFile}
                title={child.path ?? child.name}
              >
                <TreeIcon>
                  {isFile ? <MdOutlineInsertDriveFile size={16} /> : <MdOutlineFolder size={16} />}
                </TreeIcon>
                <TreeLabel>{child.name}</TreeLabel>
                {!isFile && <MdOutlineChevronRight size={15} />}
              </TreeItem>
              {!isFile && (
                <SourceTree
                  node={child}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                />
              )}
            </React.Fragment>
          )
        })}
    </>
  )
}

function Debugger() {
  const { selectedConnection } = useContext(StandaloneContext)
  const selectedClientId = selectedConnection?.clientId
  const [files, setFiles] = useState<SourceFile[]>([])
  const [selectedPath, setSelectedPath] = useState<string>()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string>()
  const [debuggerStatus, setDebuggerStatus] = useState<DebuggerStatus>("disconnected")
  const [debuggerError, setDebuggerError] = useState<string>()
  const [breakpoints, setBreakpoints] = useState<Record<string, string>>({})
  const [pendingBreakpoint, setPendingBreakpoint] = useState<string>()
  const [sourceContentError, setSourceContentError] = useState<string>()
  const [isLoadingSourceContent, setIsLoadingSourceContent] = useState(false)
  const sourceRequest = useRef(0)
  const sourceContentRequest = useRef(0)
  const selectedConnectionRef = useRef(selectedConnection)
  selectedConnectionRef.current = selectedConnection

  const loadSources = useCallback(async () => {
    const connection = selectedConnectionRef.current
    if (!connection) return
    const requestId = ++sourceRequest.current
    setStatus("loading")
    setError(undefined)

    try {
      const response = readSourceResponse(
        await ipcRenderer.invoke("list-react-native-debugger-sources", connection)
      )
      if (!response.ok) throw new Error(response.message || "Could not load source files.")
      if (requestId !== sourceRequest.current) return

      const sourceFiles = response.files ?? []
      setFiles(sourceFiles)
      setSourceContentError(undefined)
      setSelectedPath((current) =>
        current && sourceFiles.some((file) => file.path === current)
          ? current
          : sourceFiles[0]?.path
      )
      setStatus("idle")
    } catch (loadError) {
      if (requestId !== sourceRequest.current) return
      setFiles([])
      setSelectedPath(undefined)
      setSourceContentError(undefined)
      setStatus("error")
      setError(loadError instanceof Error ? loadError.message : "Could not load source files.")
    }
  }, [])

  useEffect(() => {
    if (!selectedClientId) {
      sourceRequest.current += 1
      setFiles([])
      setSelectedPath(undefined)
      setSearch("")
      setSourceContentError(undefined)
      setStatus("idle")
      setError(undefined)
      return
    }
    loadSources()
  }, [loadSources, selectedClientId])

  useEffect(() => {
    const clientId = selectedConnection?.clientId
    setDebuggerStatus("disconnected")
    setDebuggerError(undefined)
    setBreakpoints({})
    setPendingBreakpoint(undefined)

    const onDebuggerState = (_event: Electron.IpcRendererEvent, event: DebuggerStateEvent) => {
      if (!event || event.clientId !== clientId || typeof event.type !== "string") return

      if (event.type === "connected") {
        setDebuggerStatus("connected")
        setDebuggerError(undefined)
      } else if (event.type === "paused") {
        setDebuggerStatus("paused")
      } else if (event.type === "resumed") {
        setDebuggerStatus("connected")
      } else if (event.type === "disconnected") {
        setDebuggerStatus("disconnected")
        setBreakpoints({})
      } else if (event.type === "error") {
        setDebuggerStatus("error")
        setDebuggerError(
          typeof event.message === "string" ? event.message : "React Native debugger failed."
        )
      }
    }

    ipcRenderer.on("react-native-debugger-state", onDebuggerState)
    return () => {
      ipcRenderer.removeListener("react-native-debugger-state", onDebuggerState)
    }
  }, [selectedConnection?.clientId])

  const connectDebugger = useCallback(async () => {
    if (!selectedConnection) return
    setDebuggerStatus("connecting")
    setDebuggerError(undefined)

    try {
      const response = readBreakpointResponse(
        await ipcRenderer.invoke("connect-react-native-debugger", selectedConnection)
      )
      if (!response.ok)
        throw new Error(response.message || "Could not connect the React Native debugger.")
      setDebuggerStatus("connected")
    } catch (connectError) {
      setDebuggerStatus("error")
      setDebuggerError(
        connectError instanceof Error
          ? connectError.message
          : "Could not connect the React Native debugger."
      )
    }
  }, [selectedConnection])

  const disconnectDebugger = useCallback(async () => {
    setDebuggerStatus("disconnecting")
    try {
      const response = readBreakpointResponse(
        await ipcRenderer.invoke("disconnect-react-native-debugger")
      )
      if (!response.ok)
        throw new Error(response.message || "Could not disconnect the React Native debugger.")
      setDebuggerStatus("disconnected")
      setBreakpoints({})
      setDebuggerError(undefined)
    } catch (disconnectError) {
      setDebuggerStatus("error")
      setDebuggerError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Could not disconnect the React Native debugger."
      )
    }
  }, [])

  const setExecutionState = useCallback(async (action: "pause" | "resume") => {
    try {
      const response = readBreakpointResponse(
        await ipcRenderer.invoke(`${action}-react-native-debugger`)
      )
      if (!response.ok) {
        throw new Error(response.message || `Could not ${action} the React Native debugger.`)
      }
    } catch (executionError) {
      setDebuggerError(
        executionError instanceof Error
          ? executionError.message
          : `Could not ${action} the React Native debugger.`
      )
    }
  }, [])

  const toggleBreakpoint = useCallback(
    async (path: string, line: number) => {
      if (debuggerStatus !== "connected") return
      const key = `${path}:${line}`
      if (pendingBreakpoint) return
      setPendingBreakpoint(key)
      setDebuggerError(undefined)

      try {
        const breakpointId = breakpoints[key]
        if (breakpointId) {
          const response = readBreakpointResponse(
            await ipcRenderer.invoke("remove-react-native-breakpoint", breakpointId)
          )
          if (!response.ok) throw new Error(response.message || "Could not remove breakpoint.")
          setBreakpoints((current) => {
            const next = { ...current }
            delete next[key]
            return next
          })
        } else {
          const response = readBreakpointResponse(
            await ipcRenderer.invoke("set-react-native-breakpoint", { path, line })
          )
          if (!response.ok || !response.breakpointId) {
            throw new Error(response.message || "Could not set breakpoint.")
          }
          setBreakpoints((current) => ({ ...current, [key]: response.breakpointId! }))
        }
      } catch (breakpointError) {
        setDebuggerError(
          breakpointError instanceof Error
            ? breakpointError.message
            : "Could not update breakpoint."
        )
      } finally {
        setPendingBreakpoint(undefined)
      }
    },
    [breakpoints, debuggerStatus, pendingBreakpoint]
  )

  const selectedFile = files.find((file) => file.path === selectedPath)

  useEffect(() => {
    const connection = selectedConnectionRef.current
    if (!connection || !selectedPath || typeof selectedFile?.content === "string") {
      setIsLoadingSourceContent(false)
      return
    }

    const requestId = ++sourceContentRequest.current
    setIsLoadingSourceContent(true)
    setSourceContentError(undefined)

    ipcRenderer
      .invoke("get-react-native-debugger-source-content", {
        clientId: connection.clientId,
        path: selectedPath,
      })
      .then(readSourceContentResponse)
      .then((response) => {
        if (requestId !== sourceContentRequest.current) return
        if (!response.ok || typeof response.content !== "string") {
          throw new Error(response.message || "Could not load source text.")
        }
        setFiles((current) =>
          current.map((file) =>
            file.path === selectedPath ? { ...file, content: response.content } : file
          )
        )
      })
      .catch((loadError) => {
        if (requestId !== sourceContentRequest.current) return
        setSourceContentError(
          loadError instanceof Error ? loadError.message : "Could not load source text."
        )
      })
      .finally(() => {
        if (requestId === sourceContentRequest.current) setIsLoadingSourceContent(false)
      })
  }, [selectedClientId, selectedFile?.content, selectedPath])

  const visibleFiles = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? files.filter((file) => file.path.toLowerCase().includes(query)) : files
  }, [files, search])
  const fileTree = useMemo(() => buildTree(visibleFiles), [visibleFiles])
  const debuggerStatusText =
    debuggerStatus === "connected"
      ? "Connected"
      : debuggerStatus === "paused"
        ? "Paused"
        : debuggerStatus === "connecting"
          ? "Connecting…"
          : debuggerStatus === "disconnecting"
            ? "Disconnecting…"
            : debuggerStatus === "error"
              ? "Connection error"
              : "Disconnected"
  const debuggerIsBusy = debuggerStatus === "connecting" || debuggerStatus === "disconnecting"

  return (
    <Container>
      <Header title="Debugger" isDraggable />
      {!selectedConnection ? (
        <EmptyState icon={MdOutlineBugReport} title="Select a React Native connection">
          Choose a connected app from the connection selector below to explore its source files.
        </EmptyState>
      ) : status === "loading" && !files.length ? (
        <EmptyState icon={MdOutlineCode} title="Loading source files">
          Reading original files from the selected React Native app.
        </EmptyState>
      ) : status === "error" ? (
        <EmptyState icon={MdOutlineBugReport} title="Could not load source files">
          {error}
        </EmptyState>
      ) : !files.length ? (
        <EmptyState icon={MdOutlineInsertDriveFile} title="No source files available">
          The selected app did not provide original source files yet.
        </EmptyState>
      ) : (
        <Workspace>
          <Sidebar>
            <PanelHeader>
              <span>Explorer</span>
              <RefreshButton
                type="button"
                onClick={() => {
                  loadSources()
                }}
                disabled={status === "loading"}
                title="Refresh source files"
                aria-label="Refresh source files"
              >
                <MdOutlineRefresh size={18} />
              </RefreshButton>
            </PanelHeader>
            <Search>
              <MdOutlineSearch size={17} />
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter files"
                aria-label="Filter source files"
              />
            </Search>
            <Tree>
              {visibleFiles.length ? (
                <SourceTree
                  node={fileTree}
                  selectedPath={selectedPath}
                  onSelect={setSelectedPath}
                />
              ) : (
                <InlineEmpty>No matching files.</InlineEmpty>
              )}
            </Tree>
          </Sidebar>
          <Viewer>
            {selectedFile ? (
              <>
                <SourceHeader>
                  <SourcePath title={selectedFile.path}>{selectedFile.path}</SourcePath>
                  <DebuggerControls>
                    <DebuggerStatusLabel $status={debuggerStatus}>
                      {debuggerStatusText}
                    </DebuggerStatusLabel>
                    {(debuggerStatus === "connected" || debuggerStatus === "paused") && (
                      <ConnectionButton
                        type="button"
                        onClick={() =>
                          setExecutionState(debuggerStatus === "paused" ? "resume" : "pause")
                        }
                      >
                        {debuggerStatus === "paused" ? "Resume" : "Pause"}
                      </ConnectionButton>
                    )}
                    <ConnectionButton
                      type="button"
                      onClick={() => {
                        if (debuggerStatus === "connected" || debuggerStatus === "paused")
                          disconnectDebugger()
                        else connectDebugger()
                      }}
                      disabled={debuggerIsBusy}
                    >
                      {debuggerStatus === "connected" || debuggerStatus === "paused"
                        ? "Disconnect"
                        : debuggerIsBusy
                          ? debuggerStatusText
                          : "Connect"}
                    </ConnectionButton>
                  </DebuggerControls>
                </SourceHeader>
                {debuggerError && <DebuggerError>{debuggerError}</DebuggerError>}
                {typeof selectedFile.content === "string" ? (
                  <SourceArea>
                    {selectedFile.content.split("\n").map((line, index) => (
                      <SourceLine key={`${index}-${line}`}>
                        {(() => {
                          const breakpointKey = `${selectedFile.path}:${index + 1}`
                          const active = Boolean(breakpoints[breakpointKey])
                          const pending = pendingBreakpoint === breakpointKey
                          const breakpointDisabled = debuggerStatus !== "connected" || pending
                          return (
                            <Breakpoint
                              type="button"
                              $active={active}
                              $pending={pending}
                              data-pending={pending}
                              disabled={breakpointDisabled}
                              onClick={() => toggleBreakpoint(selectedFile.path, index + 1)}
                              title={
                                pending
                                  ? "Updating breakpoint"
                                  : debuggerStatus !== "connected"
                                    ? "Connect the React Native debugger to add breakpoints"
                                    : active
                                      ? "Remove breakpoint"
                                      : "Add breakpoint"
                              }
                              aria-label={`${active ? "Remove" : "Add"} breakpoint at line ${index + 1}`}
                            >
                              {pending ? "…" : active ? "●" : "○"}
                            </Breakpoint>
                          )
                        })()}
                        <LineNumber>{index + 1}</LineNumber>
                        <Code>{line || " "}</Code>
                      </SourceLine>
                    ))}
                  </SourceArea>
                ) : (
                  <InlineEmpty>
                    {isLoadingSourceContent
                      ? "Loading source text…"
                      : sourceContentError || "Source text is not available for this file."}
                  </InlineEmpty>
                )}
              </>
            ) : (
              <InlineEmpty>Select a source file to view it.</InlineEmpty>
            )}
          </Viewer>
        </Workspace>
      )}
    </Container>
  )
}

export default Debugger
