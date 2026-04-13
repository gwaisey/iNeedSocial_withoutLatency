export type InteractionState = Record<string, boolean>

export type InteractionKind = "liked" | "reposted"

export type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">

const ACTIVE_SESSION_KEY = "gaby:study:active-session"

function buildInteractionKey(sessionId: string, kind: InteractionKind) {
  return `gaby:study:${sessionId}:${kind}`
}

function createSessionId() {
  return `study_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function safeParse(value: string | null): InteractionState {
  if (!value) {
    return {}
  }

  try {
    return JSON.parse(value) as InteractionState
  } catch {
    return {}
  }
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
    storage.removeItem(buildInteractionKey(currentSessionId, "liked"))
    storage.removeItem(buildInteractionKey(currentSessionId, "reposted"))
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

  return safeParse(storage.getItem(buildInteractionKey(sessionId, kind)))
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
