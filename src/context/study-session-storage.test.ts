import { describe, expect, it } from "vitest"
import {
  ensureStudySession,
  readFeedSessionSnapshot,
  readInteractionState,
  readTutorialState,
  startNewStudySession,
  writeInteractionState,
  writeFeedSessionSnapshot,
  writeTutorialState,
  type StorageLike,
} from "./study-session-storage"
import { createEmptyGenreTimes } from "../utils/feed-session"

function createMemoryStorage(): StorageLike {
  const storage = new Map<string, string>()

  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key)! : null
    },
    removeItem(key) {
      storage.delete(key)
    },
    setItem(key, value) {
      storage.set(key, value)
    },
  }
}

describe("study session storage", () => {
  it("persists interaction state inside the active session namespace", () => {
    const storage = createMemoryStorage()
    const sessionId = ensureStudySession(storage)

    writeInteractionState(storage, sessionId, "liked", { "post-1": true })

    expect(readInteractionState(storage, sessionId, "liked")).toEqual({ "post-1": true })
  })

  it("resets interaction state when a new study session starts", () => {
    const storage = createMemoryStorage()
    const firstSessionId = ensureStudySession(storage)

    writeInteractionState(storage, firstSessionId, "liked", { "post-1": true })
    writeInteractionState(storage, firstSessionId, "reposted", { "post-2": true })

    const secondSessionId = startNewStudySession(storage)

    expect(secondSessionId).not.toBe(firstSessionId)
    expect(readInteractionState(storage, secondSessionId, "liked")).toEqual({})
    expect(readInteractionState(storage, secondSessionId, "reposted")).toEqual({})
  })

  it("persists tutorial progress and feed snapshots inside the session namespace", () => {
    const storage = createMemoryStorage()
    const sessionId = ensureStudySession(storage)
    const genreTimes = createEmptyGenreTimes()
    genreTimes.humor = 2_000

    writeTutorialState(storage, sessionId, { completed: false, currentStep: 2 })
    writeFeedSessionSnapshot(storage, sessionId, {
      genreTimes,
      finalizedGenreTimes: null,
      finalReport: null,
      hasSubmitted: false,
      isTimerOpen: false,
      submissionHasError: false,
      submissionMessage: null,
    })

    expect(readTutorialState(storage, sessionId)).toEqual({
      completed: false,
      currentStep: 2,
    })
    expect(readFeedSessionSnapshot(storage, sessionId)?.genreTimes.humor).toBe(2_000)
  })

  it("resets tutorial progress and feed snapshots when a new study session starts", () => {
    const storage = createMemoryStorage()
    const firstSessionId = ensureStudySession(storage)

    writeTutorialState(storage, firstSessionId, { completed: false, currentStep: 1 })
    writeFeedSessionSnapshot(storage, firstSessionId, {
      genreTimes: createEmptyGenreTimes(),
      finalizedGenreTimes: null,
      finalReport: null,
      hasSubmitted: true,
      isTimerOpen: true,
      submissionHasError: false,
      submissionMessage: "Sesi berhasil disimpan.",
    })

    const secondSessionId = startNewStudySession(storage)

    expect(secondSessionId).not.toBe(firstSessionId)
    expect(readTutorialState(storage, secondSessionId)).toEqual({
      completed: false,
      currentStep: 0,
    })
    expect(readFeedSessionSnapshot(storage, secondSessionId)).toBeNull()
  })
})
