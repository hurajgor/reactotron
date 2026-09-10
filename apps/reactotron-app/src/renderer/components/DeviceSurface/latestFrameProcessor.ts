export type LatestFrameProcessor<T> = {
  push: (frame: T) => void
  stop: () => void
}

/**
 * Process one frame at a time and retain only the newest frame received while
 * the processor is busy. This bounds decoder-owned memory when frames arrive
 * faster than Chromium can decode them.
 */
export function createLatestFrameProcessor<T>(
  processFrame: (frame: T) => Promise<void>
): LatestFrameProcessor<T> {
  let isProcessing = false
  let isStopped = false
  let hasPendingFrame = false
  let pendingFrame: T | undefined

  const drain = async (firstFrame: T) => {
    let frame = firstFrame
    isProcessing = true

    try {
      for (;;) {
        if (isStopped) return
        try {
          await processFrame(frame)
        } catch {
          // A corrupt or partial frame must not stop later frames from painting.
        }

        if (!hasPendingFrame) return
        frame = pendingFrame as T
        pendingFrame = undefined
        hasPendingFrame = false
      }
    } finally {
      isProcessing = false
    }
  }

  return {
    push(frame) {
      if (isStopped) return
      if (isProcessing) {
        pendingFrame = frame
        hasPendingFrame = true
        return
      }

      drain(frame).catch(() => undefined)
    },
    stop() {
      isStopped = true
      pendingFrame = undefined
      hasPendingFrame = false
    },
  }
}
