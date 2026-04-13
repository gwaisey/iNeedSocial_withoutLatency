import { describe, expect, it } from "vitest"
import {
  ensureStudySession,
  readInteractionState,
  startNewStudySession,
  writeInteractionState,
  type StorageLike,
} from "./study-session-storage"

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
})
