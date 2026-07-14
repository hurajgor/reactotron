import { CommandType } from "reactotron-core-contract"
import { createClient } from "../src/reactotron-core-client"
import WebSocket from "ws"
import { getPort } from "get-port-please"
import { createClosingServer } from "./create-closing-server"

const createSocket = (path) => new WebSocket(path)

let port: number
beforeEach(async () => {
  port = await getPort({ random: true })
})

test("starts unconnected", async () => {
  const client = createClient({ createSocket, port }) as any

  expect(client.connected).toBe(false)
})

test("connect returns itself", (done) => {
  createClosingServer(port, done)
  const client = createClient({ createSocket, port })
  const connectClient = client.connect()

  expect(connectClient).toBe(client)
})

test("set connected status when connecting", (done) => {
  createClosingServer(port, done)
  const client = createClient({ createSocket, port }) as any
  client.connect()

  expect(client.connected).toBe(true)
})

test("builds a socket", (done) => {
  createClosingServer(port, done)
  const client = createClient({ createSocket, port }) as any
  client.connect()

  expect(client.socket).toBeTruthy()
})

test("reconnects after an unexpected disconnect", (done) => {
  let server = new WebSocket.Server({ port })
  let connectionCount = 0
  let onConnectCount = 0

  server.on("connection", (socket) => {
    connectionCount += 1

    if (connectionCount === 1) {
      socket.close()
      server.close(() => {
        server = new WebSocket.Server({ port })
        server.on("connection", () => {
          server.close()
          client.close()
          done()
        })
      })
    }
  })

  const client = createClient({
    createSocket,
    port,
    reconnect: true,
    reconnectDelay: 20,
    onConnect: () => {
      onConnectCount += 1
      if (onConnectCount > 2) {
        client.close()
        server.close()
        done(new Error("connected too many times"))
      }
    },
  })

  client.connect()
})

test("does not reconnect after close", (done) => {
  const server = new WebSocket.Server({ port })
  let connectionCount = 0
  const client = createClient({
    createSocket,
    port,
    reconnect: true,
    reconnectDelay: 20,
    onConnect: () => {
      connectionCount += 1
      client.close()

      setTimeout(() => {
        expect(connectionCount).toBe(1)
        server.close()
        done()
      }, 60)
    },
  })

  client.connect()
})

test("queues sends while reconnecting and flushes after reconnect", (done) => {
  let server = new WebSocket.Server({ port })
  let connectionCount = 0
  const client = createClient({
    createSocket,
    port,
    reconnect: true,
    reconnectDelay: 20,
  })

  server.on("connection", (socket) => {
    connectionCount += 1

    if (connectionCount === 1) {
      socket.close()
      server.close(() => {
        client.send(CommandType.Display, { name: "queued.message", value: { ok: true } })

        server = new WebSocket.Server({ port })
        server.on("connection", (nextSocket) => {
          nextSocket.on("message", (message) => {
            const command = JSON.parse(message.toString())
            if (command.type === "client.intro") return

            expect(command.type).toBe(CommandType.Display)
            expect(command.payload).toEqual({ name: "queued.message", value: { ok: true } })
            client.close()
            server.close()
            done()
          })
        })
      })
    }
  })

  client.connect()
})
