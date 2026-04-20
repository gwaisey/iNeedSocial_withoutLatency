type VideoPlaybackCandidate = {
  notify: (isPlaybackOwner: boolean) => void
  priority: number
  shouldOwnPlayback: boolean
}

const playbackRegistry = new Map<string, VideoPlaybackCandidate>()

function recomputePlaybackOwner() {
  const nextPlaybackOwnerId =
    [...playbackRegistry.entries()]
      .filter(([, candidate]) => {
        return candidate.shouldOwnPlayback && Number.isFinite(candidate.priority)
      })
      .sort((left, right) => {
        return left[1].priority - right[1].priority || left[0].localeCompare(right[0])
      })[0]?.[0] ?? null

  playbackRegistry.forEach((candidate, candidateId) => {
    candidate.notify(candidateId === nextPlaybackOwnerId)
  })
}

export function registerVideoPlaybackCandidate(
  candidateId: string,
  notify: (isPlaybackOwner: boolean) => void
) {
  playbackRegistry.set(candidateId, {
    notify,
    priority: Number.POSITIVE_INFINITY,
    shouldOwnPlayback: false,
  })
  recomputePlaybackOwner()
}

export function unregisterVideoPlaybackCandidate(candidateId: string) {
  if (!playbackRegistry.delete(candidateId)) {
    return
  }

  recomputePlaybackOwner()
}

export function updateVideoPlaybackCandidate(
  candidateId: string,
  {
    priority,
    shouldOwnPlayback,
  }: {
    priority: number
    shouldOwnPlayback: boolean
  }
) {
  const candidate = playbackRegistry.get(candidateId)
  if (!candidate) {
    return
  }

  candidate.priority = shouldOwnPlayback ? priority : Number.POSITIVE_INFINITY
  candidate.shouldOwnPlayback = shouldOwnPlayback
  recomputePlaybackOwner()
}

export function resetVideoPlaybackCoordinatorForTests() {
  playbackRegistry.clear()
}
