type VideoPreloadCandidate = {
  canPrewarm: boolean
  distancePx: number
  notify: (canUseAutoPreload: boolean) => void
}

const MAX_AUTO_PRELOAD_VIDEOS = 4
const MAX_AUTO_PRELOAD_DISTANCE_PX = 2200
const registry = new Map<string, VideoPreloadCandidate>()

function recomputeBudget() {
  const eligibleCandidates = [...registry.entries()]
    .filter(([, candidate]) => {
      return (
        candidate.canPrewarm &&
        Number.isFinite(candidate.distancePx) &&
        candidate.distancePx <= MAX_AUTO_PRELOAD_DISTANCE_PX
      )
    })
    .sort((left, right) => left[1].distancePx - right[1].distancePx)

  const autoPreloadIds = new Set(
    eligibleCandidates
      .slice(0, MAX_AUTO_PRELOAD_VIDEOS)
      .map(([candidateId]) => candidateId)
  )

  registry.forEach((candidate, candidateId) => {
    candidate.notify(autoPreloadIds.has(candidateId))
  })
}

export function registerVideoPreloadCandidate(
  candidateId: string,
  notify: (canUseAutoPreload: boolean) => void
) {
  registry.set(candidateId, {
    canPrewarm: false,
    distancePx: Number.POSITIVE_INFINITY,
    notify,
  })
  recomputeBudget()
}

export function unregisterVideoPreloadCandidate(candidateId: string) {
  if (!registry.delete(candidateId)) {
    return
  }

  recomputeBudget()
}

export function updateVideoPreloadCandidate(
  candidateId: string,
  {
    canPrewarm,
    distancePx,
  }: {
    canPrewarm: boolean
    distancePx: number
  }
) {
  const candidate = registry.get(candidateId)
  if (!candidate) {
    return
  }

  candidate.canPrewarm = canPrewarm
  candidate.distancePx = canPrewarm ? distancePx : Number.POSITIVE_INFINITY
  recomputeBudget()
}

export function resetVideoPreloadBudgetForTests() {
  registry.clear()
}
