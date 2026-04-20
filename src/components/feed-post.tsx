import { type Post } from "../types/social"
import {
  FeedPostActions,
  FeedPostCaption,
  FeedPostHeader,
} from "./feed-post-chrome"
import { FeedPostMedia } from "./feed-post-media"
import { getFeedPostPalette } from "./feed-post-utils"

type FeedPostProps = {
  readonly isDark: boolean
  readonly isLiked: boolean
  readonly isReposted: boolean
  readonly isVideoMuted: boolean
  readonly onComment: () => void
  readonly onLike: () => void
  readonly onRepost: () => void
  readonly onToggleVideoMute: () => void
  readonly post: Post
}

export function FeedPost({
  isDark,
  isLiked,
  isReposted,
  isVideoMuted,
  onComment,
  onLike,
  onRepost,
  onToggleVideoMute,
  post,
}: FeedPostProps) {
  const palette = getFeedPostPalette(isDark)

  return (
    <article className="w-full">
      <FeedPostHeader isDark={isDark} palette={palette} post={post} />
      <FeedPostMedia
        isDark={isDark}
        isMuted={isVideoMuted}
        onToggleMute={onToggleVideoMute}
        post={post}
      />
      <FeedPostActions
        iconBase={palette.iconBase}
        isLiked={isLiked}
        isReposted={isReposted}
        onComment={onComment}
        onLike={onLike}
        onRepost={onRepost}
        post={post}
        textMuted={palette.textMuted}
      />
      <FeedPostCaption palette={palette} post={post} />
    </article>
  )
}
