import { createLatestFrameProcessor } from "./latestFrameProcessor"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((_resolve) => {
    resolve = _resolve
  })
  return { promise, resolve }
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("createLatestFrameProcessor", () => {
  it("keeps only the latest frame while a frame is processing", async () => {
    const first = deferred()
    const processed: number[] = []
    const processor = createLatestFrameProcessor(async (frame: number) => {
      processed.push(frame)
      if (frame === 1) await first.promise
    })

    processor.push(1)
    processor.push(2)
    processor.push(3)

    expect(processed).toEqual([1])

    first.resolve()
    await flushPromises()

    expect(processed).toEqual([1, 3])
  })

  it("drops the pending frame when stopped", async () => {
    const first = deferred()
    const processed: number[] = []
    const processor = createLatestFrameProcessor(async (frame: number) => {
      processed.push(frame)
      await first.promise
    })

    processor.push(1)
    processor.push(2)
    processor.stop()
    first.resolve()
    await flushPromises()

    processor.push(3)
    expect(processed).toEqual([1])
  })

  it("continues after a frame fails", async () => {
    const processed: number[] = []
    const processor = createLatestFrameProcessor(async (frame: number) => {
      processed.push(frame)
      if (frame === 1) throw new Error("invalid frame")
    })

    processor.push(1)
    processor.push(2)
    await flushPromises()

    expect(processed).toEqual([1, 2])
  })
})
