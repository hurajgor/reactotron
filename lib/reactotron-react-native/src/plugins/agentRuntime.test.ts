import React from "react"

import agentRuntime from "./agentRuntime"

function createPlugin() {
  const sent: Array<{ type: string; payload: any }> = []
  const reactotron = {
    send: (type: string, payload: any) => {
      sent.push({ type, payload })
    },
  }

  return {
    plugin: agentRuntime()(reactotron as any),
    sent,
  }
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("agentRuntime", () => {
  test("automatically snapshots elements with testIDs", async () => {
    const { plugin, sent } = createPlugin()

    React.createElement("Pressable", {
      testID: "agent-auto-button",
      accessibilityRole: "button",
      children: "Save",
    })

    plugin.onCommand?.({
      type: "agent.ui.snapshot.request",
      payload: { requestId: "snapshot-1" },
    } as any)
    await flush()

    expect(sent[0].type).toBe("agent.ui.response")
    expect(sent[0].payload.status).toBe("success")
    expect(sent[0].payload.snapshot.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          testID: "agent-auto-button",
          role: "button",
          text: "Save",
        }),
      ])
    )
  })

  test("infers press from captured onPress props", async () => {
    const { plugin, sent } = createPlugin()
    const onPress = jest.fn(() => ({ pressed: true }))

    React.createElement("Pressable", {
      testID: "agent-auto-press",
      onPress,
    })

    plugin.onCommand?.({
      type: "agent.ui.action.request",
      payload: { requestId: "press-1", testID: "agent-auto-press", action: "press" },
    } as any)
    await flush()

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(sent[0].payload.status).toBe("success")
    expect(sent[0].payload.action).toBe("press")
  })

  test("infers fill from captured onChangeText props", async () => {
    const { plugin, sent } = createPlugin()
    const onChangeText = jest.fn()

    React.createElement("TextInput", {
      testID: "agent-auto-input",
      onChangeText,
    })

    plugin.onCommand?.({
      type: "agent.ui.action.request",
      payload: {
        requestId: "fill-1",
        testID: "agent-auto-input",
        action: "fill",
        value: "qa@example.com",
      },
    } as any)
    await flush()

    expect(onChangeText).toHaveBeenCalledWith("qa@example.com")
    expect(sent[0].payload.status).toBe("success")
    expect(sent[0].payload.action).toBe("fill")
  })
})
