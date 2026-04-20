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

const VIDEO_PRELOAD_ROOT_MARGIN = "2400px 0px"
const VIDEO_AUTO_PRELOAD_DISTANCE_PX = 720

function getDistanceToViewport(
  rootTop: number,
  rootBottom: number,
  targetTop: number,
  targetBottom: number
) {
  if (targetBottom < rootTop) {
    return rootTop - targetBottom
  }

  if (targetTop > rootBottom) {
    return targetTop - rootBottom
  }

  return 0
}

function classifyVideoPlayError(error: unknown): "ignore" | "unexpected" {
  if (!(error instanceof Error)) {
    return "unexpected"
  }

  if (error.name === "AbortError" || error.name === "NotAllowedError") {
    return "ignore"
  }

  return /autoplay|interrupted|user didn'?t interact/i.test(error.message)
    ? "ignore"
    : "unexpected"
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
  const preloadCandidateId = useId()
  const shellRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastUnexpectedPlayErrorRef = useRef<string | null>(null)
  const [canUseAutoPreload, setCanUseAutoPreload] = useState(false)
  const [distanceToViewport, setDistanceToViewport] = useState(Number.POSITIVE_INFINITY)
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldMountVideo, setShouldMountVideo] = useState(false)

  useEffect(() => {
    registerVideoPreloadCandidate(preloadCandidateId, setCanUseAutoPreload)

    return () => {
      unregisterVideoPreloadCandidate(preloadCandidateId)
    }
  }, [preloadCandidateId])

  useEffect(() => {
    updateVideoPreloadCandidate(preloadCandidateId, {
      canPrewarm: canPrewarm && shouldMountVideo,
      distancePx: distanceToViewport,
    })
  }, [canPrewarm, distanceToViewport, preloadCandidateId, shouldMountVideo])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) {
      return
    }

    const observerRoot = scrollRootRef?.current ?? null

    const observer = new IntersectionObserver(
      ([entry]) => {
        const rootTop = entry.rootBounds?.top ?? 0
        const rootBottom = entry.rootBounds?.bottom ?? window.innerHeight
        const distancePx = getDistanceToViewport(
          rootTop,
          rootBottom,
          entry.boundingClientRect.top,
          entry.boundingClientRect.bottom
        )
        const isInViewport =
          entry.boundingClientRect.bottom > rootTop && entry.boundingClientRect.top < rootBottom

        setDistanceToViewport(distancePx)
        setIsNearViewport(entry.isIntersecting)
        setIsVisible(isInViewport)
        if (isInViewport || (entry.isIntersecting && canPrewarm)) {
          setShouldMountVideo(true)
        }
      },
      {
        root: observerRoot,
        rootMargin: VIDEO_PRELOAD_ROOT_MARGIN,
        threshold: [0, 0.2],
      }
    )

    observer.observe(shell)

    return () => {
      observer.disconnect()
    }
  }, [canPrewarm, scrollRootRef])

  useEffect(() => {
    if (canPrewarm && isNearViewport) {
      setShouldMountVideo(true)
    }
  }, [canPrewarm, isNearViewport])

  useEffect(() => {
    setHasLoadedFrame(false)
    setShouldMountVideo(false)
    setCanUseAutoPreload(false)
    setDistanceToViewport(Number.POSITIVE_INFINITY)
    lastUnexpectedPlayErrorRef.current = null
  }, [src])

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
    if (!video || !shouldMountVideo) {
      return
    }

    if (
      canUseAutoPreload ||
      isVisible ||
      distanceToViewport <= VIDEO_AUTO_PRELOAD_DISTANCE_PX ||
      video.readyState < HTMLMediaElement.HAVE_METADATA
    ) {
      video.load()
    }
  }, [canUseAutoPreload, distanceToViewport, isVisible, shouldMountVideo, src])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (!isVisible || !isActive) {
      video.pause()
      return
    }

    const playPromise = video.play()
    playPromise.catch((error) => {
      if (classifyVideoPlayError(error) !== "unexpected") {
        return
      }

      const signature =
        error instanceof Error ? `${error.name}:${error.message}` : String(error)

      if (lastUnexpectedPlayErrorRef.current === signature) {
        return
      }

      lastUnexpectedPlayErrorRef.current = signature
      reportRuntimeIssue({
        error,
        level: "warn",
        message: "Unexpected video autoplay failure.",
        metadata: {
          src,
        },
        scope: "video-playback",
      })
    })
  }, [isActive, isVisible, src])

  return (
    <div
      ref={shellRef}
      className={`relative overflow-hidden ${placeholderClassName} ${shellClassName} ${hasLoadedFrame ? "" : "aspect-[4/5]"}`}
    >
      {!hasLoadedFrame && (
        <div className={`absolute inset-0 skeleton ${skeletonClassName} ${placeholderClassName}`} />
      )}
      {poster && !hasLoadedFrame && (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          src={poster}
        />
      )}
      {shouldMountVideo && (
        <video
          ref={videoRef}
          autoPlay
          className={`${className} transition-opacity duration-200 ${hasLoadedFrame ? "opacity-100" : "opacity-0"}`}
          loop
          muted={isMuted}
          onLoadedData={() => setHasLoadedFrame(true)}
          onLoadedMetadata={(event) => {
            setHasLoadedFrame(true)
            onLoadedMetadata?.(event)
          }}
          playsInline
          poster={poster}
          preload={canUseAutoPreload || isVisible ? "auto" : "metadata"}
          src={src}
        />
      )}
    </div>
  )
}
