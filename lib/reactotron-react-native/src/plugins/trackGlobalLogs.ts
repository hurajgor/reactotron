import {
  type InferFeatures,
  type LoggerPlugin,
  type ReactotronCore,
  assertHasLoggerPlugin,
  type Plugin,
} from "reactotron-core-client"

/**
 * Track calls to console.log, console.info, console.warn, and console.debug and send them to Reactotron logger
 */
const trackGlobalLogs = () => (reactotron: ReactotronCore) => {
  assertHasLoggerPlugin(reactotron)
  const client = reactotron as ReactotronCore & InferFeatures<ReactotronCore, LoggerPlugin>
  const serializeArgs = (args: unknown[]) => (args.length === 1 ? args[0] : args)

  return {
    onConnect: () => {
      const originalConsoleLog = console.log
      console.log = (...args: Parameters<typeof console.log>) => {
        originalConsoleLog(...args)
        client.log(...args)
      }

      const originalConsoleInfo = console.info
      console.info = (...args: Parameters<typeof console.info>) => {
        originalConsoleInfo(...args)
        client.send("log", { level: "info", message: serializeArgs(args) as any }, false)
      }

      const originalConsoleWarn = console.warn
      console.warn = (...args: Parameters<typeof console.warn>) => {
        originalConsoleWarn(...args)
        client.warn(serializeArgs(args))
      }

      const originalConsoleDebug = console.debug
      console.debug = (...args: Parameters<typeof console.debug>) => {
        originalConsoleDebug(...args)
        client.debug(serializeArgs(args))
      }

      // console.error is taken care of by ./trackGlobalErrors.ts
    },
  } satisfies Plugin<ReactotronCore>
}

export default trackGlobalLogs
