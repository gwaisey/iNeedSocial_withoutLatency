import { KNOWN_VIDEO_POSTER_DIMENSIONS } from "./auto-play-video-poster-dimensions"

export const VIDEO_PRELOAD_ROOT_MARGIN = "12000px 0px"
export const VIDEO_PLAY_START_VISIBLE_RATIO = 0.35
export const VIDEO_PLAY_STOP_VISIBLE_RATIO = 0.35
export const VIDEO_PLAY_HANDOFF_VISIBLE_RATIO = 0.15
export const VIDEO_RESET_DISTANCE_PX = 220
export const VIDEO_EARLY_LOAD_DISTANCE_PX = 7200
export const VIDEO_AGGRESSIVE_AUTO_LOAD_MAX_RANK = 2
export const VIDEO_SOURCE_DETACH_GRACE_MS = 9000
export const VIDEO_SOURCE_IMMEDIATE_DETACH_DISTANCE_PX = 14000
export const DEFAULT_VIDEO_ASPECT_RATIO = "9 / 16"
export const VIDEO_READY_STATE_CURRENT_DATA = 2
export const VIDEO_READY_STATE_FUTURE_DATA = 3
export const VIDEO_REVEAL_PLAYBACK_PROGRESS_S = 0.03
export const VIDEO_VIEWPORT_INTERSECTION_THRESHOLDS = [
  0,
  VIDEO_PLAY_STOP_VISIBLE_RATIO,
  VIDEO_PLAY_START_VISIBLE_RATIO,
  0.75,
  1,
]

const learnedVideoAspectRatios = new Map<string, string>()
const DEFAULT_VIDEO_SOURCE_PREFIX = "/content/videos-default/"
const LEGACY_VIDEO_SOURCE_PREFIX = "/content/videos/"
const DEFAULT_APPWRITE_ENDPOINT = "https://sgp.cloud.appwrite.io/v1"
const DEFAULT_APPWRITE_PROJECT_ID = "69f22cb20001f8be28b3"
const DEFAULT_APPWRITE_BUCKET_ID = "69f2b4dd002f17ed5c64"

function getCloudflareStreamCustomerCode() {
  const customerCode = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim()
  return customerCode ? customerCode : undefined
}

function getAppwriteBucketId() {
  const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID?.trim() ?? DEFAULT_APPWRITE_BUCKET_ID
  return bucketId ? bucketId : undefined
}

function getAppwriteEndpoint() {
  const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT?.trim() ?? DEFAULT_APPWRITE_ENDPOINT
  return endpoint ? endpoint.replace(/\/$/, "") : undefined
}

function getAppwriteProjectId() {
  const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID?.trim() ?? DEFAULT_APPWRITE_PROJECT_ID
  return projectId ? projectId : undefined
}

function buildAspectRatio(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    return undefined
  }

  return `${width} / ${height}`
}

function normalizeLocalVideoSource(src?: string) {
  const normalizedSrc = src?.trim()
  if (!normalizedSrc) {
    return undefined
  }

  if (normalizedSrc.startsWith(DEFAULT_VIDEO_SOURCE_PREFIX)) {
    return normalizedSrc
  }

  if (normalizedSrc.startsWith(LEGACY_VIDEO_SOURCE_PREFIX)) {
    return normalizedSrc.replace(LEGACY_VIDEO_SOURCE_PREFIX, DEFAULT_VIDEO_SOURCE_PREFIX)
  }

  return normalizedSrc
}

export function getNormalizedVideoSource(src?: string) {
  let normalizedSrc = normalizeLocalVideoSource(src)

  const appwriteSrc = getAppwriteVideoSource(normalizedSrc)
  if (appwriteSrc) {
    normalizedSrc = appwriteSrc
  }

  return normalizedSrc ? normalizedSrc : undefined
}

export function getAppwriteStorageOrigin() {
  const endpoint = getAppwriteEndpoint()
  if (!endpoint) {
    return undefined
  }

  try {
    return new URL(endpoint).origin
  } catch {
    return undefined
  }
}

export function getAppwriteVideoSource(src?: string) {
  const normalizedSrc = normalizeLocalVideoSource(src)
  if (!normalizedSrc?.startsWith(DEFAULT_VIDEO_SOURCE_PREFIX)) {
    return undefined
  }

  const endpoint = getAppwriteEndpoint()
  const bucketId = getAppwriteBucketId()
  const projectId = getAppwriteProjectId()
  if (!endpoint || !bucketId || !projectId) {
    return undefined
  }

  const filename = normalizedSrc.split("/").pop()
  const fileId = filename?.replace(/\.mp4$/i, "")
  if (!fileId) {
    return undefined
  }

  return `${endpoint}/storage/buckets/${bucketId}/files/${encodeURIComponent(fileId)}/view?project=${encodeURIComponent(projectId)}`
}

export function isAppwriteStorageViewSource(src?: string) {
  return /\/storage\/buckets\/[^/]+\/files\/[^/]+\/view($|\?)/i.test(src ?? "")
}

export function isDirectVideoFileSource(src?: string) {
  return /\.mp4($|\?)/i.test(src ?? "") || isAppwriteStorageViewSource(src)
}

export function isHlsManifestSource(src?: string) {
  return /\.m3u8($|\?)/i.test(src ?? "")
}

function getLocalVideoPosterSource(src?: string) {
  const normalizedSrc = normalizeLocalVideoSource(src)
  if (!normalizedSrc?.includes(DEFAULT_VIDEO_SOURCE_PREFIX) || !isDirectVideoFileSource(normalizedSrc)) {
    return undefined
  }

  return normalizedSrc.replace(DEFAULT_VIDEO_SOURCE_PREFIX, "/content/video-posters/").replace(/\.mp4$/, ".jpg")
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

export function getCloudflareStreamDownloadUrl(
  streamUid?: string,
  customerCode = getCloudflareStreamCustomerCode()
) {
  const normalizedStreamUid = streamUid?.trim()
  if (!normalizedStreamUid || !customerCode) {
    return undefined
  }

  return `https://customer-${customerCode}.cloudflarestream.com/${normalizedStreamUid}/downloads/default.mp4`
}

export function getCloudflareStreamOrigin(customerCode = getCloudflareStreamCustomerCode()) {
  if (!customerCode) {
    return undefined
  }

  return `https://customer-${customerCode}.cloudflarestream.com`
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

export function getResolvedVideoSource(
  src?: string,
  streamUid?: string,
  streamDelivery: "hls" | "mp4" = "mp4"
) {
  const normalizedDirectSrc = getNormalizedVideoSource(src)

  // Prefer the configured object-storage MP4 source to avoid Cloudflare Stream costs.
  if (normalizedDirectSrc?.startsWith("http")) {
    return normalizedDirectSrc
  }

  if (streamDelivery === "mp4") {
    return getCloudflareStreamDownloadUrl(streamUid) ?? normalizedDirectSrc
  }

  return getCloudflareStreamManifestUrl(streamUid) ?? normalizedDirectSrc
}

export function getVideoPosterSource(src?: string, poster?: string, streamUid?: string) {
  if (poster) {
    return poster
  }

  const localPoster = getLocalVideoPosterSource(src)
  if (localPoster) {
    return localPoster
  }

  const streamPoster = getCloudflareStreamThumbnailUrl(streamUid)
  if (streamPoster) {
    return streamPoster
  }

  return undefined
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
