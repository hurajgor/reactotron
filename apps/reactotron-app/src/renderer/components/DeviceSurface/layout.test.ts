import { TextDecoder, TextEncoder } from "util"

import {
  fitDeviceFrameToPane,
  parseSimulatorScreenConfigFrame,
  resolveDeviceFrameKind,
  resolveStreamRotation,
  resolveVisualScreenAspectRatio,
} from "./layout"

global.TextDecoder = TextDecoder as typeof global.TextDecoder
global.TextEncoder = TextEncoder as typeof global.TextEncoder

describe("fitDeviceFrameToPane", () => {
  it("keeps the complete phone frame inside a narrow pane", () => {
    const pane = { width: 260, height: 320 }
    const layout = fitDeviceFrameToPane(pane, 9 / 19.5, "phone")

    expect(layout).not.toBeNull()
    expect(layout?.width).toBeLessThanOrEqual(pane.width)
    expect(layout?.height).toBeLessThanOrEqual(pane.height)
  })

  it("uses the pane height when it is the limiting dimension", () => {
    const pane = { width: 1000, height: 500 }
    const layout = fitDeviceFrameToPane(pane, 9 / 19.5, "phone")

    expect(layout).not.toBeNull()
    expect(layout?.height).toBeLessThanOrEqual(pane.height)
    expect((layout?.width ?? 0) - (layout?.bezel ?? 0) * 2).toBeCloseTo(
      ((layout?.height ?? 0) - (layout?.bezel ?? 0) * 2) * (9 / 19.5),
      1
    )
  })

  it("grows with a larger pane instead of applying a separate width cap", () => {
    const compact = fitDeviceFrameToPane({ width: 300, height: 900 }, 9 / 19.5, "phone")
    const wide = fitDeviceFrameToPane({ width: 600, height: 1200 }, 9 / 19.5, "phone")

    expect(wide?.width).toBeGreaterThan(compact?.width ?? 0)
  })

  it("uses selected device names to choose phone and tablet frames", () => {
    expect(resolveDeviceFrameKind("iPhone 17 Pro", 0.75)).toBe("phone")
    expect(resolveDeviceFrameKind("iPad Pro", 0.47)).toBe("tablet")
  })

  it("uses the requested orientation when the stream has not swapped yet", () => {
    expect(resolveVisualScreenAspectRatio({ width: 390, height: 844 }, "portrait")).toBeCloseTo(
      390 / 844
    )
    expect(
      resolveVisualScreenAspectRatio({ width: 390, height: 844 }, "landscape_left")
    ).toBeCloseTo(844 / 390)
    expect(resolveStreamRotation({ width: 390, height: 844 }, "landscape_left")).toBe(90)
    expect(resolveStreamRotation({ width: 844, height: 390 }, "landscape_left")).toBe(0)
  })

  it("reads simulator configuration sent after a rotation", () => {
    const payload = new TextEncoder().encode(
      JSON.stringify({ width: 844, height: 390, orientation: "landscape_left" })
    )
    const frame = new Uint8Array(payload.length + 1)
    frame[0] = 130
    frame.set(payload, 1)

    expect(parseSimulatorScreenConfigFrame(frame)).toEqual({
      screenSize: { width: 844, height: 390 },
      orientation: "landscape_left",
    })
  })
})
