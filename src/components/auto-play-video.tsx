import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from "react"
import { reportRuntimeIssue } from "../utils/runtime-monitoring"
import {
  registerVideoPreloadCandidate,
  unregisterVideoPreloadCandidate,
  updateVideoPreloadCandidate,
} from "../utils/video-preload-budget"
import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  getKnownVideoAspectRatio,
  getNormalizedVideoSource,
  getVideoPosterSource,
  rememberVideoAspectRatio,
  VIDEO_EARLY_LOAD_DISTANCE_PX,
  VIDEO_PRELOAD_ROOT_MARGIN,
  VIDEO_READY_STATE_CURRENT_DATA,
} from "./auto-play-video-config"
import { scheduleFirstRenderableVideoFrame } from "./auto-play-video-frame"
import {
  buildVideoAspectRatio,
  deriveVideoViewportState,
  getVideoPlaybackDecision,
  getViewportBounds,
  shouldEarlyLoadNearViewport,
  shouldEnsureViewportData,
  shouldForceAutoPreload,
} from "./auto-play-video-state"
import {
  registerVideoPlaybackCandidate,
  unregisterVideoPlaybackCandidate,
  updateVideoPlaybackCandidate,
} from "./video-playback-coordinator"

type AutoPlayVideoProps = {
  readonly className: string
  readonly canPrewarm?: boolean
  readonly isActive?: boolean
  readonly isMuted: boolean
  readonly onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly placeholderClassName?: string
  readonly poster?: string
  readonly shellClassName?: string
  readonly skeletonClassName?: string
  readonly scrollRootRef?: RefObject<HTMLElement | null>
  readonly src?: string
}

type ViewportSubscriber = () => void

const viewportSubscribers = new Set<ViewportSubscriber>()
let viewportScrollHandler: (() => void) | null = null
let viewportAnimationFrame: number | null = null

function scheduleViewportSubscribers() {
  if (viewportAnimationFrame !== null) {
    return
  }

  viewportAnimationFrame = window.requestAnimationFrame(() => {
    viewportAnimationFrame = null
    viewportSubscribers.forEach((subscriber) => subscriber())
  })
}

function subscribeToViewportEvents(subscriber: ViewportSubscriber) {
  viewportSubscribers.add(subscriber)

  if (!viewportScrollHandler) {
    viewportScrollHandler = scheduleViewportSubscribers
    document.addEventListener("scroll", viewportScrollHandler, { passive: true, capture: true })
    window.addEventListener("scroll", viewportScrollHandler, { passive: true })
    window.addEventListener("resize", viewportScrollHandler)
  }

  return () => {
    viewportSubscribers.delete(subscriber)
    if (viewportSubscribers.size > 0 || !viewportScrollHandler) {
      return
    }

    document.removeEventListener("scroll", viewportScrollHandler, true)
    window.removeEventListener("scroll", viewportScrollHandler)
    window.removeEventListener("resize", viewportScrollHandler)
    viewportScrollHandler = null

    if (viewportAnimationFrame !== null) {
      window.cancelAnimationFrame(viewportAnimationFrame)
      viewportAnimationFrame = null
    }
  }
}

function classifyVideoPlayError(error: unknown): "blocked" | "interrupted" | "unexpected" {
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

export function AutoPlayVideo({
  className,
  canPrewarm = true,
  isActive = true,
  isMuted,
  onLoadedMetadata,
  placeholderClassName = "bg-ink/8",
  poster,
  shellClassName = "",
  skeletonClassName = "",
  scrollRootRef,
  src,
}: AutoPlayVideoProps) {
  const normalizedSrc = getNormalizedVideoSource(src)
  const resolvedPoster = getVideoPosterSource(normalizedSrc, poster)
  const hasVideoSource = Boolean(normalizedSrc)
  const preloadCandidateId = useId()
  const playbackCandidateId = useId()
  const shellRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const frameReadyCleanupRef = useRef<(() => void) | null>(null)
  const hasQueuedFrameReadyRef = useRef(false)
  const lastReportedLoadIssueRef = useRef<string | null>(null)
  const lastReportedPlayIssueRef = useRef<string | null>(null)
  const previousSourceRef = useRef(normalizedSrc)
  const wasVisibleRef = useRef(false)
  const [canUseAutoPreload, setCanUseAutoPreload] = useState(false)
  const [isPlaybackOwner, setIsPlaybackOwner] = useState(false)
  const [playbackPriority, setPlaybackPriority] = useState(Number.POSITIVE_INFINITY)
  const [distanceToViewport, setDistanceToViewport] = useState(Number.POSITIVE_INFINITY)
  const isNearViewport = distanceToViewport <= VIDEO_EARLY_LOAD_DISTANCE_PX
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false)
  const [isInViewport, setIsInViewport] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldMountVideo, setShouldMountVideo] = useState(false)
  const [shellAspectRatio, setShellAspectRatio] = useState(
    () => getKnownVideoAspectRatio(normalizedSrc) ?? DEFAULT_VIDEO_ASPECT_RATIO
  )
  const hasForcedPreloadRef = useRef(false)
  const hasEnsuredViewportDataRef = useRef(false)

  useEffect(() => {
    if (!hasVideoSource) {
      setCanUseAutoPreload(false)
      return
    }

    registerVideoPreloadCandidate(preloadCandidateId, setCanUseAutoPreload)

    return () => {
      unregisterVideoPreloadCandidate(preloadCandidateId)
    }
  }, [hasVideoSource, preloadCandidateId])

  useEffect(() => {
    if (!hasVideoSource) {
      setIsPlaybackOwner(false)
      return
    }

    registerVideoPlaybackCandidate(playbackCandidateId, setIsPlaybackOwner)

    return () => {
      unregisterVideoPlaybackCandidate(playbackCandidateId)
    }
  }, [hasVideoSource, playbackCandidateId])

  useEffect(() => {
    if (!hasVideoSource) {
      return
    }

    updateVideoPreloadCandidate(preloadCandidateId, {
      canPrewarm: canPrewarm && shouldMountVideo,
      distancePx: distanceToViewport,
    })
  }, [canPrewarm, distanceToViewport, hasVideoSource, preloadCandidateId, shouldMountVideo])

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

  useEffect(() => {
    if (!hasVideoSource) {
      return
    }

    const shell = shellRef.current
    if (!shell) {
      return
    }

    // Prewarm observer: large rootMargin to mount early, but do NOT use it for play/pause decisions.
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
  }, [canPrewarm, hasVideoSource])

  useEffect(() => {
    if (!hasVideoSource || !shouldMountVideo) {
      return
    }

    const shell = shellRef.current
    if (!shell) {
      return
    }

    const updateViewportState = () => {
      const root = scrollRootRef?.current ?? null
      const { top: rootTop, bottom: rootBottom } = getViewportBounds(root)
      const shellRect = shell.getBoundingClientRect()
      const nextViewportState = deriveVideoViewportState({
        rootBottom,
        rootTop,
        targetBottom: shellRect.bottom,
        targetTop: shellRect.top,
        wasVisible: wasVisibleRef.current,
      })

      wasVisibleRef.current = nextViewportState.isVisible
      setPlaybackPriority(nextViewportState.centerOffset)
      setDistanceToViewport(nextViewportState.distanceToViewport)
      setIsInViewport(nextViewportState.isInViewport)
      setIsVisible(nextViewportState.isVisible)
    }

    updateViewportState()
    const unsubscribe = subscribeToViewportEvents(updateViewportState)

    return () => {
      unsubscribe()
    }
  }, [hasVideoSource, scrollRootRef, shouldMountVideo])

  useEffect(() => {
    return () => {
      frameReadyCleanupRef.current?.()
      frameReadyCleanupRef.current = null
      hasQueuedFrameReadyRef.current = false
    }
  }, [])

  useEffect(() => {
    if (previousSourceRef.current === normalizedSrc) {
      return
    }

    previousSourceRef.current = normalizedSrc
    frameReadyCleanupRef.current?.()
    frameReadyCleanupRef.current = null
    hasQueuedFrameReadyRef.current = false
    setHasLoadedFrame(false)
    setShellAspectRatio(getKnownVideoAspectRatio(normalizedSrc) ?? DEFAULT_VIDEO_ASPECT_RATIO)
    setShouldMountVideo(false)
    setPlaybackPriority(Number.POSITIVE_INFINITY)
    setIsPlaybackOwner(false)
    setDistanceToViewport(Number.POSITIVE_INFINITY)
    setIsInViewport(false)
    setIsVisible(false)
    wasVisibleRef.current = false
    hasForcedPreloadRef.current = false
    hasEnsuredViewportDataRef.current = false
    lastReportedLoadIssueRef.current = null
    lastReportedPlayIssueRef.current = null
  }, [normalizedSrc])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.defaultMuted = isMuted
    video.muted = isMuted
    video.volume = isMuted ? 0 : 1
  }, [isMuted])

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

    if (hasQueuedFrameReadyRef.current) {
      return
    }

    hasQueuedFrameReadyRef.current = true
    frameReadyCleanupRef.current = scheduleFirstRenderableVideoFrame(video, () => {
      frameReadyCleanupRef.current = null
      hasQueuedFrameReadyRef.current = false
      setHasLoadedFrame(true)
    })
  }, [hasLoadedFrame, hasVideoSource, shouldMountVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasVideoSource || !shouldMountVideo) {
      return
    }

    const attemptVideoLoad = (stage: "near-viewport" | "prewarm" | "viewport") => {
      try {
        video.load()
      } catch (error) {
        const signature = `${stage}:${error instanceof Error ? `${error.name}:${error.message}` : String(error)}`

        if (lastReportedLoadIssueRef.current === signature) {
          return
        }

        lastReportedLoadIssueRef.current = signature
        reportRuntimeIssue({
          error,
          level: "warn",
          message:
            stage === "viewport"
              ? "Video viewport load failed."
              : "Video prewarm load failed.",
          metadata: {
            distanceToViewport,
            isActive,
            isInViewport,
            isMuted,
            isVisible,
            src: normalizedSrc,
            stage,
          },
          scope: "video-playback",
        })
      }
    }

    if (
      shouldEnsureViewportData({
        hasEnsuredViewportData: hasEnsuredViewportDataRef.current,
        isInViewport,
        isPaused: video.paused,
        readyState: video.readyState,
      })
    ) {
      // When a post is scrolled into view, ensure we have at least one frame so
      // placeholders can fade out even before autoplay kicks in.
      hasEnsuredViewportDataRef.current = true
      attemptVideoLoad("viewport")
      return
    }

    if (
      shouldEarlyLoadNearViewport({
        distanceToViewport,
        hasLoadedFrame,
        isActive,
        readyState: video.readyState,
      })
    ) {
      hasForcedPreloadRef.current = true
      attemptVideoLoad("near-viewport")
      return
    }

    if (
      !shouldForceAutoPreload({
        canUseAutoPreload,
        hasForcedPreload: hasForcedPreloadRef.current,
        isInViewport,
        isVisible,
        readyState: video.readyState,
      })
    ) {
      return
    }

    // Some browsers are conservative about upgrading `preload` after mount; force
    // a one-time load only for budget-selected prewarm candidates. Avoid doing
    // this while the video is visible/playing to prevent aborting playback.
    hasForcedPreloadRef.current = true
    attemptVideoLoad("prewarm")
  }, [
    canUseAutoPreload,
    distanceToViewport,
    hasLoadedFrame,
    hasVideoSource,
    isActive,
    isInViewport,
    isMuted,
    isVisible,
    normalizedSrc,
    shouldMountVideo,
  ])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasVideoSource) {
      return
    }

    const playbackDecision = getVideoPlaybackDecision({
      currentTime: video.currentTime,
      distanceToViewport,
      isActive,
      isInViewport,
      isPlaybackOwner,
      isPaused: video.paused,
      isVisible,
    })

    if (playbackDecision.shouldPause) {
      video.pause()
    }

    if (playbackDecision.shouldReset) {
      try {
        video.currentTime = 0
      } catch {
        // Ignore browsers that disallow currentTime changes before metadata loads.
      }
    }

    if (!playbackDecision.shouldPlay) {
      return
    }

    if (!video.paused) {
      return
    }

    const shouldStartMuted = !isMuted
    if (shouldStartMuted) {
      video.defaultMuted = true
      video.muted = true
      video.volume = 0
    }

    const playPromise = video.play()
    if (!playPromise || typeof playPromise.then !== "function") {
      return
    }

    playPromise.then(() => {
      if (!hasLoadedFrame && !hasQueuedFrameReadyRef.current) {
        hasQueuedFrameReadyRef.current = true
        frameReadyCleanupRef.current = scheduleFirstRenderableVideoFrame(video, () => {
          frameReadyCleanupRef.current = null
          hasQueuedFrameReadyRef.current = false
          setHasLoadedFrame(true)
        })
      }

      if (!shouldStartMuted) {
        return
      }

      video.defaultMuted = isMuted
      video.muted = isMuted
      video.volume = isMuted ? 0 : 1
    })
    playPromise.catch((error) => {
      const classification = classifyVideoPlayError(error)
      const signature =
        `${classification}:${error instanceof Error ? `${error.name}:${error.message}` : String(error)}`

      if (lastReportedPlayIssueRef.current === signature) {
        return
      }

      lastReportedPlayIssueRef.current = signature
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
          src: normalizedSrc,
          stage: "autoplay",
        },
        scope: "video-playback",
      })
    })
  }, [
    distanceToViewport,
    hasLoadedFrame,
    hasVideoSource,
    isActive,
    isInViewport,
    isPlaybackOwner,
    isMuted,
    isVisible,
    normalizedSrc,
    shouldMountVideo,
  ])

  return (
    <div
      ref={shellRef}
      className={`relative w-full overflow-hidden ${placeholderClassName} ${shellClassName}`}
      style={{ aspectRatio: shellAspectRatio }}
    >
      {!hasLoadedFrame && (
        <div
          className={`absolute inset-0 ${shouldMountVideo ? "" : "skeleton"} ${skeletonClassName} ${placeholderClassName}`}
        />
      )}
      {resolvedPoster && !hasLoadedFrame && (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          src={resolvedPoster}
        />
      )}
      {hasVideoSource && shouldMountVideo && (
        <video
          ref={videoRef}
          className={`${className} absolute inset-0 h-full w-full ${hasLoadedFrame ? "opacity-100" : "opacity-0"}`}
          loop
          muted={isMuted}
          onLoadedData={(event) => {
            if (!hasQueuedFrameReadyRef.current) {
              hasQueuedFrameReadyRef.current = true
              frameReadyCleanupRef.current = scheduleFirstRenderableVideoFrame(
                event.currentTarget,
                () => {
                  frameReadyCleanupRef.current = null
                  hasQueuedFrameReadyRef.current = false
                  setHasLoadedFrame(true)
                }
              )
            }
          }}
          onLoadedMetadata={(event) => {
            const learnedAspectRatio = buildVideoAspectRatio({
              videoHeight: event.currentTarget.videoHeight,
              videoWidth: event.currentTarget.videoWidth,
            })

            if (learnedAspectRatio) {
              rememberVideoAspectRatio(normalizedSrc, learnedAspectRatio)
              setShellAspectRatio(learnedAspectRatio)
            }

            onLoadedMetadata?.(event)
          }}
          playsInline
          poster={resolvedPoster}
          preload={canUseAutoPreload || isInViewport || isNearViewport || isVisible ? "auto" : "metadata"}
          src={normalizedSrc}
        />
      )}
    </div>
  )
}
