export function isVideoSource(src?: string) {
  return Boolean(src?.endsWith(".mp4"))
}
