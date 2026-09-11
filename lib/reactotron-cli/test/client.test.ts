import { ReactotronAgentClient, parseResponse } from "../src/client"

describe("ReactotronAgentClient", () => {
  test("parses an SSE JSON-RPC response", () => {
    expect(
      parseResponse(
        'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n',
        "text/event-stream"
      )
    ).toEqual([{ jsonrpc: "2.0", id: 1, result: { ok: true } }])
  })

  test("discovers the development port after the release port fails", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error("refused"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: { serverInfo: { name: "reactotron" } },
          }),
          { headers: { "content-type": "application/json" } }
        )
      )
    const client = new ReactotronAgentClient({ fetch: fetchMock })

    await expect(client.connect()).resolves.toMatchObject({
      endpoint: "http://127.0.0.1:4568/mcp",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("unwraps resource JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { contents: [{ text: '{"events":[{"type":"log"}]}' }] },
        }),
        { headers: { "content-type": "application/json" } }
      )
    )
    const client = new ReactotronAgentClient({ url: "http://localhost:9999", fetch: fetchMock })

    await expect(client.readResource("reactotron://timeline")).resolves.toEqual({
      events: [{ type: "log" }],
    })
  })
})
