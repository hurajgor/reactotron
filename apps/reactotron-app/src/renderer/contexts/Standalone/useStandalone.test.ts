import { act, renderHook } from "@testing-library/react"

import useStandalone from "./useStandalone"

describe("contexts/Standalone/useStandalone", () => {
  describe("Server Handling", () => {
    it("should clear port unavailable when the server starts again", () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.portUnavailable()
      })

      expect(result.current.serverStatus).toEqual("portUnavailable")

      act(() => {
        result.current.serverStarted()
      })

      expect(result.current.serverStatus).toEqual("started")
      consoleErrorSpy.mockRestore()
    })
  })

  describe("Connection Handling", () => {
    it("should handle new connections and add them to our list", () => {
      const { result } = renderHook(() => useStandalone())

      expect(result.current.connections.length).toEqual(0)
      expect(result.current.selectedClientId).toEqual(null)

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.connections.length).toEqual(1)
      expect(result.current.connections[0]).toEqual({
        clientId: "1234",
        id: 0,
        platform: "ios",
        commands: [],
        connected: true,
      })
      expect(result.current.selectedClientId).toEqual("1234")
    })

    it("should not recreate an existing connection but should update the connected status", () => {
      const { result } = renderHook(() => useStandalone())

      expect(result.current.connections.length).toEqual(0)

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      act(() => {
        // Try and duplicate the connection
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.connections.length).toEqual(1)
      expect(result.current.connections[0]).toEqual({
        clientId: "1234",
        id: 0,
        platform: "ios",
        commands: [],
        connected: true,
      })
    })

    it("should grab orphaned commands for this connection", () => {
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.commandReceived({ connectionId: 0, payload: true })
      })

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.connections.length).toEqual(1)
      expect(result.current.orphanedCommands.length).toEqual(0)
      expect(result.current.connections[0].commands.length).toEqual(1)
      expect(result.current.connections[0].commands[0]).toEqual({
        connectionId: 0,
        payload: true,
      })
    })

    it("should not switch selected connections if there are more then one", () => {
      const { result } = renderHook(() => useStandalone())

      expect(result.current.selectedClientId).toEqual(null)

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual("1234")

      act(() => {
        result.current.connectionEstablished({
          clientId: "12345",
          id: 1,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual("1234")
    })

    it("should mark a connection as disconnected", () => {
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.connections[0].connected).toBeTruthy()

      act(() => {
        result.current.connectionDisconnected({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.connections[0].connected).toBeFalsy()
    })

    it("should reconcile stale connections with the server's live connections", () => {
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.connectionEstablished({ clientId: "stale", id: 0, platform: "ios" })
        result.current.connectionEstablished({ clientId: "live", id: 1, platform: "android" })
        result.current.selectConnection("stale")
      })

      act(() => {
        result.current.syncConnections([
          { clientId: "live", id: 1, platform: "android", name: "Connected device" },
        ])
      })

      expect(result.current.connections).toEqual([
        expect.objectContaining({ clientId: "live", connected: true, name: "Connected device" }),
      ])
      expect(result.current.selectedClientId).toEqual("live")
    })

    it("should not change the selected connection id if this was not the selected connection", () => {
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      act(() => {
        result.current.connectionEstablished({
          clientId: "567",
          id: 1,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual("1234")

      act(() => {
        result.current.connectionDisconnected({
          clientId: "567",
          id: 1,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual("1234")
    })

    it("should change the selected client id if there is another connection available", () => {
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      act(() => {
        result.current.connectionEstablished({
          clientId: "567",
          id: 1,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual("1234")

      act(() => {
        result.current.connectionDisconnected({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual("567")
    })

    it("should clear out the selected connection id if there are no other connections available", () => {
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual("1234")

      act(() => {
        result.current.connectionDisconnected({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual(null)
    })

    it("should not change to a client id that doesn't exist", () => {
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual("1234")

      act(() => {
        result.current.selectConnection("456")
      })

      expect(result.current.selectedClientId).toEqual("1234")
    })

    it("should change to a new selected connection", () => {
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      act(() => {
        result.current.connectionEstablished({
          clientId: "456",
          id: 1,
          platform: "ios",
        })
      })

      expect(result.current.selectedClientId).toEqual("1234")

      act(() => {
        result.current.selectConnection("456")
      })

      expect(result.current.selectedClientId).toEqual("456")
    })
  })

  describe("Command Handling", () => {
    it("should store commands without a client id as orphaned commands", () => {
      const { result } = renderHook(() => useStandalone())

      expect(result.current.orphanedCommands.length).toEqual(0)

      act(() => {
        result.current.commandReceived({ connectionId: 1, payload: true })
      })

      expect(result.current.orphanedCommands.length).toEqual(1)
      expect(result.current.orphanedCommands[0]).toEqual({ connectionId: 1, payload: true })
    })

    it("should clear commands from a connection", () => {
      const { result } = renderHook(() => useStandalone())

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      act(() => {
        result.current.commandReceived({ clientId: "1234", payload: true })
      })

      expect(result.current.connections[0].commands.length).toEqual(1)
      expect(result.current.connections[0].commands[0]).toEqual({ clientId: "1234", payload: true })

      act(() => {
        result.current.clearSelectedConnectionCommands()
      })

      expect(result.current.connections[0].commands.length).toEqual(0)
    })

    it("should add a command received listener and it should be called when a command is received", () => {
      const { result } = renderHook(() => useStandalone())
      const mockListener = jest.fn()

      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })

      act(() => {
        result.current.addCommandListener(mockListener)
      })

      act(() => {
        result.current.commandReceived({ clientId: "1234", payload: true })
      })

      expect(mockListener).toHaveBeenCalledWith({ clientId: "1234", payload: true })
    })
  })
  describe("Command Retention", () => {
    function establish(result: any) {
      act(() => {
        result.current.connectionEstablished({
          clientId: "1234",
          id: 0,
          platform: "ios",
        })
      })
    }

    it("should purge the oldest commands once the cap is reached", () => {
      const { result } = renderHook(() => useStandalone({ maxCommands: 3 }))
      establish(result)

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.commandReceived({ clientId: "1234", payload: i })
        }
      })

      const commands = result.current.connections[0].commands

      expect(commands.length).toEqual(3)
      // newest first, oldest two (0 and 1) dropped
      expect(commands.map((c: any) => c.payload)).toEqual([4, 3, 2])
    })

    it("should keep every command while under the cap", () => {
      const { result } = renderHook(() => useStandalone({ maxCommands: 10 }))
      establish(result)

      act(() => {
        for (let i = 0; i < 4; i++) {
          result.current.commandReceived({ clientId: "1234", payload: i })
        }
      })

      expect(result.current.connections[0].commands.length).toEqual(4)
    })

    it("should apply a lowered cap to commands already retained", () => {
      const { result, rerender } = renderHook(
        ({ maxCommands }) => useStandalone({ maxCommands }),
        { initialProps: { maxCommands: 10 } }
      )
      establish(result)

      act(() => {
        for (let i = 0; i < 8; i++) {
          result.current.commandReceived({ clientId: "1234", payload: i })
        }
      })

      expect(result.current.connections[0].commands.length).toEqual(8)

      rerender({ maxCommands: 2 })

      act(() => {
        result.current.commandReceived({ clientId: "1234", payload: 99 })
      })

      const commands = result.current.connections[0].commands
      expect(commands.length).toEqual(2)
      expect(commands.map((c: any) => c.payload)).toEqual([99, 7])
    })
  })
})
