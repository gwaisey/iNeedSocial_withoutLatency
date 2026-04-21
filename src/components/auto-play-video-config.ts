export const VIDEO_PRELOAD_ROOT_MARGIN = "5200px 0px"
export const VIDEO_PLAY_START_OVERLAP_PX = 140
export const VIDEO_PLAY_STOP_OVERLAP_PX = 56
export const VIDEO_RESET_DISTANCE_PX = 220
export const VIDEO_EARLY_LOAD_DISTANCE_PX = 1800
export const DEFAULT_VIDEO_ASPECT_RATIO = "9 / 16"
export const VIDEO_READY_STATE_CURRENT_DATA = 2
export const VIDEO_READY_STATE_FUTURE_DATA = 3
export const VIDEO_REVEAL_PLAYBACK_PROGRESS_S = 0.03

const learnedVideoAspectRatios = new Map<string, string>()

export function getNormalizedVideoSource(src?: string) {
  const normalizedSrc = src?.trim()
  return normalizedSrc ? normalizedSrc : undefined
}

export function getKnownVideoAspectRatio(src?: string) {
  return src ? learnedVideoAspectRatios.get(src) : undefined
}

export function getVideoPosterSource(src?: string, poster?: string) {
  if (poster) {
    return poster
  }

  if (!src?.includes("/content/videos/") || !src.endsWith(".mp4")) {
    return undefined
  }

  return src.replace("/content/videos/", "/content/video-posters/").replace(/\.mp4$/, ".jpg")
}

export function rememberVideoAspectRatio(src: string | undefined, aspectRatio: string | null) {
  if (!src || !aspectRatio) {
    return
  }

  learnedVideoAspectRatios.set(src, aspectRatio)
}
