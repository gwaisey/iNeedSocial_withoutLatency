import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"
import type { ThemeMode } from "../types/social"

type ScrollContainerRef = RefObject<HTMLDivElement | null>

type FeedScrollAnchor = {
  postId: string
  offset: number
}

type FeedScrollState = {
  scrollTop: number
  anchor: FeedScrollAnchor | null
  theme: ThemeMode
}

type UseFeedThemeScrollArgs = {
  isFeedReady: boolean
  scheduleActivePostEvaluation: () => void
  scrollRef: ScrollContainerRef
  themeMode: ThemeMode
}

const REGULAR_POST_SELECTOR = "[data-regular-post-id]"

export function useFeedThemeScroll({
  isFeedReady,
  scheduleActivePostEvaluation,
  scrollRef,
  themeMode,
}: UseFeedThemeScrollArgs) {
  const pendingScrollStateRef = useRef<FeedScrollState | null>(null)

  const findRegularPostElement = useCallback((postId: string) => {
    const container = scrollRef.current
    if (!container) {
      return null
    }

    const postElements = container.querySelectorAll<HTMLElement>(REGULAR_POST_SELECTOR)
    for (const element of postElements) {
      if (element.getAttribute("data-regular-post-id") === postId) {
        return element
      }
    }

    return null
  }, [scrollRef])

  const captureScrollAnchor = useCallback((): FeedScrollAnchor | null => {
    const container = scrollRef.current
    if (!container) {
      return null
    }

    const containerRect = container.getBoundingClientRect()
    const postElements = container.querySelectorAll<HTMLElement>(REGULAR_POST_SELECTOR)

    for (const element of postElements) {
      const rect = element.getBoundingClientRect()
      const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom

      if (!isVisible) {
        continue
      }

      const postId = element.getAttribute("data-regular-post-id")
      if (!postId) {
        continue
      }

      return {
        postId,
        offset: rect.top - containerRect.top,
      }
    }

    return null
  }, [scrollRef])

  const captureScrollState = useCallback((): FeedScrollState | null => {
    const container = scrollRef.current
    if (!container) {
      return null
    }

    return {
      anchor: captureScrollAnchor(),
      scrollTop: container.scrollTop,
      theme: themeMode,
    }
  }, [captureScrollAnchor, scrollRef, themeMode])

  const restoreScrollState = useCallback(
    (scrollState: FeedScrollState, preferAnchor: boolean) => {
      const container = scrollRef.current
      if (!container) {
        return false
      }

      if (!preferAnchor) {
        container.scrollTop = scrollState.scrollTop
      }

      if (scrollState.anchor) {
        const element = findRegularPostElement(scrollState.anchor.postId)
        if (element) {
          const containerRect = container.getBoundingClientRect()
          const elementRect = element.getBoundingClientRect()
          const delta = elementRect.top - containerRect.top - scrollState.anchor.offset

          if (Math.abs(delta) > 0.5) {
            container.scrollTop += delta
          }

          return true
        }
      }

      if (preferAnchor) {
        container.scrollTop = scrollState.scrollTop
      }

      return true
    },
    [findRegularPostElement, scrollRef]
  )

  useLayoutEffect(() => {
    const scrollState = pendingScrollStateRef.current
    const container = scrollRef.current

    if (!scrollState || !container || !isFeedReady) {
      return
    }

    pendingScrollStateRef.current = null
    const prefersAnchorFirst = scrollState.theme !== themeMode
    restoreScrollState(scrollState, prefersAnchorFirst)
    scheduleActivePostEvaluation()

    const animationFrame = window.requestAnimationFrame(() => {
      restoreScrollState(scrollState, true)
      scheduleActivePostEvaluation()
    })
    const timeoutId = window.setTimeout(() => {
      restoreScrollState(scrollState, true)
      scheduleActivePostEvaluation()
    }, 160)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(timeoutId)
    }
  }, [
    isFeedReady,
    restoreScrollState,
    scheduleActivePostEvaluation,
    scrollRef,
    themeMode,
  ])

  const captureThemeToggleScrollState = useCallback(() => {
    pendingScrollStateRef.current = captureScrollState()
  }, [captureScrollState])

  return {
    captureThemeToggleScrollState,
  }
}
