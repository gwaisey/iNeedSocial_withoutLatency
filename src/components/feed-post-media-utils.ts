export type MediaSurfaceTokens = {
  placeholder: string
  skeletonTone: string
  surface: string
}

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
  return (video.clientWidth * video.videoHeight) / video.videoWidth
}

export function buildImageAspectRatioHeight(image: HTMLImageElement) {
  return (image.clientWidth * image.naturalHeight) / image.naturalWidth
}
