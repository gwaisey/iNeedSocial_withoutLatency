import { KNOWN_VIDEO_POSTER_DIMENSIONS } from "./auto-play-video-poster-dimensions"

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

function getCloudflareStreamCustomerCode() {
  const customerCode = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim()
  return customerCode ? customerCode : undefined
}

function buildAspectRatio(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    return undefined
  }

  return `${width} / ${height}`
}

export function getNormalizedVideoSource(src?: string) {
  const normalizedSrc = src?.trim()
  return normalizedSrc ? normalizedSrc : undefined
}

export function isDirectVideoFileSource(src?: string) {
  return /\.mp4($|\?)/i.test(src ?? "")
}

function getLocalVideoPosterSource(src?: string) {
  if (!src?.includes("/content/videos/") || !isDirectVideoFileSource(src)) {
    return undefined
  }

  return src.replace("/content/videos/", "/content/video-posters/").replace(/\.mp4$/, ".jpg")
}

export function getCloudflareStreamManifestUrl(
  streamUid?: string,
  customerCode = getCloudflareStreamCustomerCode()
) {
  const normalizedStreamUid = streamUid?.trim()
  if (!normalizedStreamUid || !customerCode) {
    return undefined
  }

  return `https://customer-${customerCode}.cloudflarestream.com/${normalizedStreamUid}/manifest/video.m3u8`
}

export function getCloudflareStreamThumbnailUrl(
  streamUid?: string,
  customerCode = getCloudflareStreamCustomerCode()
) {
  const normalizedStreamUid = streamUid?.trim()
  if (!normalizedStreamUid || !customerCode) {
    return undefined
  }

  return `https://customer-${customerCode}.cloudflarestream.com/${normalizedStreamUid}/thumbnails/thumbnail.jpg`
}

export function getResolvedVideoSource(src?: string, streamUid?: string) {
  return getCloudflareStreamManifestUrl(streamUid) ?? getNormalizedVideoSource(src)
}

export function getVideoPosterSource(src?: string, poster?: string, streamUid?: string) {
  if (poster) {
    return poster
  }

  const streamPoster = getCloudflareStreamThumbnailUrl(streamUid)
  if (streamPoster) {
    return streamPoster
  }

  return getLocalVideoPosterSource(src)
}

export function getKnownVideoPosterDimensions(src?: string, poster?: string, streamUid?: string) {
  const posterSources = [
    getVideoPosterSource(src, poster, streamUid),
    getLocalVideoPosterSource(src),
  ]

  for (const posterSrc of posterSources) {
    if (!posterSrc) {
      continue
    }

    const dimensions = KNOWN_VIDEO_POSTER_DIMENSIONS[posterSrc]
    if (dimensions) {
      return dimensions
    }
  }

  return undefined
}

export function getKnownVideoAspectRatio(src?: string, poster?: string, streamUid?: string) {
  if (!src) {
    return undefined
  }

  const learnedAspectRatio = learnedVideoAspectRatios.get(src)
  if (learnedAspectRatio) {
    return learnedAspectRatio
  }

  const dimensions = getKnownVideoPosterDimensions(src, poster, streamUid)
  return dimensions ? buildAspectRatio(dimensions.width, dimensions.height) : undefined
}

export function rememberVideoAspectRatio(src: string | undefined, aspectRatio: string | null) {
  if (!src || !aspectRatio) {
    return
  }

  learnedVideoAspectRatios.set(src, aspectRatio)
}
