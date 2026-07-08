import trackGlobalLogs from "./trackGlobalLogs"

const originalConsole = {
  debug: console.debug,
  info: console.info,
  log: console.log,
  warn: console.warn,
}

afterEach(() => {
  console.debug = originalConsole.debug
  console.info = originalConsole.info
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  jest.restoreAllMocks()
})

test("tracks console.info as a Reactotron log", () => {
  const originalInfo = jest.fn()
  const reactotronSend = jest.fn()
  console.info = originalInfo

  const plugin = trackGlobalLogs()({
    debug: jest.fn(),
    log: jest.fn(),
    logImportant: jest.fn(),
    send: reactotronSend,
    warn: jest.fn(),
    error: jest.fn(),
  } as any)

  plugin.onConnect()
  console.info("received message", { formatName: "SOLD" })

  expect(originalInfo).toHaveBeenCalledWith("received message", { formatName: "SOLD" })
  expect(reactotronSend).toHaveBeenCalledWith(
    "log",
    { level: "info", message: ["received message", { formatName: "SOLD" }] },
    false
  )
})
