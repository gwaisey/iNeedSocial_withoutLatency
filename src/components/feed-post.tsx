import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react"
import { type Post } from "../types/social"
import { FeedPostMedia } from "./feed-post-media"
import { ProfileBadge } from "./profile-badge"

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

type FeedPostPalette = {
  iconBase: string
  textMuted: string
  textPrimary: string
}

function getFeedPostPalette(isDark: boolean): FeedPostPalette {
  return {
    iconBase: isDark ? "text-white" : "text-ink",
    textMuted: isDark ? "text-white/50" : "text-haze",
    textPrimary: isDark ? "text-white" : "text-ink",
  }
}

function FeedPostHeader({
  palette,
  post,
  isDark,
}: {
  readonly isDark: boolean
  readonly palette: FeedPostPalette
  readonly post: Post
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
      <ProfileBadge hasStory isDark={isDark} username={post.username} />
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold leading-none truncate ${palette.textPrimary}`}>
          {post.username}
        </p>
        <p className={`text-[11px] mt-0.5 ${palette.textMuted}`}>Baru saja</p>
      </div>
      <button
        aria-label="Opsi lainnya"
        className={`p-2 -mr-1 rounded-full active:bg-black/5 ${palette.textMuted}`}
        type="button"
      >
        <MoreHorizontal size={18} strokeWidth={1.8} />
      </button>
    </div>
  )
}

function FeedPostActions({
  iconBase,
  isLiked,
  isReposted,
  onComment,
  onLike,
  onRepost,
  post,
  textMuted,
}: {
  readonly iconBase: string
  readonly isLiked: boolean
  readonly isReposted: boolean
  readonly onComment: () => void
  readonly onLike: () => void
  readonly onRepost: () => void
  readonly post: Post
  readonly textMuted: string
}) {
  return (
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
  )
}

function FeedPostCaption({
  palette,
  post,
}: {
  readonly palette: FeedPostPalette
  readonly post: Post
}) {
  return (
    <div className="px-3 pt-0.5 pb-4">
      <p className={`text-[13px] font-semibold ${palette.textPrimary}`}>{post.likes} suka</p>
      <p className={`text-[13px] mt-0.5 leading-snug ${palette.textPrimary}`}>
        <span className="font-semibold">{post.username}</span>
        <span className={`ml-1.5 ${palette.textMuted}`}>{post.caption}</span>
      </p>
    </div>
  )
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
