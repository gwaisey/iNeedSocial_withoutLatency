import { useEffect, useId, useRef, useState, type RefObject, type SyntheticEvent } from "react"
import {
  getResolvedVideoSource,
  getVideoPosterSource,
  isHlsManifestSource,
  isDirectVideoFileSource,
  VIDEO_EARLY_LOAD_DISTANCE_PX,
} from "./auto-play-video-config"
import {
  classifyVideoPlayError,
  reportVideoLoadIssue,
  reportVideoPlayIssue,
  useVideoCandidateLifecycle,
  useVideoPrewarmMount,
  useVideoSourceLifecycleReset,
} from "./auto-play-video-lifecycle"
import { useVideoPreloadLink } from "./auto-play-video-preload-link"
import { syncVideoMutedState, useVideoReadinessState } from "./auto-play-video-readiness"
import {
  preloadHlsRuntime,
  useCloudflareStreamWarmup,
} from "./auto-play-video-stream-warmup"
import {
  getVideoPlaybackDecision,
  shouldAttachVideoSource,
} from "./auto-play-video-state"
import { useMountedVideoViewportState } from "./auto-play-video-viewport"

type AutoPlayVideoProps = {
  readonly className: string
  readonly canPrewarm?: boolean
  readonly isActive?: boolean
  readonly isMuted: boolean
  readonly onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly onPosterLoad?: (image: HTMLImageElement) => void
  readonly placeholderClassName?: string
  readonly poster?: string
  readonly shellClassName?: string
  readonly skeletonClassName?: string
  readonly scrollRootRef?: RefObject<HTMLElement | null>
  readonly src?: string
  readonly streamUid?: string
}

function canUseNativeHlsPlayback(video: HTMLVideoElement) {
  return Boolean(
    video.canPlayType("application/vnd.apple.mpegurl") ||
      video.canPlayType("application/x-mpegURL")
  )
}

export function AutoPlayVideo({
  className,
  canPrewarm = true,
  isActive = true,
  isMuted,
  onLoadedMetadata,
  onPosterLoad,
  placeholderClassName = "bg-ink/8",
  poster,
  shellClassName = "",
  skeletonClassName = "",
  scrollRootRef,
  src,
  streamUid,
}: AutoPlayVideoProps) {
  const resolvedSrc = getResolvedVideoSource(src, streamUid)
  const resolvedPoster = getVideoPosterSource(src, poster, streamUid)
  const hasVideoSource = Boolean(resolvedSrc)
  const preloadCandidateId = useId()
  const playbackCandidateId = useId()
  const shellRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const loadIssueContextRef = useRef({
    distanceToViewport: 0,
    isActive,
    isInViewport: false,
    isMuted,
    isVisible: false,
  })
  const sourceCleanupRef = useRef<(() => void) | null>(null)
  const hasPendingPlayAttemptRef = useRef(false)
  const hasIssuedLoadHintRef = useRef(false)
  const [autoPreloadRank, setAutoPreloadRank] = useState<number | null>(null)
  const [hasAttachedSource, setHasAttachedSource] = useState(false)
  const [hasConnectedPlaybackSource, setHasConnectedPlaybackSource] = useState(false)
  const [isPlaybackOwner, setIsPlaybackOwner] = useState(false)
  const [shouldMountVideo, setShouldMountVideo] = useState(false)
  const {
    distanceToViewport,
    isInViewport,
    isNearViewport,
    isVisible,
    playbackPriority,
    preloadDirection,
    visibleFraction,
  } = useMountedVideoViewportState({
    hasVideoSource,
    scrollRootRef,
    shellRef,
    shouldMountVideo,
  })
  const {
    handleLoadedData,
    handleLoadedMetadata,
    handlePosterLoad,
    hasLoadedFrame,
    lastReportedLoadIssueRef,
    lastReportedPlayIssueRef,
    queueFrameReady,
    shellAspectRatio,
  } = useVideoReadinessState({
    hasVideoSource,
    normalizedSrc: resolvedSrc,
    onLoadedMetadata,
    posterSrc: resolvedPoster,
    shouldMountVideo,
    videoRef,
  })

  useEffect(() => {
    loadIssueContextRef.current = {
      distanceToViewport,
      isActive,
      isInViewport,
      isMuted,
      isVisible,
    }
  }, [distanceToViewport, isActive, isInViewport, isMuted, isVisible])

  useVideoCandidateLifecycle({
    canPrewarm,
    distanceToViewport,
    hasVideoSource,
    isActive,
    isVisible,
    playbackCandidateId,
    playbackPriority,
    playbackVisibilityScore: visibleFraction,
    preloadDirection,
    preloadCandidateId,
    setAutoPreloadRank,
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
    normalizedSrc: resolvedSrc,
    setAutoPreloadRank,
    setHasAttachedSource,
    setIsPlaybackOwner,
    setShouldMountVideo,
    shouldResetViewportDataRef: hasPendingPlayAttemptRef,
    shouldResetWarmupRef: hasPendingPlayAttemptRef,
  })

  const canUseAutoPreload = autoPreloadRank !== null

  useVideoPreloadLink({
    candidateId: preloadCandidateId,
    enabled:
      canUseAutoPreload &&
      shouldMountVideo &&
      hasAttachedSource &&
      isDirectVideoFileSource(resolvedSrc),
    href: resolvedSrc,
  })

  const shouldRenderVideoSource =
    hasVideoSource &&
    shouldMountVideo &&
    shouldAttachVideoSource({
      canUseAutoPreload,
      hasAttachedSource,
      isInViewport,
      isNearViewport,
      isVisible,
    })
  const shouldWarmCloudflareStream =
    shouldMountVideo &&
    isHlsManifestSource(resolvedSrc) &&
    (canUseAutoPreload || isNearViewport || isInViewport || isVisible)
  const shouldDeepPrebufferCloudflareStream =
    autoPreloadRank === 0 &&
    preloadDirection === "below" &&
    !isInViewport &&
    distanceToViewport <= VIDEO_EARLY_LOAD_DISTANCE_PX

  useCloudflareStreamWarmup({
    deepPrebuffer: shouldDeepPrebufferCloudflareStream,
    enabled: shouldWarmCloudflareStream,
    manifestUrl: resolvedSrc,
  })

  useEffect(() => {
    if (!shouldRenderVideoSource || hasAttachedSource) {
      return
    }

    setHasAttachedSource(true)
  }, [hasAttachedSource, shouldRenderVideoSource])

  useEffect(() => {
    sourceCleanupRef.current?.()
    sourceCleanupRef.current = null
    setHasConnectedPlaybackSource(false)
  }, [resolvedSrc])

  useEffect(() => {
    hasIssuedLoadHintRef.current = false
  }, [resolvedSrc])

  useEffect(() => {
    return () => {
      sourceCleanupRef.current?.()
      sourceCleanupRef.current = null
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !resolvedSrc || !hasAttachedSource || !shouldRenderVideoSource) {
      return
    }

    let cancelled = false

    const bindDirectSource = () => {
      video.src = resolvedSrc
      setHasConnectedPlaybackSource(true)
      sourceCleanupRef.current = () => {
        video.pause()
        video.removeAttribute("src")
        try {
          video.load()
        } catch {
          // Ignore browsers that complain about detaching the current source.
        }
      }
    }

    sourceCleanupRef.current?.()
    sourceCleanupRef.current = null
    setHasConnectedPlaybackSource(false)

    if (!isHlsManifestSource(resolvedSrc) || canUseNativeHlsPlayback(video)) {
      bindDirectSource()
    } else {
      void preloadHlsRuntime()
        .then(({ default: Hls }) => {
          if (cancelled) {
            return
          }

          if (!Hls.isSupported()) {
            const context = loadIssueContextRef.current
            reportVideoLoadIssue({
              distanceToViewport: context.distanceToViewport,
              error: new Error("HLS playback is not supported by this browser."),
              isActive: context.isActive,
              isInViewport: context.isInViewport,
              isMuted: context.isMuted,
              isVisible: context.isVisible,
              lastReportedIssueRef: lastReportedLoadIssueRef,
              src: resolvedSrc,
              stage: context.isVisible
                ? "viewport"
                : context.isInViewport
                  ? "near-viewport"
                  : "prewarm",
            })
            return
          }

          const hls = new Hls()
          hls.loadSource(resolvedSrc)
          hls.attachMedia(video)

          setHasConnectedPlaybackSource(true)
          sourceCleanupRef.current = () => {
            hls.destroy()
            video.pause()
            video.removeAttribute("src")
            try {
              video.load()
            } catch {
              // Ignore browsers that complain while clearing the detached media element.
            }
          }
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return
          }

          const context = loadIssueContextRef.current
          reportVideoLoadIssue({
            distanceToViewport: context.distanceToViewport,
            error,
            isActive: context.isActive,
            isInViewport: context.isInViewport,
            isMuted: context.isMuted,
            isVisible: context.isVisible,
            lastReportedIssueRef: lastReportedLoadIssueRef,
            src: resolvedSrc,
            stage: context.isVisible
              ? "viewport"
              : context.isInViewport
                ? "near-viewport"
                : "prewarm",
          })
        })
    }

    return () => {
      cancelled = true
      setHasConnectedPlaybackSource(false)
      sourceCleanupRef.current?.()
      sourceCleanupRef.current = null
    }
  }, [
    hasAttachedSource,
    lastReportedLoadIssueRef,
    resolvedSrc,
    shouldRenderVideoSource,
  ])

  useEffect(() => {
    const video = videoRef.current
    if (
      !video ||
      !hasVideoSource ||
      !hasConnectedPlaybackSource ||
      !shouldMountVideo ||
      !hasAttachedSource ||
      hasIssuedLoadHintRef.current
    ) {
      return
    }

    // Nudge the browser to start fetching bytes for offscreen preload candidates. This is
    // intentionally fire-once per source to avoid churn while scrolling.
    if (!canUseAutoPreload && !isNearViewport) {
      return
    }

    if (!isDirectVideoFileSource(resolvedSrc)) {
      return
    }

    if (!video.paused || video.currentTime > 0) {
      return
    }

    if (video.readyState > 0) {
      return
    }

    hasIssuedLoadHintRef.current = true
    try {
      video.load()
    } catch {
      // Ignore browsers that disallow load() in certain lifecycle moments.
    }
  }, [
    canUseAutoPreload,
    hasAttachedSource,
    hasConnectedPlaybackSource,
    hasVideoSource,
    isNearViewport,
    resolvedSrc,
    shouldMountVideo,
  ])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    syncVideoMutedState(video, isMuted)
  }, [isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shouldRenderVideoSource) {
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
      hasPendingPlayAttemptRef.current = false
      video.pause()
    }

    if (playbackDecision.shouldReset) {
      try {
        video.currentTime = 0
      } catch {
        // Ignore browsers that disallow currentTime changes before metadata loads.
      }
    }

    if (!hasConnectedPlaybackSource || !playbackDecision.shouldPlay || !video.paused) {
      return
    }

    if (hasPendingPlayAttemptRef.current) {
      return
    }

    const shouldStartMuted = !isMuted
    if (shouldStartMuted) {
      video.defaultMuted = true
      video.muted = true
      video.volume = 0
    }

    hasPendingPlayAttemptRef.current = true
    const playPromise = video.play()
    if (!playPromise || typeof playPromise.then !== "function") {
      hasPendingPlayAttemptRef.current = false
      return
    }

    playPromise.then(() => {
      hasPendingPlayAttemptRef.current = false
      if (!hasLoadedFrame) {
        queueFrameReady(video)
      }

      if (!shouldStartMuted) {
        return
      }

      syncVideoMutedState(video, isMuted)
    })

    playPromise.catch((error) => {
      hasPendingPlayAttemptRef.current = false
      reportVideoPlayIssue({
        classification: classifyVideoPlayError(error),
        distanceToViewport,
        error,
        isActive,
        isInViewport,
        isMuted,
        isVisible,
        lastReportedIssueRef: lastReportedPlayIssueRef,
        src: resolvedSrc,
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
    resolvedSrc,
    queueFrameReady,
    hasConnectedPlaybackSource,
    shouldRenderVideoSource,
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
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          decoding="async"
          onLoad={(event) => {
            handlePosterLoad(event.currentTarget)
            onPosterLoad?.(event.currentTarget)
          }}
          src={resolvedPoster}
        />
      )}
      {hasVideoSource && shouldMountVideo && (
        <video
          ref={videoRef}
          className={`${className} absolute inset-0 h-full w-full object-cover ${hasLoadedFrame ? "opacity-100" : "opacity-0"}`}
          loop
          muted={isMuted}
          onLoadedData={handleLoadedData}
          onLoadedMetadata={handleLoadedMetadata}
          playsInline
          poster={resolvedPoster}
          preload={
            shouldRenderVideoSource && hasConnectedPlaybackSource
              ? canUseAutoPreload || isInViewport || isNearViewport || isVisible
                ? "auto"
                : "metadata"
              : "none"
          }
        />
      )}
    </div>
  )
}
