import { useEffect, useState } from "react"
import type { FeedPayload, ThemeMode } from "../types/social"
import { socialFeedService } from "../services/feed-service"
import { getUserFacingErrorMessage } from "../utils/error-utils"

type UseFeedLoaderArgs = {
  themeMode: ThemeMode
}

export function useFeedLoader({ themeMode }: UseFeedLoaderArgs) {
  const [payload, setPayload] = useState<FeedPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [feedRequestKey, setFeedRequestKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadFeed() {
      setIsLoading(true)
      setFeedError(null)

      try {
        const nextPayload = await socialFeedService.getFeedByTheme(themeMode)
        if (!active) {
          return
        }

        setPayload(nextPayload)
      } catch (error) {
        if (!active) {
          return
        }

        setFeedError(
          getUserFacingErrorMessage(error, "Feed tidak dapat dimuat.", "feed-page:load")
        )
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadFeed()

    return () => {
      active = false
    }
  }, [feedRequestKey, themeMode])

  return {
    feedError,
    isLoading,
    payload,
    retryFeed: () => setFeedRequestKey((current) => current + 1),
  }
}
