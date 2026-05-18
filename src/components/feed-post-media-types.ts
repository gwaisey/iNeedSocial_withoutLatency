import type { RefObject } from "react"
import type { Post } from "../types/social"
import type { MediaSurfaceTokens } from "./feed-post-media-utils"

export type FeedMediaItem = Post["media"][number]
export type FeedMediaPriority = "high" | "low"

export type FeedPostMediaSectionProps = {
  readonly isMuted: boolean
  readonly mediaPriority: FeedMediaPriority
  readonly onToggleMute: () => void
  readonly post: Post
  readonly scrollRootRef?: RefObject<HTMLElement | null>
  readonly tokens: MediaSurfaceTokens
}

export type FeedPostImageMediaProps = {
  readonly mediaPriority: FeedMediaPriority
  readonly post: Post
  readonly tokens: MediaSurfaceTokens
}
