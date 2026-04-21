import { fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AutoPlayVideo } from "./auto-play-video"

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin: string
  readonly thresholds: ReadonlyArray<number>

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {}
  ) {
    this.rootMargin = options.rootMargin ?? "0px"
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0]
  }

  disconnect() {}

  observe(target: Element) {
    this.callback(
      [
        {
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRatio: 1,
          intersectionRect: target.getBoundingClientRect(),
          isIntersecting: true,
          rootBounds: null,
          target,
          time: 0,
        },
      ],
      this
    )
  }

  takeRecords() {
    return []
  }

  unobserve() {}
}

describe("AutoPlayVideo", () => {
  let originalIntersectionObserver: typeof window.IntersectionObserver
  let originalPlay: typeof HTMLMediaElement.prototype.play
  let originalPause: typeof HTMLMediaElement.prototype.pause
  let originalLoad: typeof HTMLMediaElement.prototype.load
  let originalRequestVideoFrameCallback: unknown
  let originalCancelVideoFrameCallback: unknown

  beforeEach(() => {
    originalIntersectionObserver = window.IntersectionObserver
    originalPlay = HTMLMediaElement.prototype.play
    originalPause = HTMLMediaElement.prototype.pause
    originalLoad = HTMLMediaElement.prototype.load
    originalRequestVideoFrameCallback = Reflect.get(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback"
    )
    originalCancelVideoFrameCallback = Reflect.get(
      HTMLVideoElement.prototype,
      "cancelVideoFrameCallback"
    )

    window.IntersectionObserver = MockIntersectionObserver
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.load = vi.fn()
  })

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
    HTMLMediaElement.prototype.load = originalLoad

    if (typeof originalRequestVideoFrameCallback === "undefined") {
      Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback")
    } else {
      Reflect.set(
        HTMLVideoElement.prototype,
        "requestVideoFrameCallback",
        originalRequestVideoFrameCallback
      )
    }

    if (typeof originalCancelVideoFrameCallback === "undefined") {
      Reflect.deleteProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback")
    } else {
      Reflect.set(
        HTMLVideoElement.prototype,
        "cancelVideoFrameCallback",
        originalCancelVideoFrameCallback
      )
    }

    vi.restoreAllMocks()
  })

  it("does not render a video element when src is missing", () => {
    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} poster="/poster.jpg" />
    )

    expect(container.querySelector("video")).toBeNull()
  })

  it("mounts the shell without attaching a real src while the video stays offscreen and out of the preload pool", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 7_600,
      height: 600,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 7_000,
      width: 360,
      x: 0,
      y: 7_000,
    } as DOMRect)

    const { container } = render(
      <AutoPlayVideo
        canPrewarm={true}
        className="video"
        isMuted={true}
        poster="/poster.jpg"
        src="/content/videos/pinata.mp4"
      />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    const video = container.querySelector("video")
    expect(video?.getAttribute("src")).toBeNull()
    expect(video).toHaveAttribute("preload", "none")
  })

  it("waits for requestVideoFrameCallback before revealing the video when available", async () => {
    let queuedAnimationFrame: FrameRequestCallback | null = null
    let frameCallback: (() => void) | null = null

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      queuedAnimationFrame = callback
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})

    Reflect.set(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback",
      vi.fn((callback: () => void) => {
        frameCallback = callback
        return 1
      })
    )
    Reflect.set(HTMLVideoElement.prototype, "cancelVideoFrameCallback", vi.fn())

    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos/pinata.mp4" />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })
    const video = container.querySelector("video")

    video!.currentTime = 0.04
    fireEvent.loadedData(video!)
    expect(video).toHaveClass("opacity-0")
    expect(frameCallback).not.toBeNull()
    expect(queuedAnimationFrame).not.toBeNull()

    const queuedFrameCallback = frameCallback as (() => void) | null
    if (!queuedFrameCallback) {
      throw new Error("Expected requestVideoFrameCallback to be queued.")
    }

    queuedFrameCallback()

    await waitFor(() => {
      expect(video).toHaveClass("opacity-100")
    })
  })

  it("falls back to immediate readiness when requestVideoFrameCallback is unavailable", async () => {
    Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback")
    Reflect.deleteProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback")

    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos/pinata.mp4" />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })
    const video = container.querySelector("video")

    video!.currentTime = 0.04
    fireEvent.loadedData(video!)

    await waitFor(() => {
      expect(video).toHaveClass("opacity-100")
    })
  })

  it("updates the shell ratio based on video metadata", async () => {
    const { container } = render(
      <AutoPlayVideo className="video" isMuted={true} src="/content/videos/pinata.mp4" />
    )

    await waitFor(() => {
      expect(container.querySelector("video")).not.toBeNull()
    })

    const video = container.querySelector("video") as HTMLVideoElement
    const shell = video.parentElement as HTMLDivElement

    Object.defineProperty(video, "videoWidth", {
      configurable: true,
      value: 432,
    })
    Object.defineProperty(video, "videoHeight", {
      configurable: true,
      value: 768,
    })

    fireEvent.loadedMetadata(video)

    expect(shell.style.aspectRatio).toBe("432 / 768")
  })
})
