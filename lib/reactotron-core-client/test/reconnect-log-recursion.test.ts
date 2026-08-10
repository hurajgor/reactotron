import { createClient } from "../src/reactotron-core-client"

const originalConsoleLog = console.log

afterEach(() => {
  console.log = originalConsoleLog
})

/**
 * Reproduces the startup crash seen by consumers of the React Native client:
 * trackGlobalLogs patches console.log so it calls back into client.log(), and
 * client.send() logs a reconnect diagnostic whenever the socket is not ready.
 * Before the fix those two met and recursed until the JS stack blew up
 * ("RangeError: Maximum call stack size exceeded").
 */
test("send() on a not-ready socket does not recurse through a patched console.log", () => {
  const client = createClient({
    createSocket: () => ({ readyState: 0, send: () => undefined, close: () => undefined }) as any,
    onCommand: () => undefined,
    host: "localhost",
    port: 9999,
    name: "recursion-test",
    // logReconnect is a no-op unless reconnect is enabled.
    reconnect: true,
  })

  // Stand in for trackGlobalLogs' onConnect patch: console.log routes back
  // into the client, which sends, which logs again if the socket is down.
  console.log = (...args: any[]) => {
    originalConsoleLog(...args)
    client.send("log", { level: "debug", message: args } as any, false)
  }

  // The socket is never ready, so this takes the queue-and-log branch.
  expect(() => client.send("log", { level: "debug", message: "hello" } as any, false)).not.toThrow()
})
