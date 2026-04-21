import { describe, expect, it } from "vitest"
import {
  buildVideoAspectRatio,
  deriveVideoViewportState,
  getVideoPlaybackDecision,
  shouldEarlyLoadNearViewport,
  shouldEnsureViewportData,
  shouldForceAutoPreload,
} from "./auto-play-video-state"

describe("auto-play video state", () => {
  it("uses overlap hysteresis before treating a video as visibly active", () => {
    expect(
      deriveVideoViewportState({
        rootBottom: 800,
        rootTop: 0,
        targetBottom: 900,
        targetTop: 700,
        wasVisible: false,
      })
    ).toEqual({
      centerOffset: 400,
      distanceToViewport: 0,
      isInViewport: true,
      isVisible: false,
    })

    expect(
      deriveVideoViewportState({
        rootBottom: 800,
        rootTop: 0,
        targetBottom: 900,
        targetTop: 650,
        wasVisible: false,
      })
    ).toEqual({
      centerOffset: 375,
      distanceToViewport: 0,
      isInViewport: true,
      isVisible: true,
    })

    expect(
      deriveVideoViewportState({
        rootBottom: 800,
        rootTop: 0,
        targetBottom: 900,
        targetTop: 744,
        wasVisible: true,
      })
    ).toEqual({
      centerOffset: 422,
      distanceToViewport: 0,
      isInViewport: true,
      isVisible: true,
    })

    expect(
      deriveVideoViewportState({
        rootBottom: 800,
        rootTop: 0,
        targetBottom: 900,
        targetTop: 760,
        wasVisible: true,
      })
    ).toEqual({
      centerOffset: 430,
      distanceToViewport: 0,
      isInViewport: true,
      isVisible: false,
    })
  })

  it("pauses or resets offscreen media and only plays active visible videos", () => {
    expect(
      getVideoPlaybackDecision({
        currentTime: 6,
        distanceToViewport: 0,
        isActive: false,
        isInViewport: true,
        isPlaybackOwner: false,
        isPaused: false,
        isVisible: true,
      })
    ).toEqual({
      shouldPause: true,
      shouldPlay: false,
      shouldReset: true,
    })

    expect(
      getVideoPlaybackDecision({
        currentTime: 4,
        distanceToViewport: 280,
        isActive: true,
        isInViewport: false,
        isPlaybackOwner: false,
        isPaused: true,
        isVisible: false,
      })
    ).toEqual({
      shouldPause: true,
      shouldPlay: false,
      shouldReset: true,
    })

    expect(
      getVideoPlaybackDecision({
        currentTime: 0,
        distanceToViewport: 0,
        isActive: true,
        isInViewport: true,
        isPlaybackOwner: false,
        isPaused: true,
        isVisible: false,
      })
    ).toEqual({
      shouldPause: true,
      shouldPlay: false,
      shouldReset: false,
    })

    expect(
      getVideoPlaybackDecision({
        currentTime: 0,
        distanceToViewport: 0,
        isActive: true,
        isInViewport: true,
        isPlaybackOwner: false,
        isPaused: false,
        isVisible: true,
      })
    ).toEqual({
      shouldPause: true,
      shouldPlay: false,
      shouldReset: false,
    })

    expect(
      getVideoPlaybackDecision({
        currentTime: 0,
        distanceToViewport: 0,
        isActive: true,
        isInViewport: true,
        isPlaybackOwner: true,
        isPaused: true,
        isVisible: true,
      })
    ).toEqual({
      shouldPause: false,
      shouldPlay: true,
      shouldReset: false,
    })
  })

  it("decides when viewport data and preload escalation are allowed", () => {
    expect(
      shouldEnsureViewportData({
        hasEnsuredViewportData: false,
        isInViewport: true,
        isPaused: true,
        readyState: 0,
      })
    ).toBe(true)

    expect(
      shouldEnsureViewportData({
        hasEnsuredViewportData: true,
        isInViewport: true,
        isPaused: true,
        readyState: 0,
      })
    ).toBe(false)

    expect(
      shouldForceAutoPreload({
        canUseAutoPreload: true,
        hasForcedPreload: false,
        isInViewport: false,
        isVisible: false,
        readyState: 0,
      })
    ).toBe(true)

    expect(
      shouldForceAutoPreload({
        canUseAutoPreload: true,
        hasForcedPreload: false,
        isInViewport: true,
        isVisible: true,
        readyState: 0,
      })
    ).toBe(false)

    expect(
      shouldEarlyLoadNearViewport({
        distanceToViewport: 240,
        hasLoadedFrame: false,
        isActive: true,
        readyState: 0,
      })
    ).toBe(true)

    expect(
      shouldEarlyLoadNearViewport({
        distanceToViewport: 1_600,
        hasLoadedFrame: false,
        isActive: true,
        readyState: 0,
      })
    ).toBe(false)
  })

  it("builds aspect ratios only from valid intrinsic sizes", () => {
    expect(
      buildVideoAspectRatio({
        videoHeight: 960,
        videoWidth: 540,
      })
    ).toBe("540 / 960")

    expect(
      buildVideoAspectRatio({
        videoHeight: 0,
        videoWidth: 540,
      })
    ).toBeNull()
  })
})
