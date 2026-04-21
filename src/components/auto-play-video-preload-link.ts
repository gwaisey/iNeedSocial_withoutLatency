import { useEffect } from "react"

export function useVideoPreloadLink({
  candidateId,
  enabled,
  href,
}: {
  readonly candidateId: string
  readonly enabled: boolean
  readonly href?: string
}) {
  useEffect(() => {
    if (!enabled || !href) {
      return
    }

    if (typeof document === "undefined") {
      return
    }

    const link = document.createElement("link")
    link.rel = "preload"
    link.as = "video"
    link.href = href
    link.type = "video/mp4"
    link.setAttribute("fetchpriority", "high")
    link.dataset.videoPreloadCandidate = candidateId

    document.head.appendChild(link)
    return () => {
      link.remove()
    }
  }, [candidateId, enabled, href])
}

