import { describe, expect, it, vi } from "vitest"
import {
  registerVideoPreloadCandidate,
  resetVideoPreloadBudgetForTests,
  unregisterVideoPreloadCandidate,
  updateVideoPreloadCandidate,
} from "./video-preload-budget"

describe("video preload budget", () => {
  it("grants auto preload only to the closest eligible videos", () => {
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

    updateVideoPreloadCandidate("video-a", {
      canPrewarm: true,
      distancePx: 0,
    })
    updateVideoPreloadCandidate("video-b", {
      canPrewarm: true,
      distancePx: 320,
    })
    updateVideoPreloadCandidate("video-c", {
      canPrewarm: true,
      distancePx: 640,
    })

    expect(notifications.get("video-a")).toBe(true)
    expect(notifications.get("video-b")).toBe(true)
    expect(notifications.get("video-c")).toBe(false)

    unregisterVideoPreloadCandidate("video-a")

    expect(notifications.get("video-b")).toBe(true)
    expect(notifications.get("video-c")).toBe(true)
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
    })
    updateVideoPreloadCandidate("far", {
      canPrewarm: true,
      distancePx: 1_400,
    })

    expect(notifyNear).toHaveBeenLastCalledWith(true)
    expect(notifyFar).toHaveBeenLastCalledWith(false)

    updateVideoPreloadCandidate("near", {
      canPrewarm: false,
      distancePx: 0,
    })

    expect(notifyNear).toHaveBeenLastCalledWith(false)
  })
})
