import { getDebuggerMetadata } from "./getDebuggerMetadata"

describe("getDebuggerMetadata", () => {
  it("identifies Hermes and the Metro bundle origin", () => {
    expect(
      getDebuggerMetadata({
        platform: "ios",
        reactNativeVersion: "0.73.6",
        scriptURL: "http://[::1]:8081/index.bundle?platform=ios",
        hermesInternal: {},
      })
    ).toEqual({
      platform: "ios",
      reactNativeVersion: "0.73.6",
      jsEngine: "hermes",
      metro: { host: "[::1]", port: 8081, protocol: "http" },
    })
  })

  it("keeps the handshake usable when the source URL is unavailable", () => {
    expect(
      getDebuggerMetadata({
        platform: "android",
        reactNativeVersion: null,
        scriptURL: "file:///app/index.bundle",
      })
    ).toEqual({ platform: "android", jsEngine: "jsc" })
  })

  it("uses unknown for an unrecognized JavaScript runtime marker", () => {
    expect(
      getDebuggerMetadata({
        platform: "android",
        reactNativeVersion: "0.73.6",
        hermesInternal: true,
      })
    ).toMatchObject({ jsEngine: "unknown" })
  })
})
