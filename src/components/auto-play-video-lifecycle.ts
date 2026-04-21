import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react"
import { reportRuntimeIssue } from "../utils/runtime-monitoring"
import {
  registerVideoPreloadCandidate,
  type VideoPreloadDirection,
  unregisterVideoPreloadCandidate,
  updateVideoPreloadCandidate,
} from "../utils/video-preload-budget"
import {
  registerVideoPlaybackCandidate,
  unregisterVideoPlaybackCandidate,
  updateVideoPlaybackCandidate,
} from "./video-playback-coordinator"
import { VIDEO_PRELOAD_ROOT_MARGIN } from "./auto-play-video-config"

export function classifyVideoPlayError(error: unknown): "blocked" | "interrupted" | "unexpected" {
  if (!(error instanceof Error)) {
    return "unexpected"
  }

  if (error.name === "AbortError" || /interrupted/i.test(error.message)) {
    return "interrupted"
  }

  if (error.name === "NotAllowedError" || /autoplay|user didn'?t interact/i.test(error.message)) {
    return "blocked"
  }

  return "unexpected"
}

export function reportVideoLoadIssue({
  distanceToViewport,
  error,
  isActive,
  isInViewport,
  isMuted,
  isVisible,
  lastReportedIssueRef,
  src,
  stage,
}: {
  readonly distanceToViewport: number
  readonly error: unknown
  readonly isActive: boolean
  readonly isInViewport: boolean
  readonly isMuted: boolean
  readonly isVisible: boolean
  readonly lastReportedIssueRef: MutableRefObject<string | null>
  readonly src?: string
  readonly stage: "near-viewport" | "prewarm" | "viewport"
}) {
  const signature = `${stage}:${error instanceof Error ? `${error.name}:${error.message}` : String(error)}`
  if (lastReportedIssueRef.current === signature) {
    return
  }

  lastReportedIssueRef.current = signature
  reportRuntimeIssue({
    error,
    level: "warn",
    message: stage === "viewport" ? "Video viewport load failed." : "Video prewarm load failed.",
    metadata: {
      distanceToViewport,
      isActive,
      isInViewport,
      isMuted,
      isVisible,
      src,
      stage,
    },
    scope: "video-playback",
  })
}

export function reportVideoPlayIssue({
  classification,
  distanceToViewport,
  error,
  isActive,
  isInViewport,
  isMuted,
  isVisible,
  lastReportedIssueRef,
  src,
}: {
  readonly classification: "blocked" | "interrupted" | "unexpected"
  readonly distanceToViewport: number
  readonly error: unknown
  readonly isActive: boolean
  readonly isInViewport: boolean
  readonly isMuted: boolean
  readonly isVisible: boolean
  readonly lastReportedIssueRef: MutableRefObject<string | null>
  readonly src?: string
}) {
  const signature =
    `${classification}:${error instanceof Error ? `${error.name}:${error.message}` : String(error)}`
  if (lastReportedIssueRef.current === signature) {
    return
  }

  lastReportedIssueRef.current = signature
  reportRuntimeIssue({
    error,
    level: "warn",
    message:
      classification === "unexpected"
        ? "Unexpected video autoplay failure."
        : "Video autoplay was blocked or interrupted.",
    metadata: {
      classification,
      distanceToViewport,
      isActive,
      isInViewport,
      isMuted,
      isVisible,
      src,
      stage: "autoplay",
    },
    scope: "video-playback",
  })
}

export function useVideoCandidateLifecycle({
  canPrewarm,
  distanceToViewport,
  hasVideoSource,
  isActive,
  isVisible,
  playbackCandidateId,
  playbackPriority,
  preloadDirection,
  preloadCandidateId,
  setCanUseAutoPreload,
  setIsPlaybackOwner,
  shouldMountVideo,
}: {
  readonly canPrewarm: boolean
  readonly distanceToViewport: number
  readonly hasVideoSource: boolean
  readonly isActive: boolean
  readonly isVisible: boolean
  readonly playbackCandidateId: string
  readonly playbackPriority: number
  readonly preloadDirection: VideoPreloadDirection
  readonly preloadCandidateId: string
  readonly setCanUseAutoPreload: Dispatch<SetStateAction<boolean>>
  readonly setIsPlaybackOwner: Dispatch<SetStateAction<boolean>>
  readonly shouldMountVideo: boolean
}) {
  useEffect(() => {
    if (!hasVideoSource) {
      setCanUseAutoPreload(false)
      return
    }

    registerVideoPreloadCandidate(preloadCandidateId, setCanUseAutoPreload)
    return () => {
      unregisterVideoPreloadCandidate(preloadCandidateId)
    }
  }, [hasVideoSource, preloadCandidateId, setCanUseAutoPreload])

  useEffect(() => {
    if (!hasVideoSource) {
      setIsPlaybackOwner(false)
      return
    }

    registerVideoPlaybackCandidate(playbackCandidateId, setIsPlaybackOwner)
    return () => {
      unregisterVideoPlaybackCandidate(playbackCandidateId)
    }
  }, [hasVideoSource, playbackCandidateId, setIsPlaybackOwner])

  useEffect(() => {
    if (!hasVideoSource) {
      return
    }

    updateVideoPreloadCandidate(preloadCandidateId, {
      canPrewarm: canPrewarm && shouldMountVideo,
      distancePx: distanceToViewport,
      direction: preloadDirection,
    })
  }, [
    canPrewarm,
    distanceToViewport,
    hasVideoSource,
    preloadCandidateId,
    preloadDirection,
    shouldMountVideo,
  ])

  useEffect(() => {
    if (!hasVideoSource) {
      return
    }

    updateVideoPlaybackCandidate(playbackCandidateId, {
      priority: playbackPriority,
      shouldOwnPlayback: hasVideoSource && shouldMountVideo && isActive && isVisible,
    })
  }, [
    hasVideoSource,
    isActive,
    isVisible,
    playbackCandidateId,
    playbackPriority,
    shouldMountVideo,
  ])
}

export function useVideoPrewarmMount({
  canPrewarm,
  hasVideoSource,
  setShouldMountVideo,
  shellRef,
}: {
  readonly canPrewarm: boolean
  readonly hasVideoSource: boolean
  readonly setShouldMountVideo: Dispatch<SetStateAction<boolean>>
  readonly shellRef: RefObject<HTMLDivElement | null>
}) {
  useEffect(() => {
    if (!hasVideoSource) {
      return
    }

    const shell = shellRef.current
    if (!shell) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && canPrewarm) {
          setShouldMountVideo(true)
        }
      },
      {
        rootMargin: VIDEO_PRELOAD_ROOT_MARGIN,
        threshold: 0,
      }
    )

    observer.observe(shell)
    return () => {
      observer.disconnect()
    }
  }, [canPrewarm, hasVideoSource, setShouldMountVideo, shellRef])
}

export function useVideoSourceLifecycleReset({
  normalizedSrc,
  setCanUseAutoPreload,
  setHasAttachedSource,
  setIsPlaybackOwner,
  setShouldMountVideo,
  shouldResetViewportDataRef,
  shouldResetWarmupRef,
}: {
  readonly normalizedSrc?: string
  readonly setCanUseAutoPreload: Dispatch<SetStateAction<boolean>>
  readonly setHasAttachedSource: Dispatch<SetStateAction<boolean>>
  readonly setIsPlaybackOwner: Dispatch<SetStateAction<boolean>>
  readonly setShouldMountVideo: Dispatch<SetStateAction<boolean>>
  readonly shouldResetViewportDataRef: MutableRefObject<boolean>
  readonly shouldResetWarmupRef: MutableRefObject<boolean>
}) {
  const previousSourceRef = useRef(normalizedSrc)

  useEffect(() => {
    if (previousSourceRef.current === normalizedSrc) {
      return
    }

    previousSourceRef.current = normalizedSrc
    setCanUseAutoPreload(false)
    setHasAttachedSource(false)
    setIsPlaybackOwner(false)
    setShouldMountVideo(false)
    shouldResetWarmupRef.current = false
    shouldResetViewportDataRef.current = false
  }, [
    normalizedSrc,
    setCanUseAutoPreload,
    setHasAttachedSource,
    setIsPlaybackOwner,
    setShouldMountVideo,
    shouldResetViewportDataRef,
    shouldResetWarmupRef,
  ])
}
