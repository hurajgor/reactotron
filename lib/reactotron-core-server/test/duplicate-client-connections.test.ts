import { getPort } from "get-port-please"
import { createServer } from "../src/reactotron-core-server"
import WebSocket from "ws"

let port: number
let server: ReturnType<typeof createServer>

beforeEach(async () => {
  port = await getPort({ random: true })
  server = createServer({ port })
})

afterEach(() => {
  server.stop()
})

const clientId = "auction-client"

function intro() {
  return JSON.stringify({ type: "client.intro", payload: { clientId } })
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Connect a client, send its intro, and resolve once the server has processed it.
 */
function connectAndIntroduce(): Promise<WebSocket> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://localhost:${port}`)
    const onCommand = () => {
      server.off("command", onCommand)
      resolve(socket)
    }
    server.on("command", onCommand)
    socket.on("open", () => socket.send(intro()))
  })
}

/**
 * When a client reconnects reusing its clientId, the server severs the stale
 * socket. That close is deferred through a timer, so passing the socket's bare
 * `close` method leaves `this` unbound - the timer throws instead of closing
 * anything, stranding the dead socket under the live client's id.
 */
test("closes the stale socket when a client reconnects with the same clientId", async () => {
  server.start()

  const first = await connectAndIntroduce()
  const second = await connectAndIntroduce()

  // the deferred close fires after 500ms
  await wait(1200)

  expect(first.readyState).toBe(WebSocket.CLOSED)
  expect(second.readyState).toBe(WebSocket.OPEN)

  second.close()
}, 15000)

/**
 * The deferred close runs on a timer, long after the message handler returned,
 * so a throw there surfaces as an unhandled exception rather than a failed send.
 */
test("does not throw while severing a duplicate connection", async () => {
  const uncaught = jest.fn()
  process.on("uncaughtException", uncaught)

  server.start()

  const first = await connectAndIntroduce()
  const second = await connectAndIntroduce()

  await wait(1200)

  process.removeListener("uncaughtException", uncaught)

  expect(uncaught).not.toHaveBeenCalled()

  first.close()
  second.close()
}, 15000)
