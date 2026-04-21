import { describe, expect, it, vi } from "vitest"
import {
  registerVideoPreloadCandidate,
  resetVideoPreloadBudgetForTests,
  unregisterVideoPreloadCandidate,
  updateVideoPreloadCandidate,
} from "./video-preload-budget"

describe("video preload budget", () => {
  it("prefers visible and below-viewport videos before above-viewport videos", () => {
    resetVideoPreloadBudgetForTests()

    const notifications = new Map<string, boolean>()

    const connectCandidate = (candidateId: string) => {
      registerVideoPreloadCandidate(candidateId, (canUseAutoPreload) => {
        notifications.set(candidateId, canUseAutoPreload)
      })
    }

    connectCandidate("video-a")
    connectCandidate("video-b")
    connectCandidate("video-c")
    connectCandidate("video-d")
    connectCandidate("video-e")

    updateVideoPreloadCandidate("video-a", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("video-b", {
      canPrewarm: true,
      distancePx: 320,
      direction: "below",
    })
    updateVideoPreloadCandidate("video-c", {
      canPrewarm: true,
      distancePx: 24,
      direction: "above",
    })
    updateVideoPreloadCandidate("video-d", {
      canPrewarm: true,
      distancePx: 960,
      direction: "below",
    })
    updateVideoPreloadCandidate("video-e", {
      canPrewarm: true,
      distancePx: 1_280,
      direction: "below",
    })

    expect(notifications.get("video-a")).toBe(true)
    expect(notifications.get("video-b")).toBe(true)
    expect(notifications.get("video-c")).toBe(false)
    expect(notifications.get("video-d")).toBe(true)
    expect(notifications.get("video-e")).toBe(true)

    unregisterVideoPreloadCandidate("video-a")

    expect(notifications.get("video-b")).toBe(true)
    expect(notifications.get("video-c")).toBe(true)
    expect(notifications.get("video-d")).toBe(true)
    expect(notifications.get("video-e")).toBe(true)
  })

  it("excludes faraway or disabled candidates from the auto preload pool", () => {
    resetVideoPreloadBudgetForTests()

    const notifyNear = vi.fn()
    const notifyFar = vi.fn()

    registerVideoPreloadCandidate("near", notifyNear)
    registerVideoPreloadCandidate("far", notifyFar)

    updateVideoPreloadCandidate("near", {
      canPrewarm: true,
      distancePx: 200,
      direction: "below",
    })
    updateVideoPreloadCandidate("far", {
      canPrewarm: true,
      distancePx: 2_400,
      direction: "below",
    })

    expect(notifyNear).toHaveBeenLastCalledWith(true)
    expect(notifyFar).toHaveBeenLastCalledWith(false)

    updateVideoPreloadCandidate("near", {
      canPrewarm: false,
      distancePx: 0,
      direction: "below",
    })

    expect(notifyNear).toHaveBeenLastCalledWith(false)
  })
})
