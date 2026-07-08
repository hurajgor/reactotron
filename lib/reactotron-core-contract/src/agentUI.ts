export interface AgentUiNode {
  testID: string
  type?: string
  text?: string
  label?: string
  role?: string
  visible?: boolean
  enabled?: boolean
  value?: unknown
  props?: Record<string, unknown>
  children?: AgentUiNode[]
}

export interface AgentUiSnapshot {
  route?: string
  screen?: string
  nodes: AgentUiNode[]
  metadata?: Record<string, unknown>
}

export interface AgentUiSnapshotRequestPayload {
  requestId: string
}

export interface AgentUiActionRequestPayload {
  requestId: string
  testID: string
  action: string
  value?: unknown
  args?: Record<string, unknown>
}

export interface AgentUiResponsePayload {
  requestId: string
  status: "success" | "error"
  action?: string
  testID?: string
  snapshot?: AgentUiSnapshot
  result?: unknown
  message?: string
}
