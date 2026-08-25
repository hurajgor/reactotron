import { createClient } from "../src/reactotron-core-client"

/**
 * `connected` gates scheduleReconnect. onOpen sets it true, but onClose only
 * cleared `isReady` - so the flag stayed true for the life of the client and
 * every close kept scheduling another attempt.
 */
function buildClient(socket: any) {
  return createClient({
    createSocket: () => socket as any,
    reconnect: true,
    reconnectDelay: 10,
    getClientId: async () => "client-id",
  })
}

function buildSocket() {
  return {
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
    onopen: null as any,
    onclose: null as any,
    onerror: null as any,
    onmessage: null as any,
  }
}

test("clears connected once the socket closes", () => {
  const socket = buildSocket()
  const client = buildClient(socket)

  client.connect()
  socket.onopen()

  expect((client as any).connected).toBe(true)

  socket.onclose()

  // a closed socket is not a connected client
  expect((client as any).connected).toBe(false)
})

test("stops scheduling reconnects after close", () => {
  jest.useFakeTimers()

  const socket = buildSocket()
  const client = buildClient(socket)

  client.connect()
  socket.onopen()
  socket.onclose()

  const attemptsAfterClose = (client as any).reconnectAttempts

  // a second close must not pile on another attempt
  socket.onclose()

  expect((client as any).reconnectAttempts).toBe(attemptsAfterClose)

  jest.useRealTimers()
})
