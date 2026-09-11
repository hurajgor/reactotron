import { parseArguments } from "../src/arguments"
import { eventsSince } from "../src/commands"

describe("CLI arguments", () => {
  test("accepts the optional agent namespace and global flags", () => {
    expect(parseArguments(["agent", "timeline", "--type", "log", "--json"])).toEqual({
      positionals: ["timeline"],
      flags: { type: "log", json: true },
    })
  })

  test("accepts negative numeric values", () => {
    expect(parseArguments(["ui", "scroll", "--y", "-400"]).flags.y).toBe("-400")
  })
})

describe("timeline polling", () => {
  test("returns events newer than the previous head", () => {
    const priorHead = JSON.stringify({ id: 2 })
    expect(eventsSince([{ id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }], priorHead)).toEqual([
      { id: 4 },
      { id: 3 },
    ])
  })

  test("does not replay the initial timeline", () => {
    expect(eventsSince([{ id: 2 }, { id: 1 }])).toEqual([])
  })
})
