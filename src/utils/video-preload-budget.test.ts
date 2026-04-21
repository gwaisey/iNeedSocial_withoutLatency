import { describe, expect, it, vi } from "vitest"
import {
  registerVideoPreloadCandidate,
  resetVideoPreloadBudgetForTests,
  unregisterVideoPreloadCandidate,
  updateVideoPreloadCandidate,
} from "./video-preload-budget"

describe("video preload budget", () => {
  it("preloads only the nearest forward videos and excludes above-viewport candidates while forward videos exist", () => {
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

    expect(notifications.get("video-a")).toBe(false)
    expect(notifications.get("video-b")).toBe(true)
    expect(notifications.get("video-c")).toBe(false)
    expect(notifications.get("video-d")).toBe(true)
    expect(notifications.get("video-e")).toBe(false)

    unregisterVideoPreloadCandidate("video-a")

    expect(notifications.get("video-b")).toBe(true)
    expect(notifications.get("video-c")).toBe(false)
    expect(notifications.get("video-d")).toBe(true)
    expect(notifications.get("video-e")).toBe(false)
  })

  it("does not count visible candidates toward the forward preload budget", () => {
    resetVideoPreloadBudgetForTests()

    const notifications = new Map<string, boolean>()

    const connectCandidate = (candidateId: string) => {
      registerVideoPreloadCandidate(candidateId, (canUseAutoPreload) => {
        notifications.set(candidateId, canUseAutoPreload)
      })
    }

    connectCandidate("visible-a")
    connectCandidate("visible-b")
    connectCandidate("visible-c")
    connectCandidate("visible-d")
    connectCandidate("up-next-a")
    connectCandidate("up-next-b")
    connectCandidate("above-nearby")

    updateVideoPreloadCandidate("visible-a", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("visible-b", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("visible-c", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("visible-d", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("up-next-a", {
      canPrewarm: true,
      distancePx: 3_000,
      direction: "below",
    })
    updateVideoPreloadCandidate("up-next-b", {
      canPrewarm: true,
      distancePx: 4_400,
      direction: "below",
    })
    updateVideoPreloadCandidate("above-nearby", {
      canPrewarm: true,
      distancePx: 40,
      direction: "above",
    })

    expect(notifications.get("visible-a")).toBe(false)
    expect(notifications.get("visible-b")).toBe(false)
    expect(notifications.get("visible-c")).toBe(false)
    expect(notifications.get("visible-d")).toBe(false)
    expect(notifications.get("up-next-a")).toBe(true)
    expect(notifications.get("up-next-b")).toBe(true)
    expect(notifications.get("above-nearby")).toBe(false)
  })

  it("still allows above-viewport preloads when there are no forward candidates", () => {
    resetVideoPreloadBudgetForTests()

    const notifications = new Map<string, boolean>()

    const connectCandidate = (candidateId: string) => {
      registerVideoPreloadCandidate(candidateId, (canUseAutoPreload) => {
        notifications.set(candidateId, canUseAutoPreload)
      })
    }

    connectCandidate("visible")
    connectCandidate("above-nearby")
    connectCandidate("above-secondary")

    updateVideoPreloadCandidate("visible", {
      canPrewarm: true,
      distancePx: 0,
      direction: "visible",
    })
    updateVideoPreloadCandidate("above-nearby", {
      canPrewarm: true,
      distancePx: 40,
      direction: "above",
    })
    updateVideoPreloadCandidate("above-secondary", {
      canPrewarm: true,
      distancePx: 400,
      direction: "above",
    })

    expect(notifications.get("visible")).toBe(false)
    expect(notifications.get("above-nearby")).toBe(true)
    expect(notifications.get("above-secondary")).toBe(true)
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
      distancePx: 6_000,
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
