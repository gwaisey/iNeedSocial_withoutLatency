import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  type SyntheticEvent,
} from "react"
import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  getKnownVideoAspectRatio,
  rememberVideoAspectRatio,
  VIDEO_READY_STATE_CURRENT_DATA,
} from "./auto-play-video-config"
import { scheduleFirstRenderableVideoFrame } from "./auto-play-video-frame"
import { buildVideoAspectRatio } from "./auto-play-video-state"

function clearQueuedVideoFrame(
  frameReadyCleanupRef: MutableRefObject<(() => void) | null>,
  hasQueuedFrameReadyRef: MutableRefObject<boolean>
) {
  frameReadyCleanupRef.current?.()
  frameReadyCleanupRef.current = null
  hasQueuedFrameReadyRef.current = false
}

function ensureVideoFrameReady({
  frameReadyCleanupRef,
  hasQueuedFrameReadyRef,
  setHasLoadedFrame,
  video,
}: {
  readonly frameReadyCleanupRef: MutableRefObject<(() => void) | null>
  readonly hasQueuedFrameReadyRef: MutableRefObject<boolean>
  readonly setHasLoadedFrame: Dispatch<SetStateAction<boolean>>
  readonly video: HTMLVideoElement
}) {
  if (hasQueuedFrameReadyRef.current) {
    return
  }

  hasQueuedFrameReadyRef.current = true
  frameReadyCleanupRef.current?.()
  frameReadyCleanupRef.current = scheduleFirstRenderableVideoFrame(video, () => {
    frameReadyCleanupRef.current = null
    hasQueuedFrameReadyRef.current = false
    setHasLoadedFrame(true)
  })
}

export function syncVideoMutedState(video: HTMLVideoElement, isMuted: boolean) {
  video.defaultMuted = isMuted
  video.muted = isMuted
  video.volume = isMuted ? 0 : 1
}

export function useVideoReadinessState({
  hasVideoSource,
  normalizedSrc,
  onLoadedMetadata,
  shouldMountVideo,
  videoRef,
}: {
  readonly hasVideoSource: boolean
  readonly normalizedSrc?: string
  readonly onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly shouldMountVideo: boolean
  readonly videoRef: RefObject<HTMLVideoElement | null>
}) {
  const frameReadyCleanupRef = useRef<(() => void) | null>(null)
  const hasQueuedFrameReadyRef = useRef(false)
  const lastReportedLoadIssueRef = useRef<string | null>(null)
  const lastReportedPlayIssueRef = useRef<string | null>(null)
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false)
  const [shellAspectRatio, setShellAspectRatio] = useState(
    () => getKnownVideoAspectRatio(normalizedSrc) ?? DEFAULT_VIDEO_ASPECT_RATIO
  )

  useEffect(() => {
    return () => {
      clearQueuedVideoFrame(frameReadyCleanupRef, hasQueuedFrameReadyRef)
    }
  }, [])

  useEffect(() => {
    clearQueuedVideoFrame(frameReadyCleanupRef, hasQueuedFrameReadyRef)
    setHasLoadedFrame(false)
    setShellAspectRatio(getKnownVideoAspectRatio(normalizedSrc) ?? DEFAULT_VIDEO_ASPECT_RATIO)
    lastReportedLoadIssueRef.current = null
    lastReportedPlayIssueRef.current = null
  }, [normalizedSrc])

  useEffect(() => {
    const video = videoRef.current
    if (
      !video ||
      !hasVideoSource ||
      !shouldMountVideo ||
      hasLoadedFrame ||
      video.readyState < VIDEO_READY_STATE_CURRENT_DATA
    ) {
      return
    }

    ensureVideoFrameReady({
      frameReadyCleanupRef,
      hasQueuedFrameReadyRef,
      setHasLoadedFrame,
      video,
    })
  }, [hasLoadedFrame, hasVideoSource, shouldMountVideo, videoRef])

  const handleLoadedData = (event: SyntheticEvent<HTMLVideoElement>) => {
    ensureVideoFrameReady({
      frameReadyCleanupRef,
      hasQueuedFrameReadyRef,
      setHasLoadedFrame,
      video: event.currentTarget,
    })
  }

  const handleLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    const learnedAspectRatio = buildVideoAspectRatio({
      videoHeight: event.currentTarget.videoHeight,
      videoWidth: event.currentTarget.videoWidth,
    })

    if (learnedAspectRatio) {
      rememberVideoAspectRatio(normalizedSrc, learnedAspectRatio)
      setShellAspectRatio(learnedAspectRatio)
    }

    onLoadedMetadata?.(event)
  }

  return {
    handleLoadedData,
    handleLoadedMetadata,
    hasLoadedFrame,
    lastReportedLoadIssueRef,
    lastReportedPlayIssueRef,
    queueFrameReady: (video: HTMLVideoElement) => {
      ensureVideoFrameReady({
        frameReadyCleanupRef,
        hasQueuedFrameReadyRef,
        setHasLoadedFrame,
        video,
      })
    },
    shellAspectRatio,
  }
}
