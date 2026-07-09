import React, { useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  MdOutlineBolt,
  MdOutlineContentCopy,
  MdOutlineInput,
  MdOutlinePlayArrow,
  MdOutlineRefresh,
  MdOutlineSearch,
} from "react-icons/md"
import { clipboard } from "electron"
import styled from "styled-components"
import {
  ContentView,
  EmptyState,
  Header,
  ReactotronContext,
} from "reactotron-core-ui"
import type { AgentUiNode, AgentUiResponsePayload, AgentUiSnapshot } from "reactotron-core-contract"

type Status = "idle" | "loading" | "success" | "error"

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleLight};
`

const SearchBox = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 220px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  background-color: ${(props) => props.theme.background};
  color: ${(props) => props.theme.foregroundDark};
`

const SearchInput = styled.input`
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${(props) => props.theme.foreground};
  font-size: 13px;
`

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  background-color: ${(props) => props.theme.background};
  color: ${(props) => props.theme.foreground};
  font-size: 12px;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &:not(:disabled):hover {
    border-color: ${(props) => props.theme.highlight};
    background-color: ${(props) => props.theme.backgroundLighter};
  }
`

const Workspace = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(380px, 1fr) minmax(380px, 520px);
  min-height: 0;
  overflow: hidden;
`

const NodeList = styled.div`
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid ${(props) => props.theme.chromeLine};
`

const NodeRow = styled.button<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
  min-height: 62px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid ${(props) => props.theme.line};
  border-left: 2px solid ${(props) => (props.$selected ? props.theme.highlight : "transparent")};
  outline: 0;
  background-color: ${(props) =>
    props.$selected ? "rgba(122, 162, 247, 0.18)" : "transparent"};
  color: ${(props) => props.theme.foreground};
  text-align: left;
  cursor: pointer;

  &:hover {
    background-color: ${(props) =>
      props.$selected ? "rgba(122, 162, 247, 0.22)" : props.theme.backgroundLighter};
  }
`

const NodeTitle = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 13px;
  }

  small {
    color: ${(props) => props.theme.foregroundDark};
    font-size: 11px;
  }
`

const Badge = styled.span<{ $muted?: boolean }>`
  align-self: center;
  padding: 3px 7px;
  border-radius: 999px;
  color: ${(props) => (props.$muted ? props.theme.foregroundDark : props.theme.support)};
  background-color: rgba(122, 162, 247, 0.08);
  font-size: 11px;
  font-weight: 700;
`

const Inspector = styled.aside`
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: ${(props) => props.theme.backgroundDarker};
`

const InspectorHeader = styled.div`
  padding: 14px 16px 12px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.background};
`

const Eyebrow = styled.div`
  margin-bottom: 6px;
  color: ${(props) => props.theme.foregroundDark};
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
`

const InspectorTitle = styled.strong`
  display: block;
  min-width: 0;
  overflow: hidden;
  color: ${(props) => props.theme.foreground};
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
`

const ActionBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  background-color: ${(props) => props.theme.backgroundSubtleLight};
`

const ScrollPane = styled.div`
  min-height: 0;
  overflow: auto;
  padding: 16px;
`

const FillInput = styled.input`
  min-height: 34px;
  width: 180px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.chromeLine};
  border-radius: 7px;
  outline: 0;
  background-color: ${(props) => props.theme.background};
  color: ${(props) => props.theme.foreground};
`

const StatusLine = styled.div<{ $tone?: "error" | "success" }>`
  padding: 8px 16px;
  border-bottom: 1px solid ${(props) => props.theme.chromeLine};
  color: ${(props) =>
    props.$tone === "error"
      ? props.theme.tag
      : props.$tone === "success"
        ? props.theme.support
        : props.theme.foregroundDark};
  background-color: ${(props) => props.theme.backgroundSubtleLight};
  font-size: 12px;
`

function createRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function flattenNodes(nodes: AgentUiNode[] = []): AgentUiNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children ?? [])])
}

function nodeSubtitle(node: AgentUiNode) {
  return [node.type, node.role, node.label || node.text || node.placeholder].filter(Boolean).join(" | ")
}

function nodeKey(node: AgentUiNode) {
  return node.testID ?? node.id ?? ""
}

function nodeTitle(node: AgentUiNode) {
  return node.testID ?? node.label ?? node.text ?? node.placeholder ?? node.id ?? "Runtime node"
}

function isFillable(node: AgentUiNode) {
  const type = String(node.type ?? "").toLowerCase()
  return type.includes("input") || type.includes("textinput")
}

function isPressable(node: AgentUiNode) {
  const type = String(node.type ?? "").toLowerCase()
  const role = String(node.role ?? "").toLowerCase()
  return role === "button" || type.includes("pressable") || type.includes("touchable") || type.includes("button")
}

function Agent() {
  const { addCommandListener, sendCommand } = useContext(ReactotronContext)
  const [snapshot, setSnapshot] = useState<AgentUiSnapshot | null>(null)
  const [selectedNodeKey, setSelectedNodeKey] = useState("")
  const [query, setQuery] = useState("")
  const [fillValue, setFillValue] = useState("")
  const [pendingRequestId, setPendingRequestId] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("Request a snapshot to inspect runtime testIDs.")

  const nodes = useMemo(() => flattenNodes(snapshot?.nodes ?? []), [snapshot])
  const filteredNodes = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return nodes
    return nodes.filter((node) =>
      `${node.id ?? ""} ${node.testID ?? ""} ${node.type ?? ""} ${node.label ?? ""} ${node.text ?? ""} ${node.role ?? ""} ${node.hint ?? ""} ${node.placeholder ?? ""}`
        .toLowerCase()
        .includes(needle)
    )
  }, [nodes, query])
  const selectedNode = nodes.find((node) => nodeKey(node) === selectedNodeKey) ?? filteredNodes[0] ?? null

  useEffect(() => {
    addCommandListener((command) => {
      if (command.type !== "agent.ui.response") return
      const payload = command.payload as AgentUiResponsePayload
      if (payload.requestId !== pendingRequestId) return

      setStatus(payload.status === "success" ? "success" : "error")
      setMessage(payload.message ?? `${payload.action ?? "snapshot"} ${payload.status}`)
      if (payload.snapshot) {
        setSnapshot(payload.snapshot)
      }
    })
  }, [addCommandListener, pendingRequestId])

  useEffect(() => {
    if (!pendingRequestId || status !== "loading") return () => {}

    const timeout = window.setTimeout(() => {
      setStatus("error")
      setMessage("No agent runtime response received. Verify the app is using the local reactotron-react-native build and has reloaded after install.")
    }, 2500)

    return () => window.clearTimeout(timeout)
  }, [pendingRequestId, status])

  const requestSnapshot = useCallback(() => {
    const requestId = createRequestId("agent-ui-snapshot")
    setPendingRequestId(requestId)
    setStatus("loading")
    setMessage("Requesting runtime snapshot...")
    sendCommand("agent.ui.snapshot.request", { requestId })
  }, [sendCommand])

  const runAction = useCallback((action: "press" | "fill") => {
    if (!selectedNode) return

    const requestId = createRequestId(`agent-ui-${action}`)
    setPendingRequestId(requestId)
    setStatus("loading")
    setMessage(`Running ${action} on ${nodeTitle(selectedNode)}...`)
    sendCommand("agent.ui.action.request", {
      requestId,
      testID: selectedNode.testID,
      selector: selectedNode.testID ? undefined : { id: selectedNode.id },
      action,
      value: action === "fill" ? fillValue : undefined,
      includeSnapshot: true,
    })
  }, [fillValue, selectedNode, sendCommand])

  return (
    <Container>
      <Header title="Agent" isDraggable />
      <Toolbar>
        <SearchBox>
          <MdOutlineSearch size={16} />
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search testID, label, text, role, placeholder"
          />
        </SearchBox>
        <ActionButton type="button" onClick={requestSnapshot}>
          <MdOutlineRefresh size={15} />
          Snapshot
        </ActionButton>
      </Toolbar>
      <StatusLine $tone={status === "error" ? "error" : status === "success" ? "success" : undefined}>
        {message}
      </StatusLine>
      <Workspace>
        <NodeList>
          {filteredNodes.length === 0 ? (
            <EmptyState icon={MdOutlineBolt} title="No Runtime Nodes">
              Connect an app with agentRuntime enabled, open a screen with testIDs or accessibility labels, then request a snapshot.
            </EmptyState>
          ) : (
            filteredNodes.map((node) => (
              <NodeRow
                key={nodeKey(node)}
                type="button"
                $selected={nodeKey(selectedNode ?? {}) === nodeKey(node)}
                onClick={() => setSelectedNodeKey(nodeKey(node))}
              >
                <NodeTitle>
                  <strong>{nodeTitle(node)}</strong>
                  <small>{nodeSubtitle(node)}</small>
                </NodeTitle>
                <Badge $muted={!node.enabled}>{node.enabled === false ? "disabled" : node.type ?? "node"}</Badge>
              </NodeRow>
            ))
          )}
        </NodeList>
        <Inspector>
          {selectedNode ? (
            <>
              <InspectorHeader>
                <Eyebrow>Runtime Node</Eyebrow>
                <InspectorTitle>{nodeTitle(selectedNode)}</InspectorTitle>
              </InspectorHeader>
              <ActionBar>
                <ActionButton
                  type="button"
                  disabled={!isPressable(selectedNode) || status === "loading"}
                  onClick={() => runAction("press")}
                >
                  <MdOutlinePlayArrow size={15} />
                  Press
                </ActionButton>
                <FillInput
                  value={fillValue}
                  onChange={(event) => setFillValue(event.target.value)}
                  placeholder="Fill text"
                />
                <ActionButton
                  type="button"
                  disabled={!isFillable(selectedNode) || status === "loading"}
                  onClick={() => runAction("fill")}
                >
                  <MdOutlineInput size={15} />
                  Fill
                </ActionButton>
                <ActionButton
                  type="button"
                  onClick={() => clipboard.writeText(JSON.stringify(selectedNode, null, 2))}
                >
                  <MdOutlineContentCopy size={15} />
                  Copy node
                </ActionButton>
              </ActionBar>
              <ScrollPane>
                <ContentView value={selectedNode} copyToClipboard={clipboard.writeText} />
              </ScrollPane>
            </>
          ) : (
            <EmptyState icon={MdOutlineBolt} title="Select A Node">
              Request a snapshot and choose a runtime node.
            </EmptyState>
          )}
        </Inspector>
      </Workspace>
    </Container>
  )
}

export default Agent
