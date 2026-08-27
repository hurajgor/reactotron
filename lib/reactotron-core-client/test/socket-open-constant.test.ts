/**
 * In React Native, `ws` resolves to its browser shim: a throwing function with
 * no OPEN constant. Comparing readyState against WebSocket.OPEN then compares
 * against `undefined`, never matches, and every send is queued and schedules a
 * reconnect - regardless of isReady. Mock `ws` to reproduce that environment.
 */
jest.mock("ws", () => {
  const shim: any = function () {
    throw new Error("ws does not work in the browser")
  }
  return { __esModule: true, default: shim }
})

import { createClient } from "../src/reactotron-core-client"

test("sends when ws provides no OPEN constant, as in React Native", () => {
  const socket = {
    readyState: 1, // the standard OPEN value
    send: jest.fn(),
    close: jest.fn(),
    onopen: null as any,
    onclose: null as any,
    onerror: null as any,
    onmessage: null as any,
  }

  const client = createClient({
    createSocket: () => socket as any,
    getClientId: async () => "id",
  })

  client.connect()
  socket.onopen()

  client.send("log" as any, { level: "info", message: "hello" } as any, false)

  expect(socket.send).toHaveBeenCalled()
  expect((client as any).sendQueue.length).toBe(0)
})
