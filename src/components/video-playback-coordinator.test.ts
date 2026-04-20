import { describe, expect, it, vi } from "vitest"
import {
  registerVideoPlaybackCandidate,
  resetVideoPlaybackCoordinatorForTests,
  unregisterVideoPlaybackCandidate,
  updateVideoPlaybackCandidate,
} from "./video-playback-coordinator"

describe("video playback coordinator", () => {
  it("grants playback to only the closest eligible video", () => {
    resetVideoPlaybackCoordinatorForTests()

    const ownerA = vi.fn()
    const ownerB = vi.fn()
    const ownerC = vi.fn()

    registerVideoPlaybackCandidate("video-a", ownerA)
    registerVideoPlaybackCandidate("video-b", ownerB)
    registerVideoPlaybackCandidate("video-c", ownerC)

    updateVideoPlaybackCandidate("video-a", {
      priority: 240,
      shouldOwnPlayback: true,
    })
    updateVideoPlaybackCandidate("video-b", {
      priority: 120,
      shouldOwnPlayback: true,
    })
    updateVideoPlaybackCandidate("video-c", {
      priority: 420,
      shouldOwnPlayback: true,
    })

    expect(ownerA).toHaveBeenLastCalledWith(false)
    expect(ownerB).toHaveBeenLastCalledWith(true)
    expect(ownerC).toHaveBeenLastCalledWith(false)

    unregisterVideoPlaybackCandidate("video-b")

    expect(ownerA).toHaveBeenLastCalledWith(true)
    expect(ownerC).toHaveBeenLastCalledWith(false)
  })

  it("ignores candidates that are not allowed to own playback", () => {
    resetVideoPlaybackCoordinatorForTests()

    const ownerA = vi.fn()
    const ownerB = vi.fn()

    registerVideoPlaybackCandidate("video-a", ownerA)
    registerVideoPlaybackCandidate("video-b", ownerB)

    updateVideoPlaybackCandidate("video-a", {
      priority: 20,
      shouldOwnPlayback: false,
    })
    updateVideoPlaybackCandidate("video-b", {
      priority: 60,
      shouldOwnPlayback: true,
    })

    expect(ownerA).toHaveBeenLastCalledWith(false)
    expect(ownerB).toHaveBeenLastCalledWith(true)
  })
})
