export type VideoPreloadDirection = "above" | "below" | "visible"

type VideoPreloadCandidate = {
  canPrewarm: boolean
  distancePx: number
  direction: VideoPreloadDirection
  notify: (canUseAutoPreload: boolean) => void
}

const MAX_AUTO_PRELOAD_VIDEOS = 4
const MAX_AUTO_PRELOAD_DISTANCE_PX = 2200
const MAX_UP_NEXT_PRELOAD_VIDEOS = 1
const MAX_UP_NEXT_PRELOAD_DISTANCE_PX = 3600
const registry = new Map<string, VideoPreloadCandidate>()

function getPreloadDirectionPriority(direction: VideoPreloadDirection) {
  switch (direction) {
    case "visible":
      return 0
    case "below":
      return 1
    case "above":
    default:
      return 2
  }
}

function compareCandidates(
  left: [string, VideoPreloadCandidate],
  right: [string, VideoPreloadCandidate]
) {
  const directionPriorityDifference =
    getPreloadDirectionPriority(left[1].direction) - getPreloadDirectionPriority(right[1].direction)

  if (directionPriorityDifference !== 0) {
    return directionPriorityDifference
  }

  return left[1].distancePx - right[1].distancePx
}

function getEligibleCandidates(maxDistancePx: number) {
  return [...registry.entries()]
    .filter(([, candidate]) => {
      return (
        candidate.canPrewarm &&
        Number.isFinite(candidate.distancePx) &&
        candidate.distancePx <= maxDistancePx
      )
    })
    .sort(compareCandidates)
}

function recomputeBudget() {
  const eligibleCandidates = getEligibleCandidates(MAX_AUTO_PRELOAD_DISTANCE_PX)

  const autoPreloadIds = new Set(
    eligibleCandidates
      .slice(0, MAX_AUTO_PRELOAD_VIDEOS)
      .map(([candidateId]) => candidateId)
  )

  getEligibleCandidates(MAX_UP_NEXT_PRELOAD_DISTANCE_PX)
    .filter(([, candidate]) => candidate.direction === "below")
    .slice(0, MAX_UP_NEXT_PRELOAD_VIDEOS)
    .forEach(([candidateId]) => {
      autoPreloadIds.add(candidateId)
    })

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
    direction: "below",
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
    direction,
  }: {
    canPrewarm: boolean
    distancePx: number
    direction: VideoPreloadDirection
  }
) {
  const candidate = registry.get(candidateId)
  if (!candidate) {
    return
  }

  candidate.canPrewarm = canPrewarm
  candidate.distancePx = canPrewarm ? distancePx : Number.POSITIVE_INFINITY
  candidate.direction = direction
  recomputeBudget()
}

export function resetVideoPreloadBudgetForTests() {
  registry.clear()
}
