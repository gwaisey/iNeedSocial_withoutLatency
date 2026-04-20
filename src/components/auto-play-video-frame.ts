type VideoFrameCallbackHandle = number

type VideoWithFrameCallback = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: VideoFrameCallbackHandle) => void
  requestVideoFrameCallback?: (
    callback: (
      now: DOMHighResTimeStamp,
      metadata: VideoFrameCallbackMetadata
    ) => void
  ) => VideoFrameCallbackHandle
}

export function scheduleFirstRenderableVideoFrame(
  video: HTMLVideoElement,
  onReady: () => void
) {
  let cancelled = false
  let animationFrameId: number | null = null
  let videoFrameCallbackHandle: VideoFrameCallbackHandle | null = null

  const markReady = () => {
    if (cancelled) {
      return
    }

    cancelled = true
    onReady()
  }

  const frameAwareVideo = video as VideoWithFrameCallback
  if (typeof frameAwareVideo.requestVideoFrameCallback === "function") {
    videoFrameCallbackHandle = frameAwareVideo.requestVideoFrameCallback(() => {
      markReady()
    })

    animationFrameId = window.requestAnimationFrame(() => {
      if (!cancelled) {
        markReady()
      }
    })
  } else {
    markReady()
  }

  return () => {
    cancelled = true

    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId)
    }

    if (
      videoFrameCallbackHandle !== null &&
      typeof frameAwareVideo.cancelVideoFrameCallback === "function"
    ) {
      frameAwareVideo.cancelVideoFrameCallback(videoFrameCallbackHandle)
    }
  }
}
