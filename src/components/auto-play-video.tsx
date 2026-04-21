import { useEffect, useId, useRef, useState, type RefObject, type SyntheticEvent } from "react"
import {
  getNormalizedVideoSource,
  getVideoPosterSource,
} from "./auto-play-video-config"
import {
  classifyVideoPlayError,
  reportVideoLoadIssue,
  reportVideoPlayIssue,
  useVideoCandidateLifecycle,
  useVideoPrewarmMount,
  useVideoSourceLifecycleReset,
} from "./auto-play-video-lifecycle"
import { syncVideoMutedState, useVideoReadinessState } from "./auto-play-video-readiness"
import {
  getVideoPlaybackDecision,
  shouldEarlyLoadNearViewport,
  shouldEnsureViewportData,
  shouldForceAutoPreload,
} from "./auto-play-video-state"
import { useMountedVideoViewportState } from "./auto-play-video-viewport"

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
  const hasForcedPreloadRef = useRef(false)
  const hasEnsuredViewportDataRef = useRef(false)
  const [canUseAutoPreload, setCanUseAutoPreload] = useState(false)
  const [isPlaybackOwner, setIsPlaybackOwner] = useState(false)
  const [shouldMountVideo, setShouldMountVideo] = useState(false)
  const {
    distanceToViewport,
    isInViewport,
    isNearViewport,
    isVisible,
    playbackPriority,
  } = useMountedVideoViewportState({
    hasVideoSource,
    scrollRootRef,
    shellRef,
    shouldMountVideo,
  })
  const {
    handleLoadedData,
    handleLoadedMetadata,
    hasLoadedFrame,
    lastReportedLoadIssueRef,
    lastReportedPlayIssueRef,
    queueFrameReady,
    shellAspectRatio,
  } = useVideoReadinessState({
    hasVideoSource,
    normalizedSrc,
    onLoadedMetadata,
    shouldMountVideo,
    videoRef,
  })

  useVideoCandidateLifecycle({
    canPrewarm,
    distanceToViewport,
    hasVideoSource,
    isActive,
    isVisible,
    playbackCandidateId,
    playbackPriority,
    preloadCandidateId,
    setCanUseAutoPreload,
    setIsPlaybackOwner,
    shouldMountVideo,
  })
  useVideoPrewarmMount({
    canPrewarm,
    hasVideoSource,
    setShouldMountVideo,
    shellRef,
  })
  useVideoSourceLifecycleReset({
    normalizedSrc,
    setCanUseAutoPreload,
    setIsPlaybackOwner,
    setShouldMountVideo,
    shouldResetViewportDataRef: hasEnsuredViewportDataRef,
    shouldResetWarmupRef: hasForcedPreloadRef,
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    syncVideoMutedState(video, isMuted)
  }, [isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasVideoSource || !shouldMountVideo) {
      return
    }

    const attemptVideoLoad = (stage: "near-viewport" | "prewarm" | "viewport") => {
      try {
        video.load()
      } catch (error) {
        reportVideoLoadIssue({
          distanceToViewport,
          error,
          isActive,
          isInViewport,
          isMuted,
          isVisible,
          lastReportedIssueRef: lastReportedLoadIssueRef,
          src: normalizedSrc,
          stage,
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
    lastReportedLoadIssueRef,
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

    if (!playbackDecision.shouldPlay || !video.paused) {
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
      if (!hasLoadedFrame) {
        queueFrameReady(video)
      }

      if (!shouldStartMuted) {
        return
      }

      syncVideoMutedState(video, isMuted)
    })

    playPromise.catch((error) => {
      reportVideoPlayIssue({
        classification: classifyVideoPlayError(error),
        distanceToViewport,
        error,
        isActive,
        isInViewport,
        isMuted,
        isVisible,
        lastReportedIssueRef: lastReportedPlayIssueRef,
        src: normalizedSrc,
      })
    })
  }, [
    distanceToViewport,
    hasLoadedFrame,
    hasVideoSource,
    isActive,
    isInViewport,
    isMuted,
    isPlaybackOwner,
    isVisible,
    lastReportedPlayIssueRef,
    normalizedSrc,
    queueFrameReady,
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
          onLoadedData={handleLoadedData}
          onLoadedMetadata={handleLoadedMetadata}
          playsInline
          poster={resolvedPoster}
          preload={canUseAutoPreload || isInViewport || isNearViewport || isVisible ? "auto" : "metadata"}
          src={normalizedSrc}
        />
      )}
    </div>
  )
}
