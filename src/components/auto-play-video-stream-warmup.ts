import { useEffect } from "react"
import { getCloudflareStreamOrigin } from "./auto-play-video-config"

const STREAM_WARMUP_LINK_ATTR = "data-cloudflare-stream-warmup"
const warmedStreamManifestRequests = new Map<string, Promise<Response>>()
let hlsRuntimePreloadPromise: Promise<typeof import("hls.js")> | null = null

function hasHeadLink(rel: string, href: string) {
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)).some(
    (link) => link.getAttribute("href") === href
  )
}

function appendHeadLink({
  crossOrigin,
  href,
  rel,
}: {
  readonly crossOrigin?: "anonymous"
  readonly href: string
  readonly rel: "dns-prefetch" | "preconnect"
}) {
  if (typeof document === "undefined" || hasHeadLink(rel, href)) {
    return
  }

  const link = document.createElement("link")
  link.rel = rel
  link.href = href
  link.setAttribute(STREAM_WARMUP_LINK_ATTR, "true")

  if (crossOrigin) {
    link.crossOrigin = crossOrigin
  }

  document.head.appendChild(link)
}

function ensureCloudflareStreamPreconnect(origin?: string) {
  if (!origin) {
    return
  }

  appendHeadLink({ href: origin, rel: "dns-prefetch" })
  appendHeadLink({
    crossOrigin: "anonymous",
    href: origin,
    rel: "preconnect",
  })
}

export function preloadHlsRuntime() {
  if (!hlsRuntimePreloadPromise) {
    hlsRuntimePreloadPromise = import("hls.js").catch((error) => {
      hlsRuntimePreloadPromise = null
      throw error
    })
  }

  return hlsRuntimePreloadPromise
}

export function warmCloudflareStreamManifest(manifestUrl?: string) {
  if (!manifestUrl || typeof fetch !== "function") {
    return undefined
  }

  const existingRequest = warmedStreamManifestRequests.get(manifestUrl)
  if (existingRequest) {
    return existingRequest
  }

  const request = fetch(manifestUrl, {
    cache: "force-cache",
    credentials: "omit",
    mode: "cors",
  }).catch((error) => {
    warmedStreamManifestRequests.delete(manifestUrl)
    throw error
  })

  warmedStreamManifestRequests.set(manifestUrl, request)
  return request
}

export function resetCloudflareStreamWarmupState() {
  warmedStreamManifestRequests.clear()
  hlsRuntimePreloadPromise = null

  if (typeof document === "undefined") {
    return
  }

  document.head
    .querySelectorAll(`[${STREAM_WARMUP_LINK_ATTR}]`)
    .forEach((link) => link.remove())
}

export function useCloudflareStreamWarmup({
  enabled,
  manifestUrl,
}: {
  readonly enabled: boolean
  readonly manifestUrl?: string
}) {
  useEffect(() => {
    if (!enabled || !manifestUrl) {
      return
    }

    ensureCloudflareStreamPreconnect(getCloudflareStreamOrigin())
    void preloadHlsRuntime().catch(() => {})
    void warmCloudflareStreamManifest(manifestUrl)?.catch(() => {})
  }, [enabled, manifestUrl])
}
