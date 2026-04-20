import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

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

type ProgressiveImageProps = {
  readonly alt: string
  readonly className: string
  readonly onLoad?: (image: HTMLImageElement) => void
  readonly placeholderClassName?: string
  readonly priority?: "high" | "low"
  readonly shellClassName?: string
  readonly skeletonClassName?: string
  readonly src?: string
}

const VIDEO_PRELOAD_ROOT_MARGIN = "2400px 0px"

function shouldIgnoreVideoPlayError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  if (error.name === "AbortError" || error.name === "NotAllowedError") {
    return true
  }

  return /autoplay|interrupted|user didn'?t interact/i.test(error.message)
}

function handleVideoPlayError(error: unknown) {
  if (shouldIgnoreVideoPlayError(error)) {
    return
  }

  console.warn("[feed-post:video-play]", error)
}

export function MediaMuteButton({
  isMuted,
  onClick,
  postId,
}: {
  readonly isMuted: boolean
  readonly onClick: () => void
  readonly postId: string
}) {
  return (
    <button
      aria-label={isMuted ? "Nyalakan suara" : "Matikan suara"}
      className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-[10px] font-semibold text-white"
      data-muted={isMuted ? "true" : "false"}
      data-testid={`mute-button-${postId}`}
      onClick={onClick}
      type="button"
    >
      {isMuted ? "Mati" : "Nyala"}
    </button>
  )
}

export function CarouselSlideCounter({
  activeIdx,
  postId,
  total,
}: {
  readonly activeIdx: number
  readonly postId: string
  readonly total: number
}) {
  return (
    <span
      className="absolute top-2.5 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white"
      data-testid={`carousel-indicator-${postId}`}
    >
      {activeIdx + 1}/{total}
    </span>
  )
}

export function CarouselDots({
  activeIdx,
  mediaSources,
}: {
  readonly activeIdx: number
  readonly mediaSources: string[]
}) {
  return (
    <div className="pointer-events-none absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
      {mediaSources.map((src, index) => (
        <span
          key={src}
          className={`rounded-full transition-all duration-300 ${
            index === activeIdx ? "h-1.5 w-4 bg-white" : "h-1.5 w-1.5 bg-white/50"
          }`}
        />
      ))}
    </div>
  )
}

export function CarouselNavButton({
  direction,
  onClick,
  postId,
}: {
  readonly direction: "next" | "prev"
  readonly onClick: () => void
  readonly postId: string
}) {
  const isNext = direction === "next"

  return (
    <button
      aria-label={isNext ? "Berikutnya" : "Sebelumnya"}
      className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-transform active:scale-90 ${
        isNext ? "right-2" : "left-2"
      }`}
      data-testid={`carousel-${direction}-${postId}`}
      onClick={onClick}
      type="button"
    >
      {isNext ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>
  )
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

    if (isVisible && isActive) {
      video.play().catch(handleVideoPlayError)
      return
    }

    video.pause()
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

export function ProgressiveImage({
  alt,
  className,
  onLoad,
  placeholderClassName = "bg-ink/8",
  priority = "low",
  shellClassName = "",
  skeletonClassName = "",
  src,
}: ProgressiveImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const hasReportedLoadRef = useRef(false)
  const [hasLoadedImage, setHasLoadedImage] = useState(false)

  const markImageReady = useCallback(
    (image: HTMLImageElement) => {
      if (!image.complete || image.naturalWidth === 0) {
        return
      }

      setHasLoadedImage(true)
      if (hasReportedLoadRef.current) {
        return
      }

      hasReportedLoadRef.current = true
      onLoad?.(image)
    },
    [onLoad]
  )

  useEffect(() => {
    setHasLoadedImage(false)
    hasReportedLoadRef.current = false
  }, [src])

  useEffect(() => {
    const image = imageRef.current
    if (!image) {
      return
    }

    if (image.complete && image.naturalWidth > 0) {
      markImageReady(image)
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      if (imageRef.current) {
        markImageReady(imageRef.current)
      }
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [markImageReady, src])

  return (
    <div
      className={`relative overflow-hidden ${placeholderClassName} ${shellClassName} ${hasLoadedImage ? "" : "aspect-[4/5]"}`}
    >
      {!hasLoadedImage && (
        <div className={`absolute inset-0 skeleton ${skeletonClassName} ${placeholderClassName}`} />
      )}
      {src && (
        <img
          ref={imageRef}
          alt={alt}
          className={`${className} transition-opacity duration-200 ${hasLoadedImage ? "opacity-100" : "opacity-0"}`}
          decoding="async"
          fetchPriority={priority}
          loading={priority === "high" ? "eager" : "lazy"}
          onLoad={(event) => markImageReady(event.currentTarget)}
          src={src}
        />
      )}
    </div>
  )
}
