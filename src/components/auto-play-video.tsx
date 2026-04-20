import { useEffect, useRef, useState, type SyntheticEvent } from "react"
import { reportRuntimeIssue } from "../utils/runtime-monitoring"

type AutoPlayVideoProps = {
  readonly className: string
  readonly isActive?: boolean
  readonly isMuted: boolean
  readonly onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly placeholderClassName?: string
  readonly poster?: string
  readonly shellClassName?: string
  readonly skeletonClassName?: string
  readonly src?: string
}

const VIDEO_PRELOAD_ROOT_MARGIN = "2400px 0px"

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
  isActive = true,
  isMuted,
  onLoadedMetadata,
  placeholderClassName = "bg-ink/8",
  poster,
  shellClassName = "",
  skeletonClassName = "",
  src,
}: AutoPlayVideoProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastUnexpectedPlayErrorRef = useRef<string | null>(null)
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldMountVideo, setShouldMountVideo] = useState(false)

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const rootTop = entry.rootBounds?.top ?? 0
        const rootBottom = entry.rootBounds?.bottom ?? window.innerHeight
        const isInViewport =
          entry.boundingClientRect.bottom > rootTop && entry.boundingClientRect.top < rootBottom

        setIsNearViewport(entry.isIntersecting)
        setIsVisible(isInViewport && entry.intersectionRatio >= 0.2)
        if (entry.isIntersecting) {
          setShouldMountVideo(true)
        }
      },
      {
        rootMargin: VIDEO_PRELOAD_ROOT_MARGIN,
        threshold: [0, 0.2],
      }
    )

    observer.observe(shell)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    setHasLoadedFrame(false)
    setShouldMountVideo(false)
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
    if (!video || !isNearViewport) {
      return
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.load()
    }
  }, [isNearViewport, src])

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
          preload="auto"
          src={src}
        />
      )}
    </div>
  )
}
