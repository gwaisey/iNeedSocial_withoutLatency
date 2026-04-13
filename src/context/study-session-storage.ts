import type { GenreTimes, SessionReportPayload } from "../types/social"

export type InteractionState = Record<string, boolean>

export type InteractionKind = "liked" | "reposted"

export type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">

const ACTIVE_SESSION_KEY = "gaby:study:active-session"
const FEED_SNAPSHOT_SUFFIX = "feed-session"
const TUTORIAL_STATE_SUFFIX = "tutorial"

export type TutorialState = {
  completed: boolean
  currentStep: number
}

export type FeedSessionSnapshot = {
  genreTimes: GenreTimes
  finalizedGenreTimes: GenreTimes | null
  finalReport: SessionReportPayload | null
  hasSubmitted: boolean
  isTimerOpen: boolean
  submissionHasError: boolean
  submissionMessage: string | null
}

function buildInteractionKey(sessionId: string, kind: InteractionKind) {
  return `gaby:study:${sessionId}:${kind}`
}

function buildSessionScopedKey(sessionId: string, suffix: string) {
  return `gaby:study:${sessionId}:${suffix}`
}

function createSessionId() {
  return `study_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function createDefaultTutorialState(): TutorialState {
  return {
    completed: false,
    currentStep: 0,
  }
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function removeStudySessionData(storage: StorageLike, sessionId: string) {
  storage.removeItem(buildInteractionKey(sessionId, "liked"))
  storage.removeItem(buildInteractionKey(sessionId, "reposted"))
  storage.removeItem(buildSessionScopedKey(sessionId, FEED_SNAPSHOT_SUFFIX))
  storage.removeItem(buildSessionScopedKey(sessionId, TUTORIAL_STATE_SUFFIX))
}

export function getSessionStorage(): StorageLike | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function ensureStudySession(storage: StorageLike | null) {
  if (!storage) {
    return createSessionId()
  }

  const existing = storage.getItem(ACTIVE_SESSION_KEY)
  if (existing) {
    return existing
  }

  const nextSessionId = createSessionId()
  storage.setItem(ACTIVE_SESSION_KEY, nextSessionId)
  return nextSessionId
}

export function startNewStudySession(storage: StorageLike | null) {
  if (!storage) {
    return createSessionId()
  }

  const currentSessionId = storage.getItem(ACTIVE_SESSION_KEY)
  if (currentSessionId) {
    removeStudySessionData(storage, currentSessionId)
  }

  const nextSessionId = createSessionId()
  storage.setItem(ACTIVE_SESSION_KEY, nextSessionId)
  return nextSessionId
}

export function readInteractionState(
  storage: StorageLike | null,
  sessionId: string,
  kind: InteractionKind
) {
  if (!storage) {
    return {}
  }

  return safeParse(storage.getItem(buildInteractionKey(sessionId, kind)), {})
}

export function writeInteractionState(
  storage: StorageLike | null,
  sessionId: string,
  kind: InteractionKind,
  value: InteractionState
) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(buildInteractionKey(sessionId, kind), JSON.stringify(value))
  } catch {
    // Storage can be unavailable in restricted environments.
  }
}

export function readTutorialState(storage: StorageLike | null, sessionId: string): TutorialState {
  if (!storage) {
    return createDefaultTutorialState()
  }

  return safeParse(
    storage.getItem(buildSessionScopedKey(sessionId, TUTORIAL_STATE_SUFFIX)),
    createDefaultTutorialState()
  )
}

export function writeTutorialState(
  storage: StorageLike | null,
  sessionId: string,
  value: TutorialState
) {
  if (!storage) {
    return
  }

  try {
    storage.setItem(
      buildSessionScopedKey(sessionId, TUTORIAL_STATE_SUFFIX),
      JSON.stringify(value)
    )
  } catch {
    // Storage can be unavailable in restricted environments.
  }
}

export function readFeedSessionSnapshot(
  storage: StorageLike | null,
  sessionId: string
): FeedSessionSnapshot | null {
  if (!storage) {
    return null
  }

  return safeParse<FeedSessionSnapshot | null>(
    storage.getItem(buildSessionScopedKey(sessionId, FEED_SNAPSHOT_SUFFIX)),
    null
  )
}

export function writeFeedSessionSnapshot(
  storage: StorageLike | null,
  sessionId: string,
  value: FeedSessionSnapshot | null
) {
  if (!storage) {
    return
  }

  try {
    const key = buildSessionScopedKey(sessionId, FEED_SNAPSHOT_SUFFIX)
    if (value === null) {
      storage.removeItem(key)
      return
    }

    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable in restricted environments.
  }
}
