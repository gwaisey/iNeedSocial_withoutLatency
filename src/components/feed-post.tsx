import { useEffect, useRef, useState, type SyntheticEvent, type TouchEvent } from "react"
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
} from "lucide-react"
import { type Post } from "../types/social"
import { ProfileBadge } from "./profile-badge"

type FeedPostProps = {
  readonly isDark: boolean
  readonly isLiked: boolean
  readonly isReposted: boolean
  readonly onComment: () => void
  readonly onLike: () => void
  readonly onRepost: () => void
  readonly post: Post
}

type AutoPlayVideoProps = {
  readonly className: string
  readonly isActive?: boolean
  readonly isMuted: boolean
  readonly onLoadedMetadata?: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly placeholderClassName?: string
  readonly poster?: string
  readonly src?: string
}

const VIDEO_PRELOAD_ROOT_MARGIN = "420px 0px"

function AutoPlayVideo({
  className,
  isActive = true,
  isMuted,
  onLoadedMetadata,
  placeholderClassName = "bg-ink/8",
  poster,
  src,
}: AutoPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
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
      },
      {
        rootMargin: VIDEO_PRELOAD_ROOT_MARGIN,
        threshold: [0, 0.2],
      }
    )

    observer.observe(video)

    return () => {
      observer.disconnect()
      video.pause()
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.muted = isMuted
  }, [isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isNearViewport) {
      return
    }

    if (video.preload !== "auto") {
      video.preload = "auto"
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.load()
    }
  }, [isNearViewport])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (isVisible && isActive) {
      video.play().catch(() => {})
      return
    }

    video.pause()
  }, [isActive, isVisible, src])

  return (
    <div className={`relative overflow-hidden ${placeholderClassName}`}>
      {!hasLoadedFrame && <div className={`absolute inset-0 skeleton ${placeholderClassName}`} />}
      <video
        ref={videoRef}
        autoPlay
        className={`${className} transition-opacity duration-200 ${hasLoadedFrame ? "opacity-100" : "opacity-0"}`}
        loop
        onLoadedData={() => setHasLoadedFrame(true)}
        onLoadedMetadata={(event) => {
          setHasLoadedFrame(true)
          onLoadedMetadata?.(event)
        }}
        playsInline
        poster={poster}
        preload="metadata"
        src={src}
      />
    </div>
  )
}

export function FeedPost({
  isDark,
  isLiked,
  isReposted,
  onComment,
  onLike,
  onRepost,
  post,
}: FeedPostProps) {
  const textPrimary = isDark ? "text-white" : "text-ink"
  const textMuted = isDark ? "text-white/50" : "text-haze"
  const iconBase = isDark ? "text-white" : "text-ink"
  const mediaSurface = isDark ? "bg-white/8" : "bg-ink/8"
  const mediaPlaceholder = isDark ? "bg-white/8" : "bg-ink/8"
  const [isMuted, setIsMuted] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [slideHeights, setSlideHeights] = useState<number[]>([])

  const { media, type } = post

  const prevSlide = () => setActiveIdx((index) => Math.max(0, index - 1))
  const nextSlide = () => setActiveIdx((index) => Math.min(media.length - 1, index + 1))

  const handleTouchStart = (event: TouchEvent) => {
    setTouchStartX(event.touches[0]?.clientX ?? null)
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (touchStartX === null) {
      return
    }

    const diff = touchStartX - event.changedTouches[0].clientX
    if (diff > 40) {
      nextSlide()
    } else if (diff < -40) {
      prevSlide()
    }

    setTouchStartX(null)
  }

  return (
    <article className="w-full">
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <ProfileBadge hasStory isDark={isDark} username={post.username} />
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-none truncate ${textPrimary}`}>
            {post.username}
          </p>
          <p className={`text-[11px] mt-0.5 ${textMuted}`}>Baru saja</p>
        </div>
        <button
          aria-label="Opsi lainnya"
          className={`p-2 -mr-1 rounded-full active:bg-black/5 ${textMuted}`}
          type="button"
        >
          <MoreHorizontal size={18} strokeWidth={1.8} />
        </button>
      </div>

      {type === "video" && (
        <div className={`w-full overflow-hidden relative ${mediaSurface}`}>
          <AutoPlayVideo
            className="w-full h-auto"
            isMuted={isMuted}
            placeholderClassName={mediaPlaceholder}
            poster={media[0]?.poster}
            src={media[0]?.src}
          />
          <button
            aria-label={isMuted ? "Nyalakan suara" : "Matikan suara"}
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-[10px] font-semibold text-white z-10"
            onClick={() => setIsMuted((current) => !current)}
            type="button"
          >
            {isMuted ? "Mati" : "Nyala"}
          </button>
        </div>
      )}

      {type === "carousel" && (
        <div
          className={`w-full overflow-hidden relative transition-[height] duration-300 ${mediaSurface}`}
          onTouchEnd={handleTouchEnd}
          onTouchStart={handleTouchStart}
          style={{ height: slideHeights[activeIdx] ? `${slideHeights[activeIdx]}px` : "auto" }}
        >
          <div
            className="flex will-change-transform transition-transform duration-300 ease-out"
            style={{
              height: slideHeights[activeIdx] ? `${slideHeights[activeIdx]}px` : "auto",
              transform: `translateX(-${activeIdx * 100}%)`,
            }}
          >
            {media.map((item, index) =>
              item.src.endsWith(".mp4") ? (
                <AutoPlayVideo
                  key={item.src}
                  className="w-full h-auto shrink-0"
                  isActive={index === activeIdx}
                  isMuted={isMuted}
                  placeholderClassName={mediaPlaceholder}
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget
                    const height = video.clientWidth * video.videoHeight / video.videoWidth
                    setSlideHeights((current) => {
                      const next = [...current]
                      next[index] = height
                      return next
                    })
                  }}
                  poster={item.poster}
                  src={item.src}
                />
              ) : (
                <img
                  key={item.src}
                  alt={item.alt}
                  className="w-full h-auto shrink-0"
                  decoding="async"
                  fetchPriority={index === activeIdx ? "high" : "auto"}
                  onLoad={(event) => {
                    const image = event.currentTarget
                    const height = image.clientWidth * image.naturalHeight / image.naturalWidth
                    setSlideHeights((current) => {
                      const next = [...current]
                      next[index] = height
                      return next
                    })
                  }}
                  src={item.src}
                />
              )
            )}
          </div>

          {media.some((item) => item.src.endsWith(".mp4")) && (
            <button
              aria-label={isMuted ? "Nyalakan suara" : "Matikan suara"}
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-[10px] font-semibold text-white z-10"
              onClick={() => setIsMuted((current) => !current)}
              type="button"
            >
              {isMuted ? "Mati" : "Nyala"}
            </button>
          )}

          {media.length > 1 && (
            <span
              className="absolute top-2.5 right-3 bg-black/50 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full"
              data-testid={`carousel-indicator-${post.id}`}
            >
              {activeIdx + 1}/{media.length}
            </span>
          )}

          {media.length > 1 && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
              {media.map((item, index) => (
                <span
                  key={item.src}
                  className={`rounded-full transition-all duration-300 ${
                    index === activeIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}

          {activeIdx > 0 && (
            <button
              aria-label="Sebelumnya"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white active:scale-90 transition-transform"
              data-testid={`carousel-prev-${post.id}`}
              onClick={prevSlide}
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {activeIdx < media.length - 1 && (
            <button
              aria-label="Berikutnya"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white active:scale-90 transition-transform"
              data-testid={`carousel-next-${post.id}`}
              onClick={nextSlide}
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {type === "image" && (
        <div className={`w-full overflow-hidden ${mediaSurface}`}>
          <img
            alt={media[0]?.alt}
            className="w-full h-auto"
            decoding="async"
            src={media[0]?.src}
          />
        </div>
      )}

      <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-0.5">
        <button
          aria-label="Suka postingan"
          className="flex items-center gap-1 min-h-[44px] px-1.5 active:scale-75 transition-transform"
          data-testid={`like-button-${post.id}`}
          data-liked={isLiked ? "true" : "false"}
          onClick={onLike}
          style={{ color: isLiked ? "#C83C53" : undefined }}
          type="button"
        >
          <Heart
            className={isLiked ? "" : iconBase}
            fill={isLiked ? "currentColor" : "none"}
            size={22}
            strokeWidth={isLiked ? 0 : 1.8}
          />
        </button>

        <button
          aria-label="Buka komentar"
          className={`flex items-center gap-1 min-h-[44px] px-1.5 active:scale-75 transition-transform ${iconBase}`}
          onClick={onComment}
          type="button"
        >
          <MessageCircle size={21} strokeWidth={1.8} />
        </button>

        <button
          aria-label="Bagikan postingan"
          className="flex items-center gap-1 min-h-[44px] px-1.5 active:scale-75 transition-transform"
          onClick={onRepost}
          style={{ color: isReposted ? "#776DFF" : undefined }}
          type="button"
        >
          <Send
            className={isReposted ? "" : iconBase}
            size={20}
            strokeWidth={isReposted ? 2 : 1.8}
          />
        </button>

        <button
          aria-label="Simpan postingan"
          className={`flex items-center gap-1 min-h-[44px] px-1.5 ml-auto active:scale-75 transition-transform ${textMuted}`}
          type="button"
        >
          <Bookmark size={20} strokeWidth={1.8} />
        </button>
      </div>

      <div className="px-3 pt-0.5 pb-4">
        <p className={`text-[13px] font-semibold ${textPrimary}`}>{post.likes} suka</p>
        <p className={`text-[13px] mt-0.5 leading-snug ${textPrimary}`}>
          <span className="font-semibold">{post.username}</span>
          <span className={`ml-1.5 ${textMuted}`}>{post.caption}</span>
        </p>
      </div>
    </article>
  )
}
