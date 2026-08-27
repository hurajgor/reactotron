import { createClient } from "../src/reactotron-core-client"

/**
 * `isReady` is only set inside the getClientId promise callback. React Native
 * clients configured with an AsyncStorage handler resolve that asynchronously,
 * so the socket is open but `isReady` is still false in between. Anything sent
 * in that window - including the client.intro itself - is queued and triggers
 * a reconnect, which reopens and races again: a self-sustaining loop.
 */
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

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

test("is ready as soon as the socket opens, before getClientId settles", () => {
  const gate = deferred<string>()
  const socket = buildSocket()
  const client = createClient({
    createSocket: () => socket as any,
    getClientId: () => gate.promise,
  })

  client.connect()
  socket.onopen()

  // getClientId has NOT resolved yet - an open socket must still be usable
  expect((client as any).isReady).toBe(true)
})

test("does not queue commands sent while getClientId is pending", () => {
  const gate = deferred<string>()
  const socket = buildSocket()
  const client = createClient({
    createSocket: () => socket as any,
    getClientId: () => gate.promise,
  })

  client.connect()
  socket.onopen()

  client.send("log" as any, { level: "info", message: "during handshake" } as any, false)

  // the socket is open, so this goes out rather than piling into the queue
  expect((client as any).sendQueue.length).toBe(0)
})

test("does not schedule a reconnect while the socket is open", () => {
  const gate = deferred<string>()
  const socket = buildSocket()
  const client = createClient({
    createSocket: () => socket as any,
    reconnect: true,
    reconnectDelay: 10,
    getClientId: () => gate.promise,
  })

  client.connect()
  socket.onopen()

  client.send("log" as any, { level: "info", message: "during handshake" } as any, false)

  // a healthy open socket must never trigger the reconnect path
  expect((client as any).reconnectTimer).toBeNull()
})

test("flushes the queue through the socket that is actually open", async () => {
  const sockets: any[] = []
  const client = createClient({
    createSocket: () => {
      const s = buildSocket()
      sockets.push(s)
      return s as any
    },
    getClientId: async () => "id",
  })

  client.connect()
  sockets[0].onopen()
  await Promise.resolve()
  await Promise.resolve()

  // the intro reached the live socket
  expect(sockets[0].send).toHaveBeenCalled()
})
