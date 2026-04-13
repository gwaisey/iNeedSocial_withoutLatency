import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { downloadSelfReport, getSupabaseStatusMessage, saveSessionData } from "../services/supabase"
import type { GenreKey, GenreTimes, Post, SessionReportPayload } from "../types/social"
import { getUserFacingErrorMessage } from "../utils/error-utils"
import {
  buildSessionReport,
  createEmptyGenreTimes,
} from "../utils/feed-session"

type ScrollContainerRef = RefObject<HTMLDivElement | null>
type HeaderRef = RefObject<HTMLDivElement | null>

type UseFeedSessionArgs = {
  appVersion: string
  headerRef: HeaderRef
  posts: Post[] | null
  scrollRef: ScrollContainerRef
}

const REGULAR_POST_SELECTOR = "[data-regular-post-id]"

export function useFeedSession({
  appVersion,
  headerRef,
  posts,
  scrollRef,
}: UseFeedSessionArgs) {
  const [genreTimes, setGenreTimes] = useState<GenreTimes>(() => createEmptyGenreTimes())
  const [finalizedGenreTimes, setFinalizedGenreTimes] = useState<GenreTimes | null>(null)
  const [finalReport, setFinalReport] = useState<SessionReportPayload | null>(null)
  const [isSavingSession, setIsSavingSession] = useState(false)
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    getSupabaseStatusMessage()
  )
  const [submissionHasError, setSubmissionHasError] = useState(
    Boolean(getSupabaseStatusMessage())
  )

  const sessionIdRef = useRef(
    `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  )
  const genreMapRef = useRef<Map<string, GenreKey>>(new Map())
  const genreTimesRef = useRef<GenreTimes>(genreTimes)
  const activePostIdRef = useRef<string | null>(null)
  const activePostStartedAtRef = useRef<number | null>(null)
  const pendingActiveStartedAtRef = useRef<number | null>(null)
  const evaluationFrameRef = useRef<number | null>(null)
  const hasSubmittedRef = useRef(false)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    genreTimesRef.current = genreTimes
  }, [genreTimes])

  useEffect(() => {
    genreMapRef.current = new Map(
      (posts ?? []).map((post) => [post.id, post.genre] as const)
    )

    if (
      posts &&
      posts.length > 0 &&
      !finalReport &&
      !activePostIdRef.current &&
      activePostStartedAtRef.current === null
    ) {
      pendingActiveStartedAtRef.current = Date.now()
    }
  }, [finalReport, posts])

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

  const finalizeAttributedTiming = useCallback(() => {
    const nextGenreTimes = commitActivePostDuration()
    activePostIdRef.current = null
    activePostStartedAtRef.current = null
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
    if (!posts || finalReport) {
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
  }, [commitActivePostDuration, finalReport, findDominantPostId, posts])

  useEffect(() => {
    if (!posts || finalReport) {
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
  }, [finalReport, posts, scheduleActivePostEvaluation, scrollRef])

  const openTimer = useCallback(async () => {
    const nextGenreTimes = finalReport
      ? finalizedGenreTimes ?? genreTimesRef.current
      : finalizeAttributedTiming()
    const report =
      finalReport ?? buildSessionReport(sessionIdRef.current, nextGenreTimes, appVersion)

    if (!finalReport) {
      setFinalizedGenreTimes(nextGenreTimes)
      setFinalReport(report)
    }

    if (hasSubmittedRef.current || isSubmittingRef.current) {
      return report
    }

    isSubmittingRef.current = true
    setIsSavingSession(true)
    setSubmissionHasError(false)
    setSubmissionMessage("Menyimpan sesi...")

    try {
      await saveSessionData(report)
      hasSubmittedRef.current = true
      setSubmissionHasError(false)
      setSubmissionMessage("Sesi berhasil disimpan.")
    } catch (error) {
      setSubmissionHasError(true)
      setSubmissionMessage(
        getUserFacingErrorMessage(error, "Sesi tidak dapat disimpan.", "feed-session:save")
      )
    } finally {
      isSubmittingRef.current = false
      setIsSavingSession(false)
    }

    return report
  }, [appVersion, finalReport, finalizedGenreTimes, finalizeAttributedTiming])

  const downloadReport = useCallback(async () => {
    const nextGenreTimes = finalReport
      ? finalizedGenreTimes ?? genreTimesRef.current
      : finalizeAttributedTiming()
    const report =
      finalReport ?? buildSessionReport(sessionIdRef.current, nextGenreTimes, appVersion)

    if (!finalReport) {
      setFinalizedGenreTimes(nextGenreTimes)
      setFinalReport(report)
    }

    try {
      await downloadSelfReport(report)
    } catch (error) {
      setSubmissionHasError(true)
      setSubmissionMessage(
        getUserFacingErrorMessage(error, "Gagal mengekspor laporan.", "feed-session:export")
      )
    }
  }, [appVersion, finalReport, finalizedGenreTimes, finalizeAttributedTiming])

  return {
    commitActivePostDuration,
    downloadReport,
    finalReport,
    finalizedGenreTimes,
    genreTimes,
    isSavingSession,
    openTimer,
    scheduleActivePostEvaluation,
    submissionHasError,
    submissionMessage,
  }
}
