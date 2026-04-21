export type MediaSurfaceTokens = {
  placeholder: string
  skeletonTone: string
  surface: string
}

const DEFAULT_VIDEO_HEIGHT_RATIO = 16 / 9

export function isVideoSource(src?: string) {
  return Boolean(src?.endsWith(".mp4"))
}

export function getMediaSurfaceTokens(isDark: boolean): MediaSurfaceTokens {
  return {
    placeholder: isDark ? "bg-white/8" : "bg-ink/8",
    skeletonTone: isDark ? "skeleton-dark" : "",
    surface: isDark ? "bg-white/8" : "bg-ink/8",
  }
}

export function buildVideoAspectRatioHeight(video: HTMLVideoElement) {
  return video.clientWidth * DEFAULT_VIDEO_HEIGHT_RATIO
}

export function buildImageAspectRatioHeight(image: HTMLImageElement) {
  return (image.clientWidth * image.naturalHeight) / image.naturalWidth
}
