import { useEffect, useRef, useState, type RefObject } from "react"
import { VIDEO_EARLY_LOAD_DISTANCE_PX } from "./auto-play-video-config"
import { deriveVideoViewportState, getViewportBounds } from "./auto-play-video-state"

type ViewportSubscriber = () => void

type VideoViewportState = {
  readonly distanceToViewport: number
  readonly isInViewport: boolean
  readonly isVisible: boolean
  readonly playbackPriority: number
}

const INITIAL_VIDEO_VIEWPORT_STATE: VideoViewportState = {
  distanceToViewport: Number.POSITIVE_INFINITY,
  isInViewport: false,
  isVisible: false,
  playbackPriority: Number.POSITIVE_INFINITY,
}

const viewportSubscribers = new Set<ViewportSubscriber>()
let viewportScrollHandler: (() => void) | null = null
let viewportAnimationFrame: number | null = null

function scheduleViewportSubscribers() {
  if (viewportAnimationFrame !== null) {
    return
  }

  viewportAnimationFrame = window.requestAnimationFrame(() => {
    viewportAnimationFrame = null
    viewportSubscribers.forEach((subscriber) => subscriber())
  })
}

function subscribeToViewportEvents(subscriber: ViewportSubscriber) {
  viewportSubscribers.add(subscriber)

  if (!viewportScrollHandler) {
    viewportScrollHandler = scheduleViewportSubscribers
    document.addEventListener("scroll", viewportScrollHandler, { passive: true, capture: true })
    window.addEventListener("scroll", viewportScrollHandler, { passive: true })
    window.addEventListener("resize", viewportScrollHandler)
  }

  return () => {
    viewportSubscribers.delete(subscriber)
    if (viewportSubscribers.size > 0 || !viewportScrollHandler) {
      return
    }

    document.removeEventListener("scroll", viewportScrollHandler, true)
    window.removeEventListener("scroll", viewportScrollHandler)
    window.removeEventListener("resize", viewportScrollHandler)
    viewportScrollHandler = null

    if (viewportAnimationFrame !== null) {
      window.cancelAnimationFrame(viewportAnimationFrame)
      viewportAnimationFrame = null
    }
  }
}

export function useMountedVideoViewportState({
  hasVideoSource,
  scrollRootRef,
  shellRef,
  shouldMountVideo,
}: {
  readonly hasVideoSource: boolean
  readonly scrollRootRef?: RefObject<HTMLElement | null>
  readonly shellRef: RefObject<HTMLDivElement | null>
  readonly shouldMountVideo: boolean
}) {
  const wasVisibleRef = useRef(false)
  const [viewportState, setViewportState] = useState(INITIAL_VIDEO_VIEWPORT_STATE)

  useEffect(() => {
    if (hasVideoSource && shouldMountVideo) {
      return
    }

    wasVisibleRef.current = false
    setViewportState(INITIAL_VIDEO_VIEWPORT_STATE)
  }, [hasVideoSource, shouldMountVideo])

  useEffect(() => {
    if (!hasVideoSource || !shouldMountVideo) {
      return
    }

    const shell = shellRef.current
    if (!shell) {
      return
    }

    const updateViewportState = () => {
      const root = scrollRootRef?.current ?? null
      const { top: rootTop, bottom: rootBottom } = getViewportBounds(root)
      const shellRect = shell.getBoundingClientRect()
      const nextViewportState = deriveVideoViewportState({
        rootBottom,
        rootTop,
        targetBottom: shellRect.bottom,
        targetTop: shellRect.top,
        wasVisible: wasVisibleRef.current,
      })

      wasVisibleRef.current = nextViewportState.isVisible
      setViewportState({
        distanceToViewport: nextViewportState.distanceToViewport,
        isInViewport: nextViewportState.isInViewport,
        isVisible: nextViewportState.isVisible,
        playbackPriority: nextViewportState.centerOffset,
      })
    }

    updateViewportState()
    const unsubscribe = subscribeToViewportEvents(updateViewportState)
    return () => {
      unsubscribe()
    }
  }, [hasVideoSource, scrollRootRef, shellRef, shouldMountVideo])

  return {
    ...viewportState,
    isNearViewport: viewportState.distanceToViewport <= VIDEO_EARLY_LOAD_DISTANCE_PX,
  }
}
