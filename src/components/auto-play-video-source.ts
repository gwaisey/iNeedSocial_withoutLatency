import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react"
import type {
  VideoPreloadDirection,
  VideoPreloadRank,
} from "../utils/video-preload-budget"
import {
  isDirectVideoFileSource,
  isHlsManifestSource,
  VIDEO_AGGRESSIVE_AUTO_LOAD_MAX_RANK,
  VIDEO_EARLY_LOAD_DISTANCE_PX,
  VIDEO_SOURCE_DETACH_GRACE_MS,
  VIDEO_SOURCE_IMMEDIATE_DETACH_DISTANCE_PX,
} from "./auto-play-video-config"
import {
  reportVideoLoadIssue,
  useVideoSourceLifecycleReset,
} from "./auto-play-video-lifecycle"
import {
  preloadHlsRuntime,
  useCloudflareStreamWarmup,
  useDirectVideoWarmup,
} from "./auto-play-video-stream-warmup"

export type VideoLoadIssueContext = {
  distanceToViewport: number
  isActive: boolean
  isInViewport: boolean
  isMuted: boolean
  isVisible: boolean
}

type UseAutoPlayVideoSourceArgs = {
  autoPreloadRank: VideoPreloadRank
  canUseAutoPreload: boolean
  distanceToViewport: number
  hasPendingPlayAttemptRef: MutableRefObject<boolean>
  hasVideoSource: boolean
  isInViewport: boolean
  isNearViewport: boolean
  isPlaybackVisible: boolean
  isVisible: boolean
  lastReportedLoadIssueRef: MutableRefObject<string | null>
  loadIssueContextRef: MutableRefObject<VideoLoadIssueContext>
  preloadDirection: VideoPreloadDirection
  resolvedSrc?: string
  setAutoPreloadRank: Dispatch<SetStateAction<VideoPreloadRank>>
  setIsPlaybackOwner: Dispatch<SetStateAction<boolean>>
  setShouldMountVideo: Dispatch<SetStateAction<boolean>>
  shouldMountVideo: boolean
  videoRef: RefObject<HTMLVideoElement | null>
}

function canUseNativeHlsPlayback(video: HTMLVideoElement) {
  return Boolean(
    video.canPlayType("application/vnd.apple.mpegurl") ||
      video.canPlayType("application/x-mpegURL")
  )
}

export function useAutoPlayVideoSource({
  autoPreloadRank,
  canUseAutoPreload,
  distanceToViewport,
  hasPendingPlayAttemptRef,
  hasVideoSource,
  isInViewport,
  isNearViewport,
  isPlaybackVisible,
  isVisible,
  lastReportedLoadIssueRef,
  loadIssueContextRef,
  preloadDirection,
  resolvedSrc,
  setAutoPreloadRank,
  setIsPlaybackOwner,
  setShouldMountVideo,
  shouldMountVideo,
  videoRef,
}: UseAutoPlayVideoSourceArgs) {
  const sourceCleanupRef = useRef<(() => void) | null>(null)
  const detachSourceTimeoutRef = useRef<number | null>(null)
  const hasIssuedLoadHintRef = useRef(false)
  const hasIssuedVisibleLoadHintRef = useRef(false)
  const shouldAggressivelyLoadSourceRef = useRef(false)
  const [hasAttachedSource, setHasAttachedSource] = useState(false)
  const [hasConnectedPlaybackSource, setHasConnectedPlaybackSource] = useState(false)

  useVideoSourceLifecycleReset({
    normalizedSrc: resolvedSrc,
    setAutoPreloadRank,
    setHasAttachedSource,
    setIsPlaybackOwner,
    setShouldMountVideo,
    shouldResetViewportDataRef: hasPendingPlayAttemptRef,
    shouldResetWarmupRef: hasPendingPlayAttemptRef,
  })

  const shouldAggressivelyLoadSource =
    hasVideoSource &&
    shouldMountVideo &&
    (isInViewport ||
      isPlaybackVisible ||
      (autoPreloadRank !== null && autoPreloadRank <= VIDEO_AGGRESSIVE_AUTO_LOAD_MAX_RANK))
  const shouldKeepAttachedSource =
    hasAttachedSource &&
    (isInViewport || isVisible || canUseAutoPreload)

  const shouldRenderVideoSource =
    hasVideoSource &&
    shouldMountVideo &&
    (shouldKeepAttachedSource ||
      canUseAutoPreload ||
      isInViewport ||
      isVisible)

  useLayoutEffect(() => {
    shouldAggressivelyLoadSourceRef.current = shouldAggressivelyLoadSource
  }, [shouldAggressivelyLoadSource])

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
  useDirectVideoWarmup({
    enabled:
      shouldMountVideo &&
      isDirectVideoFileSource(resolvedSrc) &&
      (canUseAutoPreload || isNearViewport || isInViewport || isVisible),
    src: resolvedSrc,
  })

  useLayoutEffect(() => {
    if (!shouldRenderVideoSource || hasAttachedSource) {
      return
    }

    if (detachSourceTimeoutRef.current !== null) {
      window.clearTimeout(detachSourceTimeoutRef.current)
      detachSourceTimeoutRef.current = null
    }
    setHasAttachedSource(true)
  }, [hasAttachedSource, shouldRenderVideoSource])

  useEffect(() => {
    const clearScheduledSourceDetach = () => {
      if (detachSourceTimeoutRef.current === null) {
        return
      }

      window.clearTimeout(detachSourceTimeoutRef.current)
      detachSourceTimeoutRef.current = null
    }

    const detachPlaybackSource = () => {
      clearScheduledSourceDetach()
      hasPendingPlayAttemptRef.current = false
      hasIssuedLoadHintRef.current = false
      hasIssuedVisibleLoadHintRef.current = false
      sourceCleanupRef.current?.()
      sourceCleanupRef.current = null
      setHasConnectedPlaybackSource(false)
      setHasAttachedSource(false)
    }

    if (shouldRenderVideoSource) {
      clearScheduledSourceDetach()
      return
    }

    if (!hasAttachedSource) {
      return
    }

    const shouldDetachImmediately =
      !hasVideoSource ||
      !shouldMountVideo ||
      (Number.isFinite(distanceToViewport) &&
        distanceToViewport >= VIDEO_SOURCE_IMMEDIATE_DETACH_DISTANCE_PX)

    if (shouldDetachImmediately) {
      detachPlaybackSource()
      return
    }

    if (detachSourceTimeoutRef.current !== null) {
      return
    }

    detachSourceTimeoutRef.current = window.setTimeout(() => {
      detachSourceTimeoutRef.current = null
      detachPlaybackSource()
    }, VIDEO_SOURCE_DETACH_GRACE_MS)
  }, [
    distanceToViewport,
    hasAttachedSource,
    hasPendingPlayAttemptRef,
    hasVideoSource,
    shouldMountVideo,
    shouldRenderVideoSource,
  ])

  useEffect(() => {
    if (detachSourceTimeoutRef.current !== null) {
      window.clearTimeout(detachSourceTimeoutRef.current)
      detachSourceTimeoutRef.current = null
    }
    sourceCleanupRef.current?.()
    sourceCleanupRef.current = null
    setHasConnectedPlaybackSource(false)
  }, [resolvedSrc])

  useEffect(() => {
    hasIssuedLoadHintRef.current = false
    hasIssuedVisibleLoadHintRef.current = false
  }, [resolvedSrc])

  useEffect(() => {
    return () => {
      if (detachSourceTimeoutRef.current !== null) {
        window.clearTimeout(detachSourceTimeoutRef.current)
        detachSourceTimeoutRef.current = null
      }
      sourceCleanupRef.current?.()
      sourceCleanupRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const video = videoRef.current
    if (!video || !resolvedSrc || !hasAttachedSource) {
      return
    }

    let cancelled = false

    const bindDirectSource = () => {
      const shouldAutoLoadNow = shouldAggressivelyLoadSourceRef.current
      hasIssuedVisibleLoadHintRef.current = false
      video.preload = shouldAutoLoadNow ? "auto" : "metadata"
      video.src = resolvedSrc
      if (
        isDirectVideoFileSource(resolvedSrc) &&
        shouldAutoLoadNow &&
        video.readyState === 0
      ) {
        hasIssuedLoadHintRef.current = true
        try {
          video.load()
        } catch {
          // Ignore browsers that disallow load() in certain lifecycle moments.
        }
      }
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
    loadIssueContextRef,
    resolvedSrc,
    videoRef,
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

    // Nudge the browser to start fetching bytes for the current or immediate next
    // playback candidate. Avoid auto-loading several offscreen videos at once because
    // browser media connection limits can delay the video the user reaches next.
    if (
      (autoPreloadRank === null || autoPreloadRank > VIDEO_AGGRESSIVE_AUTO_LOAD_MAX_RANK) &&
      !isPlaybackVisible &&
      !isInViewport
    ) {
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
    video.preload = "auto"
    try {
      video.load()
    } catch {
      // Ignore browsers that disallow load() in certain lifecycle moments.
    }
  }, [
    autoPreloadRank,
    hasAttachedSource,
    hasConnectedPlaybackSource,
    hasVideoSource,
    isInViewport,
    isPlaybackVisible,
    resolvedSrc,
    shouldMountVideo,
    videoRef,
  ])

  useEffect(() => {
    const video = videoRef.current
    if (
      !video ||
      !hasVideoSource ||
      !hasConnectedPlaybackSource ||
      !hasAttachedSource ||
      !isDirectVideoFileSource(resolvedSrc) ||
      hasIssuedVisibleLoadHintRef.current ||
      hasPendingPlayAttemptRef.current ||
      !video.paused ||
      video.readyState > 0 ||
      (!isPlaybackVisible && !isInViewport)
    ) {
      return
    }

    hasIssuedVisibleLoadHintRef.current = true
    video.preload = "auto"
    try {
      video.load()
    } catch {
      // Ignore browsers that disallow load() during a visibility transition.
    }
  }, [
    hasAttachedSource,
    hasConnectedPlaybackSource,
    hasPendingPlayAttemptRef,
    hasVideoSource,
    isInViewport,
    isPlaybackVisible,
    resolvedSrc,
    videoRef,
  ])

  return {
    hasAttachedSource,
    hasConnectedPlaybackSource,
    shouldAggressivelyLoadSource,
    shouldRenderVideoSource,
  }
}
