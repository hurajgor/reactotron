export interface AgentUiNode {
  id?: string
  testID?: string
  type?: string
  text?: string
  label?: string
  role?: string
  hint?: string
  placeholder?: string
  visible?: boolean
  enabled?: boolean
  value?: unknown
  props?: Record<string, unknown>
  children?: AgentUiNode[]
}

export interface AgentUiSelector {
  id?: string
  testID?: string
  type?: string
  text?: string
  label?: string
  role?: string
  hint?: string
  placeholder?: string
  enabled?: boolean
  visible?: boolean
  index?: number
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
  testID?: string
  selector?: AgentUiSelector
  action: string
  value?: unknown
  args?: Record<string, unknown>
  includeSnapshot?: boolean
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
