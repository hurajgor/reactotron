import type { McpRedactionConfig } from "./mcpRedaction"

export type DebuggerJsEngine = "hermes" | "jsc" | "unknown"

/**
 * Optional React Native debugger details supplied by clients that can identify
 * the Metro instance their JavaScript bundle came from.
 */
export interface DebuggerMetadata {
  metro?: {
    host: string
    port: number
    protocol?: "http" | "https"
  }
  reactNativeVersion?: string
  jsEngine: DebuggerJsEngine
  platform: string
}

export interface ClientIntroPayload {
  name: string
  clientId?: string
  environment?: string
  reactotronVersion?: string
  /** React Native debugger identity details, when available. */
  debugger?: DebuggerMetadata
  /** Additional fields added by server on receipt */
  address?: string
  /** MCP redaction configuration from the client app */
  mcpRedaction?: McpRedactionConfig
}
