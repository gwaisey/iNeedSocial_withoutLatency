import { type Post } from "../types/social"
import { useFeedCarousel } from "../hooks/use-feed-carousel"
import { AutoPlayVideo } from "./auto-play-video"
import {
  CarouselDots,
  CarouselNavButton,
  CarouselSlideCounter,
  MediaMuteButton,
} from "./feed-post-carousel-controls"
import { ProgressiveImage } from "./progressive-image"
import {
  buildVideoAspectRatioHeight,
  buildImageAspectRatioHeight,
  getMediaSurfaceTokens,
  isVideoSource,
  type MediaSurfaceTokens,
} from "./feed-post-media-utils"

type FeedPostMediaProps = {
  readonly isDark: boolean
  readonly isMuted: boolean
  readonly onToggleMute: () => void
  readonly post: Post
}

function FeedPostVideoMedia({
  isMuted,
  onToggleMute,
  post,
  tokens,
}: {
  readonly isMuted: boolean
  readonly onToggleMute: () => void
  readonly post: Post
  readonly tokens: MediaSurfaceTokens
}) {
  const primaryMedia = post.media[0]

  return (
    <div className={`w-full overflow-hidden relative ${tokens.surface}`}>
      <AutoPlayVideo
        className="w-full h-auto"
        isMuted={isMuted}
        placeholderClassName={tokens.placeholder}
        poster={primaryMedia?.poster}
        shellClassName="w-full"
        skeletonClassName={tokens.skeletonTone}
        src={primaryMedia?.src}
      />
      <MediaMuteButton isMuted={isMuted} onClick={onToggleMute} postId={post.id} />
    </div>
  )
}

function FeedPostCarouselMedia({
  isMuted,
  onToggleMute,
  post,
  tokens,
}: {
  readonly isMuted: boolean
  readonly onToggleMute: () => void
  readonly post: Post
  readonly tokens: MediaSurfaceTokens
}) {
  const { media } = post
  const mediaHasVideo = media.some((item) => isVideoSource(item.src))
  const {
    activeIdx,
    currentSlideHeight,
    handleTouchEnd,
    handleTouchStart,
    nextSlide,
    prevSlide,
    updateSlideHeight,
  } = useFeedCarousel({ mediaLength: media.length })

  return (
    <div
      className={`w-full overflow-hidden relative transition-[height] duration-300 ${tokens.surface}`}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      style={{ height: currentSlideHeight ? `${currentSlideHeight}px` : "auto" }}
    >
      <div
        className="flex will-change-transform transition-transform duration-300 ease-out"
        style={{
          height: currentSlideHeight ? `${currentSlideHeight}px` : "auto",
          transform: `translateX(-${activeIdx * 100}%)`,
        }}
      >
        {media.map((item, index) =>
          isVideoSource(item.src) ? (
            <AutoPlayVideo
              key={item.src}
              className="w-full h-auto shrink-0"
              isActive={index === activeIdx}
              isMuted={isMuted}
              onLoadedMetadata={(event) => {
                updateSlideHeight(index, buildVideoAspectRatioHeight(event.currentTarget))
              }}
              placeholderClassName={tokens.placeholder}
              poster={item.poster}
              shellClassName="w-full shrink-0"
              skeletonClassName={tokens.skeletonTone}
              src={item.src}
            />
          ) : (
            <ProgressiveImage
              key={item.src}
              alt={item.alt}
              className="w-full h-auto shrink-0"
              onLoad={(image) => {
                updateSlideHeight(index, buildImageAspectRatioHeight(image))
              }}
              placeholderClassName={tokens.placeholder}
              priority={Math.abs(index - activeIdx) <= 1 ? "high" : "low"}
              shellClassName="w-full shrink-0"
              skeletonClassName={tokens.skeletonTone}
              src={item.src}
            />
          )
        )}
      </div>

      {mediaHasVideo && (
        <MediaMuteButton isMuted={isMuted} onClick={onToggleMute} postId={post.id} />
      )}

      {media.length > 1 && (
        <CarouselSlideCounter activeIdx={activeIdx} postId={post.id} total={media.length} />
      )}

      {media.length > 1 && (
        <CarouselDots activeIdx={activeIdx} mediaSources={media.map((item) => item.src)} />
      )}

      {activeIdx > 0 && (
        <CarouselNavButton direction="prev" onClick={prevSlide} postId={post.id} />
      )}

      {activeIdx < media.length - 1 && (
        <CarouselNavButton direction="next" onClick={nextSlide} postId={post.id} />
      )}
    </div>
  )
}

function FeedPostImageMedia({
  post,
  tokens,
}: {
  readonly post: Post
  readonly tokens: MediaSurfaceTokens
}) {
  const primaryMedia = post.media[0]

  return (
    <div className={`w-full overflow-hidden ${tokens.surface}`}>
      <ProgressiveImage
        alt={primaryMedia?.alt}
        className="w-full h-auto"
        placeholderClassName={tokens.placeholder}
        priority="high"
        shellClassName="w-full"
        skeletonClassName={tokens.skeletonTone}
        src={primaryMedia?.src}
      />
    </div>
  )
}

export function FeedPostMedia({
  isDark,
  isMuted,
  onToggleMute,
  post,
}: FeedPostMediaProps) {
  const tokens = getMediaSurfaceTokens(isDark)

  switch (post.type) {
    case "video":
      return (
        <FeedPostVideoMedia
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          post={post}
          tokens={tokens}
        />
      )
    case "carousel":
      return (
        <FeedPostCarouselMedia
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          post={post}
          tokens={tokens}
        />
      )
    case "image":
    default:
      return <FeedPostImageMedia post={post} tokens={tokens} />
  }
}
