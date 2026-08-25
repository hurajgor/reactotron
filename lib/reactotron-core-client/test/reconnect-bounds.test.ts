import { createClient } from "../src/reactotron-core-client"

/**
 * Reconnects are gated on intent, not on socket state, so a client whose server
 * never comes back would otherwise retry forever - burning CPU, logging on every
 * attempt, and growing the send queue without bound.
 */
function buildSocket() {
  return {
    readyState: 0,
    send: jest.fn(),
    close: jest.fn(),
    onopen: null as any,
    onclose: null as any,
    onerror: null as any,
    onmessage: null as any,
  }
}

function buildClient(socket: any, options: any = {}) {
  return createClient({
    createSocket: () => socket as any,
    reconnect: true,
    reconnectDelay: 10,
    getClientId: async () => "client-id",
    ...options,
  })
}

afterEach(() => {
  jest.useRealTimers()
})

test("stops retrying once the attempt ceiling is reached", () => {
  jest.useFakeTimers()

  const socket = buildSocket()
  const client = buildClient(socket, { maxReconnectAttempts: 3 })

  client.connect()
  socket.onopen()

  // the server goes away and never returns
  for (let i = 0; i < 10; i++) {
    socket.onclose()
    jest.advanceTimersByTime(10000)
  }

  expect((client as any).reconnectAttempts).toBeLessThanOrEqual(3)
  expect((client as any).shouldReconnect).toBe(false)
})

test("backs off between attempts instead of retrying at a fixed rate", () => {
  jest.useFakeTimers()

  const socket = buildSocket()
  const client = buildClient(socket, { reconnectDelay: 100, maxReconnectAttempts: 5 })

  client.connect()
  socket.onopen()

  socket.onclose()
  const firstDelay = (client as any).currentReconnectDelay

  jest.advanceTimersByTime(firstDelay)
  socket.onclose()
  const secondDelay = (client as any).currentReconnectDelay

  expect(secondDelay).toBeGreaterThan(firstDelay)
})

test("resets the attempt count after a successful reconnect", () => {
  jest.useFakeTimers()

  const socket = buildSocket()
  const client = buildClient(socket, { maxReconnectAttempts: 5 })

  client.connect()
  socket.onopen()

  socket.onclose()
  jest.advanceTimersByTime(10000)

  expect((client as any).reconnectAttempts).toBeGreaterThan(0)

  // the server comes back
  socket.onopen()

  expect((client as any).reconnectAttempts).toBe(0)
  expect((client as any).shouldReconnect).toBe(true)
})

test("caps the send queue so an unreachable server cannot grow memory", () => {
  const socket = buildSocket()
  const client = buildClient(socket, { maxSendQueueSize: 50 })

  client.connect()

  // socket never opens, so every send queues
  for (let i = 0; i < 500; i++) {
    client.send("log" as any, { level: "info", message: `line ${i}` } as any, false)
  }

  expect((client as any).sendQueue.length).toBeLessThanOrEqual(50)
})

test("keeps the newest messages when the send queue overflows", () => {
  const socket = buildSocket()
  const client = buildClient(socket, { maxSendQueueSize: 5 })

  client.connect()

  for (let i = 0; i < 20; i++) {
    client.send("log" as any, { level: "info", message: `line ${i}` } as any, false)
  }

  const queue = (client as any).sendQueue as string[]

  expect(queue.length).toBe(5)
  // the most recent send survived; the oldest were dropped
  expect(queue[queue.length - 1]).toContain("line 19")
  expect(queue.some((entry) => entry.includes("line 0"))).toBe(false)
})
