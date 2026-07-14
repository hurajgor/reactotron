import { useCallback, useReducer, useRef } from "react"
import { produce } from "immer"

export enum ActionTypes {
  ServerStarted = "SERVER_STARTED",
  ServerStopped = "SERVER_STOPPED",
  AddConnection = "ADD_CONNECTION",
  RemoveConnection = "REMOVE_CONNECTION",
  SyncConnections = "SYNC_CONNECTIONS",
  ClearConnectionCommands = "CLEAR_CONNECTION_COMMANDS",
  CommandReceived = "COMMAND_RECEIVED",
  ChangeSelectedClientId = "CHANGE_SELECTED_CLIENT_ID",
  PortUnavailable = "PORT_UNAVAILABLE",
}

export type ServerStatus = "stopped" | "portUnavailable" | "started"

export interface ReactotronConnection {
  // Stuff shipped from core-server
  id: number
  clientId: string

  // TODO: Nullable maybe?
  platform: "ios" | "android" | "browser"
  name?: string
  platformVersion?: string
  osRelease?: string
  userAgent?: string
}

export interface Connection extends ReactotronConnection {
  // Stuff that reactotron adds
  commands: any[]
  connected: boolean
}

interface State {
  serverStatus: ServerStatus
  connections: Connection[]
  selectedClientId: string
  orphanedCommands: any[] // Command[]
}

type Action =
  | { type: ActionTypes.ServerStarted; payload: undefined }
  | { type: ActionTypes.ServerStopped; payload: undefined }
  | {
      type: ActionTypes.AddConnection | ActionTypes.RemoveConnection
      payload: ReactotronConnection
    }
  | { type: ActionTypes.SyncConnections; payload: ReactotronConnection[] }
  | { type: ActionTypes.ChangeSelectedClientId; payload: string }
  | { type: ActionTypes.CommandReceived; payload: any } // TODO: Type this better!
  | { type: ActionTypes.ClearConnectionCommands }
  | { type: ActionTypes.PortUnavailable; payload: undefined }

export function reducer(state: State, action: Action) {
  switch (action.type) {
    case ActionTypes.ServerStarted:
      return produce(state, (draftState) => {
        draftState.serverStatus = "started"
      })
    case ActionTypes.ServerStopped:
      return produce(state, (draftState) => {
        draftState.serverStatus = "stopped"
      })
    case ActionTypes.AddConnection:
      return produce(state, (draftState) => {
        let existingConnection = draftState.connections.find(
          (c) => c.clientId === action.payload.clientId
        )

        if (existingConnection) {
          existingConnection.connected = true
        } else {
          existingConnection = {
            ...action.payload,
            commands: [],
            connected: true,
          }

          draftState.connections.push(existingConnection)
        }

        if (draftState.orphanedCommands.length > 0) {
          // TODO: Make this better... filtering this list twice probably is a terrible idea.
          const orphanedCommands = draftState.orphanedCommands.filter(
            (oc) => oc.connectionId === action.payload.id
          )

          // TODO: Consider if we need to do a one time sort of these... just in case.
          existingConnection.commands.push(...orphanedCommands)

          draftState.orphanedCommands = draftState.orphanedCommands.filter(
            (oc) => oc.connectionId !== action.payload.id
          )
        }

        // TODO: Figure out if we can stop having these dumb commands so early. Make core client only send once we actually have a client ID!

        const filteredConnections = draftState.connections.filter((c) => c.connected)

        if (filteredConnections.length === 1) {
          draftState.selectedClientId = filteredConnections[0].clientId
        }

        // Change the server status to started if it wasn't already
        draftState.serverStatus = "started"
      })
    case ActionTypes.RemoveConnection:
      return produce(state, (draftState) => {
        const existingConnection = draftState.connections.find(
          (c) => c.clientId === action.payload.clientId
        )

        if (!existingConnection) return

        existingConnection.connected = false

        if (draftState.selectedClientId === action.payload.clientId) {
          const filteredConnections = draftState.connections.filter((c) => c.connected)

          if (filteredConnections.length > 0) {
            draftState.selectedClientId = filteredConnections[0].clientId
          } else {
            draftState.selectedClientId = null
          }
        }
      })
    case ActionTypes.SyncConnections:
      return produce(state, (draftState) => {
        const liveConnections = new Map(
          action.payload.map((connection) => [connection.clientId, connection])
        )

        draftState.connections = draftState.connections.filter((connection) =>
          liveConnections.has(connection.clientId)
        )

        action.payload.forEach((connection) => {
          const existingConnection = draftState.connections.find(
            (candidate) => candidate.clientId === connection.clientId
          )

          if (existingConnection) {
            Object.assign(existingConnection, connection, { connected: true })
            return
          }

          draftState.connections.push({ ...connection, commands: [], connected: true })
        })

        if (!liveConnections.has(draftState.selectedClientId)) {
          draftState.selectedClientId = action.payload[0]?.clientId ?? null
        }
      })
    case ActionTypes.CommandReceived:
      return produce(state, (draftState) => {
        if (!action.payload.clientId) {
          draftState.orphanedCommands.push(action.payload)
          return
        }

        const connection = draftState.connections.find(
          (c) => c.clientId === action.payload.clientId
        )

        if (!connection) {
          console.error("Command received for unknown connection", action.payload)
          return
        }

        connection.commands = [action.payload, ...connection.commands]
      })
    case ActionTypes.ClearConnectionCommands:
      return produce(state, (draftState) => {
        if (!draftState.selectedClientId) return

        const selectedConnection = draftState.connections.find(
          (c) => c.clientId === draftState.selectedClientId
        )

        if (!selectedConnection) return

        selectedConnection.commands = []
      })
    case ActionTypes.ChangeSelectedClientId:
      return produce(state, (draftState) => {
        const selectedConnection = draftState.connections.find((c) => c.clientId === action.payload)

        if (!selectedConnection) return

        draftState.selectedClientId = action.payload
      })
    case ActionTypes.PortUnavailable:
      return produce(state, (draftState) => {
        console.error("Port unavailable!")
        draftState.serverStatus = "portUnavailable"
      })
    default:
      return state
  }
}

function useStandalone() {
  const commandListeners = useRef<((command: any) => void)[]>([])
  const [state, dispatch] = useReducer(reducer, {
    serverStatus: "stopped",
    connections: [],
    selectedClientId: null,
    orphanedCommands: [],
  })

  // Called when the server successfully starts
  const serverStarted = useCallback(() => {
    dispatch({ type: ActionTypes.ServerStarted, payload: undefined })
  }, [])

  // Called when the server stops
  const serverStopped = useCallback(() => {
    dispatch({ type: ActionTypes.ServerStopped, payload: undefined })
  }, [])

  // Called when we have client details. NOTE: Commands can start flying in before this gets called!
  const connectionEstablished = useCallback((connection: ReactotronConnection) => {
    dispatch({
      type: ActionTypes.AddConnection,
      payload: connection,
    })
  }, [])

  // Called when commands are flowing in.
  const commandReceived = useCallback((command: any) => {
    // First dispatch to update state
    dispatch({ type: ActionTypes.CommandReceived, payload: command })

    // Then notify listeners
    commandListeners.current.forEach((cl) => cl(command))
  }, [])

  // Called when a client disconnects. NOTE: They could be coming back. This could happen with a reload of the simulator!
  const connectionDisconnected = useCallback((connection: ReactotronConnection) => {
    dispatch({ type: ActionTypes.RemoveConnection, payload: connection })
  }, [])

  const syncConnections = useCallback((connections: ReactotronConnection[]) => {
    dispatch({ type: ActionTypes.SyncConnections, payload: connections })
  }, [])

  const clearSelectedConnectionCommands = useCallback(() => {
    dispatch({ type: ActionTypes.ClearConnectionCommands })
  }, [])

  const selectConnection = useCallback((clientId: string) => {
    dispatch({ type: ActionTypes.ChangeSelectedClientId, payload: clientId })
  }, [])

  const addCommandListener = useCallback((callback: (command: any) => void) => {
    commandListeners.current.push(callback)
  }, [])

  const portUnavailable = useCallback(() => {
    dispatch({ type: ActionTypes.PortUnavailable, payload: undefined })
  }, [])

  return {
    ...state,
    selectedConnection: state.connections.find((c) => c.clientId === state.selectedClientId),
    selectConnection,
    serverStarted,
    serverStopped,
    connectionEstablished,
    connectionDisconnected,
    syncConnections,
    commandReceived,
    clearSelectedConnectionCommands,
    addCommandListener,
    portUnavailable,
  }
}

export default useStandalone
