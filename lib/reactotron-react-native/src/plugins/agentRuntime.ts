import type {
  AgentUiActionRequestPayload,
  AgentUiNode,
  AgentUiResponsePayload,
  AgentUiSnapshot,
  AgentUiSnapshotRequestPayload,
  Command,
} from "reactotron-core-contract"
import type { Plugin, ReactotronCore } from "reactotron-core-client"

export type AgentRuntimeActionHandler = (request: AgentUiActionRequestPayload) => unknown | Promise<unknown>
export type AgentRuntimeSnapshotProvider = () => AgentUiSnapshot | Promise<AgentUiSnapshot>

export interface AgentRuntimeOptions {
  /**
   * Automatically inspect mounted React fibers for testID/accessibility metadata
   * and infer actions from props such as onPress and onChangeText.
   */
  autoCapture?: boolean
  snapshot?: AgentRuntimeSnapshotProvider
  actions?: Record<string, AgentRuntimeActionHandler | Record<string, AgentRuntimeActionHandler>>
  nodes?: AgentUiNode[]
}

export interface AgentRuntimePlugin {
  setAgentRuntimeSnapshotProvider: (provider: AgentRuntimeSnapshotProvider) => void
  registerAgentRuntimeNode: (node: AgentUiNode) => void
  updateAgentRuntimeNode: (testID: string, patch: Partial<AgentUiNode>) => void
  unregisterAgentRuntimeNode: (testID: string) => void
  clearAgentRuntimeNodes: () => void
  registerAgentRuntimeAction: (
    testID: string,
    action: string,
    handler: AgentRuntimeActionHandler
  ) => void
  unregisterAgentRuntimeAction: (testID: string, action: string) => void
}

const actionKey = (testID: string, action: string) => `${testID}:${action}`
const AUTO_CAPTURE_KEY = "__REACTOTRON_AGENT_RUNTIME_CAPTURE__"

type CapturedElement = {
  node: AgentUiNode
  props: Record<string, any>
  seenAt: number
}

type AgentRuntimeGlobalState = {
  installed: boolean
  elements: Map<string, CapturedElement>
}

function getGlobalState(): AgentRuntimeGlobalState {
  const target = globalThis as any
  if (!target[AUTO_CAPTURE_KEY]) {
    target[AUTO_CAPTURE_KEY] = {
      installed: false,
      elements: new Map<string, CapturedElement>(),
    } satisfies AgentRuntimeGlobalState
  }

  return target[AUTO_CAPTURE_KEY]
}

function typeName(type: unknown) {
  if (typeof type === "string") return type
  if (typeof type === "function") return (type as any).displayName ?? (type as any).name ?? "Component"
  if (type && typeof type === "object") return (type as any).displayName ?? (type as any).name ?? "Component"
  return "Component"
}

function textFromChildren(children: unknown): string | undefined {
  if (typeof children === "string" || typeof children === "number") return String(children)
  if (Array.isArray(children)) {
    const text = children
      .map(textFromChildren)
      .filter(Boolean)
      .join("")
      .trim()
    return text || undefined
  }
  return undefined
}

function roleFromProps(props: Record<string, any>) {
  return props.accessibilityRole ?? props.role
}

function enabledFromProps(props: Record<string, any>) {
  return !(props.disabled || props.accessibilityState?.disabled)
}

function visibleFromProps(props: Record<string, any>) {
  return !(props.accessibilityElementsHidden || props.importantForAccessibility === "no-hide-descendants")
}

function nodeFromProps(type: unknown, props: Record<string, any>): AgentUiNode | null {
  const testID = props.testID
  if (typeof testID !== "string" || testID.length === 0) return null

  return {
    testID,
    type: typeName(type),
    text: textFromChildren(props.children),
    label: props.accessibilityLabel,
    role: roleFromProps(props),
    visible: visibleFromProps(props),
    enabled: enabledFromProps(props),
    value: props.value,
  }
}

function captureElement(type: unknown, props: Record<string, any> | null | undefined) {
  if (!props) return
  const node = nodeFromProps(type, props)
  if (!node) return

  getGlobalState().elements.set(node.testID, {
    node,
    props,
    seenAt: Date.now(),
  })
}

function installCreateElementCapture() {
  const state = getGlobalState()
  if (state.installed) return

  try {
    // Keep this as a runtime require so package consumers do not need a direct
    // React peer declaration beyond the app's normal React Native dependency.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require("react")
    const originalCreateElement = React.createElement
    if (typeof originalCreateElement !== "function") return

    React.createElement = function reactotronAgentCreateElement(
      type: unknown,
      props: Record<string, any>,
      ...children: unknown[]
    ) {
      captureElement(type, children.length > 0 ? { ...props, children } : props)
      return originalCreateElement.apply(this, [type, props, ...children])
    }

    state.installed = true
  } catch {
    // React may not be require-able in every runtime. Fiber capture can still work.
  }
}

function collectFiberNodes(): { nodes: AgentUiNode[]; elements: Map<string, CapturedElement> } {
  const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
  const elements = new Map<string, CapturedElement>()

  if (!hook?.renderers || typeof hook.getFiberRoots !== "function") {
    return { nodes: [], elements }
  }

  const visitFiber = (fiber: any) => {
    if (!fiber) return

    const props = fiber.memoizedProps ?? fiber.pendingProps
    const node = props ? nodeFromProps(fiber.elementType ?? fiber.type, props) : null
    if (node) {
      elements.set(node.testID, {
        node,
        props,
        seenAt: Date.now(),
      })
    }

    visitFiber(fiber.child)
    visitFiber(fiber.sibling)
  }

  for (const rendererId of hook.renderers.keys()) {
    const roots = hook.getFiberRoots(rendererId)
    for (const root of roots) {
      visitFiber(root.current)
    }
  }

  return { nodes: Array.from(elements.values()).map((entry) => entry.node), elements }
}

async function runInferredAction(
  elements: Map<string, CapturedElement>,
  request: AgentUiActionRequestPayload
) {
  const element = elements.get(request.testID) ?? getGlobalState().elements.get(request.testID)
  const props = element?.props

  if (!props) {
    throw new Error(`No mounted element with testID "${request.testID}" was found.`)
  }

  if (request.action === "press") {
    const handler = props.onPress ?? props.onClick
    if (typeof handler !== "function") {
      throw new Error(`Element "${request.testID}" does not expose an onPress handler.`)
    }

    return handler({
      nativeEvent: {
        target: request.testID,
      },
    })
  }

  if (request.action === "fill") {
    if (typeof props.onChangeText === "function") {
      return props.onChangeText(String(request.value ?? ""))
    }

    if (typeof props.onChange === "function") {
      return props.onChange({
        nativeEvent: {
          text: String(request.value ?? ""),
          target: request.testID,
        },
      })
    }

    throw new Error(`Element "${request.testID}" does not expose onChangeText or onChange.`)
  }

  throw new Error(`No inferred handler exists for action "${request.action}".`)
}

const agentRuntime = (options: AgentRuntimeOptions = {}) => <Client extends ReactotronCore = ReactotronCore>(
  reactotron: Client
) => {
  const autoCapture = options.autoCapture !== false
  let snapshotProvider = options.snapshot
  const nodes = new Map<string, AgentUiNode>()
  const actions = new Map<string, AgentRuntimeActionHandler>()

  if (autoCapture) {
    installCreateElementCapture()
  }

  ;(options.nodes ?? []).forEach((node) => nodes.set(node.testID, node))

  Object.entries(options.actions ?? {}).forEach(([testID, handlerOrMap]) => {
    if (typeof handlerOrMap === "function") {
      actions.set(actionKey(testID, "press"), handlerOrMap)
      return
    }

    Object.entries(handlerOrMap).forEach(([action, handler]) => {
      actions.set(actionKey(testID, action), handler)
    })
  })

  const sendResponse = (payload: AgentUiResponsePayload) => {
    reactotron.send("agent.ui.response", payload)
  }

  const buildSnapshot = async (): Promise<AgentUiSnapshot> => {
    if (snapshotProvider) return snapshotProvider()

    const fiberSnapshot = autoCapture ? collectFiberNodes() : { nodes: [], elements: new Map() }
    const capturedNodes = Array.from(getGlobalState().elements.values()).map((entry) => entry.node)
    const mergedNodes = new Map<string, AgentUiNode>()

    ;[...capturedNodes, ...fiberSnapshot.nodes, ...Array.from(nodes.values())].forEach((node) => {
      mergedNodes.set(node.testID, node)
    })

    return {
      nodes: Array.from(mergedNodes.values()),
      metadata: {
        autoCapture,
        fiberNodes: fiberSnapshot.nodes.length,
        capturedNodes: capturedNodes.length,
        manualNodes: nodes.size,
      },
    }
  }

  const handleSnapshot = async (payload: AgentUiSnapshotRequestPayload) => {
    try {
      sendResponse({
        requestId: payload.requestId,
        status: "success",
        snapshot: await buildSnapshot(),
      })
    } catch (error) {
      sendResponse({
        requestId: payload.requestId,
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleAction = async (payload: AgentUiActionRequestPayload) => {
    const handler = actions.get(actionKey(payload.testID, payload.action))

    try {
      const fiberSnapshot = autoCapture ? collectFiberNodes() : { nodes: [], elements: new Map() }
      const result = handler
        ? await handler(payload)
        : await runInferredAction(fiberSnapshot.elements, payload)

      sendResponse({
        requestId: payload.requestId,
        status: "success",
        action: payload.action,
        testID: payload.testID,
        result,
        snapshot: await buildSnapshot(),
      })
    } catch (error) {
      sendResponse({
        requestId: payload.requestId,
        status: "error",
        action: payload.action,
        testID: payload.testID,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    onCommand: (command: Command) => {
      if (command.type === "agent.ui.snapshot.request") {
        handleSnapshot(command.payload as AgentUiSnapshotRequestPayload)
      }

      if (command.type === "agent.ui.action.request") {
        handleAction(command.payload as AgentUiActionRequestPayload)
      }
    },
    features: {
      setAgentRuntimeSnapshotProvider: (provider: AgentRuntimeSnapshotProvider) => {
        snapshotProvider = provider
      },
      registerAgentRuntimeNode: (node: AgentUiNode) => {
        nodes.set(node.testID, node)
      },
      updateAgentRuntimeNode: (testID: string, patch: Partial<AgentUiNode>) => {
        nodes.set(testID, { testID, ...nodes.get(testID), ...patch })
      },
      unregisterAgentRuntimeNode: (testID: string) => {
        nodes.delete(testID)
      },
      clearAgentRuntimeNodes: () => {
        nodes.clear()
      },
      registerAgentRuntimeAction: (
        testID: string,
        action: string,
        handler: AgentRuntimeActionHandler
      ) => {
        actions.set(actionKey(testID, action), handler)
      },
      unregisterAgentRuntimeAction: (testID: string, action: string) => {
        actions.delete(actionKey(testID, action))
      },
    },
  } satisfies Plugin<Client>
}

export default agentRuntime
