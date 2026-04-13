import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import {
  getSessionStorage,
  readFeedSessionSnapshot,
  writeFeedSessionSnapshot,
  type FeedSessionSnapshot,
} from "../context/study-session-storage"
import {
  downloadSelfReport,
  getSupabaseStatusMessage,
  saveSessionData,
} from "../services/supabase"
import type { GenreKey, GenreTimes, Post, SessionReportPayload } from "../types/social"
import { getUserFacingErrorMessage } from "../utils/error-utils"
import { buildSessionReport, createEmptyGenreTimes } from "../utils/feed-session"

type ScrollContainerRef = RefObject<HTMLDivElement | null>
type HeaderRef = RefObject<HTMLDivElement | null>

type UseFeedSessionArgs = {
  appVersion: string
  headerRef: HeaderRef
  posts: Post[] | null
  scrollRef: ScrollContainerRef
  studySessionId: string
}

type PersistSnapshotOptions = Partial<FeedSessionSnapshot> & {
  commitActivePost?: boolean
}

const REGULAR_POST_SELECTOR = "[data-regular-post-id]"

export function useFeedSession({
  appVersion,
  headerRef,
  posts,
  scrollRef,
  studySessionId,
}: UseFeedSessionArgs) {
  const storageRef = useRef(getSessionStorage())
  const studySessionIdRef = useRef(studySessionId)
  const restoredSnapshotRef = useRef(
    readFeedSessionSnapshot(storageRef.current, studySessionIdRef.current)
  )
  const restoredSnapshot = restoredSnapshotRef.current
  const configMessage = getSupabaseStatusMessage()

  const [genreTimes, setGenreTimes] = useState<GenreTimes>(
    () => restoredSnapshot?.genreTimes ?? createEmptyGenreTimes()
  )
  const [finalizedGenreTimes, setFinalizedGenreTimes] = useState<GenreTimes | null>(
    () => restoredSnapshot?.finalizedGenreTimes ?? null
  )
  const [finalReport, setFinalReport] = useState<SessionReportPayload | null>(
    () => restoredSnapshot?.finalReport ?? null
  )
  const [isTimerOpen, setIsTimerOpen] = useState(restoredSnapshot?.isTimerOpen ?? false)
  const [isSavingSession, setIsSavingSession] = useState(false)
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    restoredSnapshot?.submissionMessage ?? configMessage
  )
  const [submissionHasError, setSubmissionHasError] = useState(
    restoredSnapshot?.submissionHasError ?? Boolean(configMessage)
  )

  const genreMapRef = useRef<Map<string, GenreKey>>(new Map())
  const genreTimesRef = useRef<GenreTimes>(genreTimes)
  const finalizedGenreTimesRef = useRef<GenreTimes | null>(finalizedGenreTimes)
  const finalReportRef = useRef<SessionReportPayload | null>(finalReport)
  const submissionMessageRef = useRef<string | null>(submissionMessage)
  const submissionHasErrorRef = useRef(submissionHasError)
  const isTimerOpenRef = useRef(isTimerOpen)
  const activePostIdRef = useRef<string | null>(null)
  const activePostStartedAtRef = useRef<number | null>(null)
  const pendingActiveStartedAtRef = useRef<number | null>(null)
  const evaluationFrameRef = useRef<number | null>(null)
  const hasSubmittedRef = useRef(restoredSnapshot?.hasSubmitted ?? false)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    genreTimesRef.current = genreTimes
  }, [genreTimes])

  useEffect(() => {
    finalizedGenreTimesRef.current = finalizedGenreTimes
  }, [finalizedGenreTimes])

  useEffect(() => {
    finalReportRef.current = finalReport
  }, [finalReport])

  useEffect(() => {
    submissionMessageRef.current = submissionMessage
  }, [submissionMessage])

  useEffect(() => {
    submissionHasErrorRef.current = submissionHasError
  }, [submissionHasError])

  useEffect(() => {
    isTimerOpenRef.current = isTimerOpen
  }, [isTimerOpen])

  useEffect(() => {
    genreMapRef.current = new Map((posts ?? []).map((post) => [post.id, post.genre] as const))

    if (
      posts &&
      posts.length > 0 &&
      !finalReportRef.current &&
      !activePostIdRef.current &&
      activePostStartedAtRef.current === null
    ) {
      pendingActiveStartedAtRef.current = Date.now()
    }
  }, [posts])

  const commitActivePostDuration = useCallback((now = Date.now()) => {
    const activePostId = activePostIdRef.current
    const activePostStartedAt = activePostStartedAtRef.current

    if (!activePostId || activePostStartedAt === null) {
      return genreTimesRef.current
    }

    const genre = genreMapRef.current.get(activePostId)
    if (!genre) {
      activePostStartedAtRef.current = now
      return genreTimesRef.current
    }

    const duration = Math.max(0, now - activePostStartedAt)
    if (duration === 0) {
      activePostStartedAtRef.current = now
      return genreTimesRef.current
    }

    const nextGenreTimes = {
      ...genreTimesRef.current,
      [genre]: genreTimesRef.current[genre] + duration,
    }

    genreTimesRef.current = nextGenreTimes
    activePostStartedAtRef.current = now
    setGenreTimes(nextGenreTimes)

    return nextGenreTimes
  }, [])

  const persistSessionSnapshot = useCallback(
    (options: PersistSnapshotOptions = {}) => {
      const nextGenreTimes = options.commitActivePost
        ? commitActivePostDuration()
        : (options.genreTimes ?? genreTimesRef.current)
      const snapshot: FeedSessionSnapshot = {
        genreTimes: nextGenreTimes,
        finalizedGenreTimes:
          options.finalizedGenreTimes ?? finalizedGenreTimesRef.current,
        finalReport: options.finalReport ?? finalReportRef.current,
        hasSubmitted: options.hasSubmitted ?? hasSubmittedRef.current,
        isTimerOpen: options.isTimerOpen ?? isTimerOpenRef.current,
        submissionHasError:
          options.submissionHasError ?? submissionHasErrorRef.current,
        submissionMessage: options.submissionMessage ?? submissionMessageRef.current,
      }

      writeFeedSessionSnapshot(
        storageRef.current,
        studySessionIdRef.current,
        snapshot
      )

      return snapshot
    },
    [commitActivePostDuration]
  )

  const finalizeAttributedTiming = useCallback(() => {
    const nextGenreTimes = commitActivePostDuration()
    activePostIdRef.current = null
    activePostStartedAtRef.current = null
    pendingActiveStartedAtRef.current = null
    return nextGenreTimes
  }, [commitActivePostDuration])

  const findDominantPostId = useCallback(() => {
    const container = scrollRef.current
    if (!container) {
      return null
    }

    const containerRect = container.getBoundingClientRect()
    const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? containerRect.top
    const viewportTop = Math.max(containerRect.top, headerBottom)
    const viewportBottom = containerRect.bottom
    const postElements = container.querySelectorAll<HTMLElement>(REGULAR_POST_SELECTOR)

    let bestPostId: string | null = null
    let bestVisibleArea = 0
    let bestTop = Number.POSITIVE_INFINITY

    postElements.forEach((element) => {
      const rect = element.getBoundingClientRect()
      const visibleTop = Math.max(rect.top, viewportTop)
      const visibleBottom = Math.min(rect.bottom, viewportBottom)
      const visibleHeight = visibleBottom - visibleTop

      if (visibleHeight <= 0) {
        return
      }

      const visibleArea = visibleHeight * Math.max(rect.width, 1)
      const postId = element.getAttribute("data-regular-post-id")
      if (!postId) {
        return
      }

      if (
        visibleArea > bestVisibleArea ||
        (visibleArea === bestVisibleArea && rect.top < bestTop)
      ) {
        bestPostId = postId
        bestVisibleArea = visibleArea
        bestTop = rect.top
      }
    })

    return bestPostId
  }, [headerRef, scrollRef])

  const scheduleActivePostEvaluation = useCallback(() => {
    if (!posts || finalReportRef.current) {
      return
    }

    if (evaluationFrameRef.current !== null) {
      return
    }

    evaluationFrameRef.current = window.requestAnimationFrame(() => {
      evaluationFrameRef.current = null

      const nextPostId = findDominantPostId()
      if (!nextPostId) {
        return
      }

      const currentPostId = activePostIdRef.current
      if (currentPostId === nextPostId) {
        return
      }

      const now = Date.now()

      if (currentPostId) {
        commitActivePostDuration(now)
      }

      activePostIdRef.current = nextPostId
      activePostStartedAtRef.current = currentPostId
        ? now
        : pendingActiveStartedAtRef.current ?? now
      pendingActiveStartedAtRef.current = null
    })
  }, [commitActivePostDuration, findDominantPostId, posts])

  useEffect(() => {
    if (!posts || finalReportRef.current) {
      return
    }

    const container = scrollRef.current
    if (!container) {
      return
    }

    const handlePositionChange = () => {
      scheduleActivePostEvaluation()
    }

    scheduleActivePostEvaluation()
    container.addEventListener("scroll", handlePositionChange, { passive: true })
    window.addEventListener("resize", handlePositionChange)

    return () => {
      container.removeEventListener("scroll", handlePositionChange)
      window.removeEventListener("resize", handlePositionChange)

      if (evaluationFrameRef.current !== null) {
        window.cancelAnimationFrame(evaluationFrameRef.current)
        evaluationFrameRef.current = null
      }
    }
  }, [posts, scheduleActivePostEvaluation, scrollRef])

  useEffect(() => {
    persistSessionSnapshot()
  }, [
    finalizedGenreTimes,
    finalReport,
    genreTimes,
    isTimerOpen,
    persistSessionSnapshot,
    submissionHasError,
    submissionMessage,
  ])

  useEffect(() => {
    const handlePageHide = () => {
      persistSessionSnapshot({ commitActivePost: true })
      activePostIdRef.current = null
      activePostStartedAtRef.current = null
      pendingActiveStartedAtRef.current = null
    }

    window.addEventListener("pagehide", handlePageHide)
    return () => window.removeEventListener("pagehide", handlePageHide)
  }, [persistSessionSnapshot])

  useEffect(() => {
    return () => {
      persistSessionSnapshot({ commitActivePost: true })
    }
  }, [persistSessionSnapshot])

  const openTimer = useCallback(async () => {
    setIsTimerOpen(true)
    isTimerOpenRef.current = true

    const nextGenreTimes = finalReportRef.current
      ? finalizedGenreTimesRef.current ?? genreTimesRef.current
      : finalizeAttributedTiming()
    const report =
      finalReportRef.current ??
      buildSessionReport(studySessionIdRef.current, nextGenreTimes, appVersion)

    if (!finalReportRef.current) {
      finalizedGenreTimesRef.current = nextGenreTimes
      finalReportRef.current = report
      setFinalizedGenreTimes(nextGenreTimes)
      setFinalReport(report)
    }

    persistSessionSnapshot({
      finalReport: report,
      finalizedGenreTimes: nextGenreTimes,
      genreTimes: nextGenreTimes,
      isTimerOpen: true,
    })

    if (hasSubmittedRef.current || isSubmittingRef.current) {
      return report
    }

    isSubmittingRef.current = true
    setIsSavingSession(true)
    setSubmissionHasError(false)
    setSubmissionMessage("Menyimpan sesi...")
    submissionHasErrorRef.current = false
    submissionMessageRef.current = "Menyimpan sesi..."
    persistSessionSnapshot({
      finalReport: report,
      finalizedGenreTimes: nextGenreTimes,
      genreTimes: nextGenreTimes,
      isTimerOpen: true,
      submissionHasError: false,
      submissionMessage: "Menyimpan sesi...",
    })

    try {
      await saveSessionData(report)
      hasSubmittedRef.current = true
      setSubmissionHasError(false)
      setSubmissionMessage("Sesi berhasil disimpan.")
      submissionHasErrorRef.current = false
      submissionMessageRef.current = "Sesi berhasil disimpan."
      persistSessionSnapshot({
        finalReport: report,
        finalizedGenreTimes: nextGenreTimes,
        genreTimes: nextGenreTimes,
        hasSubmitted: true,
        isTimerOpen: true,
        submissionHasError: false,
        submissionMessage: "Sesi berhasil disimpan.",
      })
    } catch (error) {
      const nextMessage = getUserFacingErrorMessage(
        error,
        "Sesi tidak dapat disimpan.",
        "feed-session:save"
      )

      setSubmissionHasError(true)
      setSubmissionMessage(nextMessage)
      submissionHasErrorRef.current = true
      submissionMessageRef.current = nextMessage
      persistSessionSnapshot({
        finalReport: report,
        finalizedGenreTimes: nextGenreTimes,
        genreTimes: nextGenreTimes,
        hasSubmitted: false,
        isTimerOpen: true,
        submissionHasError: true,
        submissionMessage: nextMessage,
      })
    } finally {
      isSubmittingRef.current = false
      setIsSavingSession(false)
    }

    return report
  }, [appVersion, finalizeAttributedTiming, persistSessionSnapshot])

  const closeTimerOverlay = useCallback(() => {
    setIsTimerOpen(false)
    isTimerOpenRef.current = false
    persistSessionSnapshot({ isTimerOpen: false })
  }, [persistSessionSnapshot])

  const downloadReport = useCallback(async () => {
    const nextGenreTimes = finalReportRef.current
      ? finalizedGenreTimesRef.current ?? genreTimesRef.current
      : finalizeAttributedTiming()
    const report =
      finalReportRef.current ??
      buildSessionReport(studySessionIdRef.current, nextGenreTimes, appVersion)

    if (!finalReportRef.current) {
      finalizedGenreTimesRef.current = nextGenreTimes
      finalReportRef.current = report
      setFinalizedGenreTimes(nextGenreTimes)
      setFinalReport(report)
    }

    persistSessionSnapshot({
      finalReport: report,
      finalizedGenreTimes: nextGenreTimes,
      genreTimes: nextGenreTimes,
      isTimerOpen: isTimerOpenRef.current,
    })

    try {
      await downloadSelfReport(report)
    } catch (error) {
      const nextMessage = getUserFacingErrorMessage(
        error,
        "Gagal mengekspor laporan.",
        "feed-session:export"
      )

      setSubmissionHasError(true)
      setSubmissionMessage(nextMessage)
      submissionHasErrorRef.current = true
      submissionMessageRef.current = nextMessage
      persistSessionSnapshot({
        finalReport: report,
        finalizedGenreTimes: nextGenreTimes,
        genreTimes: nextGenreTimes,
        isTimerOpen: isTimerOpenRef.current,
        submissionHasError: true,
        submissionMessage: nextMessage,
      })
    }
  }, [appVersion, finalizeAttributedTiming, persistSessionSnapshot])

  return {
    closeTimerOverlay,
    commitActivePostDuration,
    downloadReport,
    finalReport,
    finalizedGenreTimes,
    genreTimes,
    isSavingSession,
    isTimerOpen,
    openTimer,
    persistSessionSnapshot,
    scheduleActivePostEvaluation,
    submissionHasError,
    submissionMessage,
  }
}
