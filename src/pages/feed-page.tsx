import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { BrandLogo } from "../components/brand-logo"
import { CommentSheet } from "../components/comment-sheet"
import { FeedPost } from "../components/feed-post"
import { RightPanel } from "../components/layout/RightPanel"
import { Sidebar } from "../components/layout/Sidebar"
import { ThemeToggle } from "../components/theme-toggle"
import { isTutorialDone, TutorialOverlay } from "../components/tutorial/TutorialOverlay"
import { useStudyState } from "../context/study-context"
import { socialFeedService } from "../services/feed-service"
import {
  downloadSelfReport,
  getSupabaseStatusMessage,
  saveSessionData,
} from "../services/supabase"
import {
  type FeedPayload,
  type GenreKey,
  type GenreTimes,
  type SessionReportPayload,
  type ThemeMode,
} from "../types/social"

const APP_VERSION = "without_latency"
const REGULAR_POST_SELECTOR = "[data-regular-post-id]"
const GENRE_DISPLAY_ORDER: GenreKey[] = [
  "humor",
  "berita",
  "wisata",
  "makanan",
  "olahraga",
  "game",
]

const GENRE_META: Record<GenreKey, { label: string }> = {
  berita: { label: "Berita" },
  game: { label: "Game" },
  humor: { label: "Humor" },
  makanan: { label: "Makanan" },
  olahraga: { label: "Olahraga" },
  wisata: { label: "Wisata" },
}

type ScrollAnchor = {
  postId: string
  offset: number
}

function createEmptyGenreTimes(): GenreTimes {
  return {
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  }
}

function sumGenreTimes(genreTimes: GenreTimes) {
  return Object.values(genreTimes).reduce((total, value) => total + value, 0)
}

function buildDisplayedGenreBreakdown(genreTimes: GenreTimes) {
  const totalMs = sumGenreTimes(genreTimes)
  const displayedTotalSeconds = Math.floor(totalMs / 1000)

  const rows = GENRE_DISPLAY_ORDER.map((genre, index) => {
    const milliseconds = genreTimes[genre]
    const exactSeconds = milliseconds / 1000

    return {
      genre,
      milliseconds,
      percentage: totalMs > 0 ? ((milliseconds / totalMs) * 100).toFixed(1) : "0",
      displaySeconds: Math.floor(exactSeconds),
      remainder: exactSeconds - Math.floor(exactSeconds),
      order: index,
    }
  })

  let missingSeconds = displayedTotalSeconds - rows.reduce((sum, row) => sum + row.displaySeconds, 0)

  if (missingSeconds > 0) {
    rows
      .slice()
      .sort((left, right) => right.remainder - left.remainder || left.order - right.order)
      .forEach((row) => {
        if (missingSeconds <= 0) {
          return
        }

        row.displaySeconds += 1
        missingSeconds -= 1
      })
  }

  return rows
    .sort((left, right) => left.order - right.order)
    .map(({ order: _order, remainder: _remainder, ...row }) => row)
}

function buildSessionReport(sessionId: string, genreTimes: GenreTimes): SessionReportPayload {
  return {
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    total_time: sumGenreTimes(genreTimes),
    humor_ms: genreTimes.humor,
    berita_ms: genreTimes.berita,
    wisata_ms: genreTimes.wisata,
    makanan_ms: genreTimes.makanan,
    olahraga_ms: genreTimes.olahraga,
    game_ms: genreTimes.game,
    app_version: APP_VERSION,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  void error
  return fallback
}

export function FeedPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [payload, setPayload] = useState<FeedPayload | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [feedRequestKey, setFeedRequestKey] = useState(0)
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

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sessionIdRef = useRef("")
  const genreMapRef = useRef<Map<string, GenreKey>>(new Map())
  const genreTimesRef = useRef<GenreTimes>(genreTimes)
  const activePostIdRef = useRef<string | null>(null)
  const activePostStartedAtRef = useRef<number | null>(null)
  const pendingActiveStartedAtRef = useRef<number | null>(null)
  const evaluationFrameRef = useRef<number | null>(null)
  const hasSubmittedRef = useRef(false)
  const isSubmittingRef = useRef(false)
  const pendingScrollAnchorRef = useRef<ScrollAnchor | null>(null)

  const {
    commentSheet,
    likedPosts,
    repostedPosts,
    closeCommentSheet,
    openCommentSheet,
    toggleLiked,
    toggleReposted,
  } = useStudyState()

  const themeMode: ThemeMode =
    searchParams.get("theme") === "dark" ? "dark" : "light"
  const isDark = themeMode === "dark"

  useEffect(() => {
    genreTimesRef.current = genreTimes
  }, [genreTimes])

  useEffect(() => {
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }, [])

  const captureScrollAnchor = useCallback((): ScrollAnchor | null => {
    const container = scrollRef.current
    if (!container) {
      return null
    }

    const containerRect = container.getBoundingClientRect()
    const postElements = container.querySelectorAll<HTMLElement>(REGULAR_POST_SELECTOR)

    for (const element of postElements) {
      const rect = element.getBoundingClientRect()
      const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom

      if (!isVisible) {
        continue
      }

      const postId = element.getAttribute("data-regular-post-id")
      if (!postId) {
        continue
      }

      return {
        postId,
        offset: rect.top - containerRect.top,
      }
    }

    return null
  }, [])

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
  }, [])

  const scheduleActivePostEvaluation = useCallback(() => {
    if (!payload || finalReport) {
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
  }, [commitActivePostDuration, finalReport, findDominantPostId, payload])

  const handleOpenTimer = useCallback(async () => {
    const nextGenreTimes = finalReport
      ? finalizedGenreTimes ?? genreTimesRef.current
      : finalizeAttributedTiming()
    const report = finalReport ?? buildSessionReport(sessionIdRef.current, nextGenreTimes)

    if (!finalReport) {
      setFinalizedGenreTimes(nextGenreTimes)
      setFinalReport(report)
    }

    setShowTimer(true)

    if (hasSubmittedRef.current || isSubmittingRef.current) {
      return
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
      setSubmissionMessage(getErrorMessage(error, "Sesi tidak dapat disimpan."))
    } finally {
      isSubmittingRef.current = false
      setIsSavingSession(false)
    }
  }, [finalReport, finalizedGenreTimes, finalizeAttributedTiming])

  const handleSelfDownload = useCallback(async () => {
    const nextGenreTimes = finalReport
      ? finalizedGenreTimes ?? genreTimesRef.current
      : finalizeAttributedTiming()
    const report = finalReport ?? buildSessionReport(sessionIdRef.current, nextGenreTimes)

    if (!finalReport) {
      setFinalizedGenreTimes(nextGenreTimes)
      setFinalReport(report)
    }

    try {
      await downloadSelfReport(report)
    } catch (error) {
      setSubmissionHasError(true)
      setSubmissionMessage(getErrorMessage(error, "Gagal mengekspor laporan."))
    }
  }, [finalReport, finalizedGenreTimes, finalizeAttributedTiming])

  useEffect(() => {
    let active = true

    async function loadFeed() {
      setIsLoading(true)
      setFeedError(null)
      setPayload(null)

      try {
        const nextPayload = await socialFeedService.getFeedByTheme(themeMode)
        if (!active) {
          return
        }

        genreMapRef.current = new Map(
          nextPayload.posts.map((post) => [post.id, post.genre] as const)
        )
        if (!activePostIdRef.current && activePostStartedAtRef.current === null) {
          pendingActiveStartedAtRef.current = Date.now()
        }
        setPayload(nextPayload)
      } catch (error) {
        if (!active) {
          return
        }

        setFeedError(getErrorMessage(error, "Feed tidak dapat dimuat."))
        pendingActiveStartedAtRef.current = null
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadFeed()

    return () => {
      active = false
    }
  }, [feedRequestKey, themeMode])

  useEffect(() => {
    if (!payload || isTutorialDone()) {
      return
    }

    const timeoutId = window.setTimeout(() => setShowTutorial(true), 350)
    return () => window.clearTimeout(timeoutId)
  }, [payload])

  useEffect(() => {
    if (!payload || finalReport) {
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
  }, [finalReport, payload, scheduleActivePostEvaluation])

  useEffect(() => {
    commitActivePostDuration()
    closeCommentSheet()
  }, [closeCommentSheet, commitActivePostDuration, themeMode])

  useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current
    const container = scrollRef.current

    if (!anchor || !container || !payload) {
      return
    }

    const element = container.querySelector<HTMLElement>(
      `[data-regular-post-id="${anchor.postId}"]`
    )
    pendingScrollAnchorRef.current = null

    if (!element) {
      return
    }

    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const delta = elementRect.top - containerRect.top - anchor.offset

    if (delta !== 0) {
      container.scrollTop += delta
    }

    scheduleActivePostEvaluation()
  }, [payload, scheduleActivePostEvaluation, themeMode])

  useEffect(() => {
    const handler = () => {
      void handleOpenTimer()
    }

    window.addEventListener("timeropen", handler)
    return () => window.removeEventListener("timeropen", handler)
  }, [handleOpenTimer])

  const handleThemeToggle = () => {
    pendingScrollAnchorRef.current = captureScrollAnchor()
    commitActivePostDuration()
    setSearchParams({ theme: isDark ? "light" : "dark" })
  }

  const retryFeed = () => setFeedRequestKey((current) => current + 1)

  const displayedGenreTimes = finalizedGenreTimes ?? genreTimes
  const displayedElapsedMs = finalReport?.total_time ?? sumGenreTimes(displayedGenreTimes)
  const displayedBreakdown = buildDisplayedGenreBreakdown(displayedGenreTimes)
  const bgClass = isDark ? "bg-page-dark" : "bg-page-light"
  const textColor = isDark ? "text-white" : "text-ink"
  const dividerCls = isDark ? "divide-white/8" : "divide-ink/6"
  const borderCls = isDark ? "border-white/8" : "border-ink/8"

  return (
    <div className={`app-shell ${isDark ? "theme-dark" : ""}`}>
      <Sidebar theme={themeMode} />

      <main
        ref={scrollRef}
        className={`main-content no-scrollbar ${bgClass} ${textColor}`}
      >
        <div
          ref={headerRef}
          className={`sticky top-0 z-40 flex items-center px-4 py-3 border-b backdrop-blur-sm ${borderCls} ${
            isDark ? "bg-ink/90" : "bg-mist/90"
          }`}
        >
          <div className="w-[42px] lg:hidden shrink-0" />
          <div className="flex-1 flex justify-center lg:invisible">
            <BrandLogo color={isDark ? "#F5F4FB" : "#27262F"} width={60} />
          </div>
          <ThemeToggle isDark={isDark} onClick={handleThemeToggle} />
        </div>

        <div className="feed-wrapper">
          {isLoading && <FeedSkeleton isDark={isDark} />}

          {!isLoading && feedError && (
            <FeedErrorState
              isDark={isDark}
              message={feedError}
              onRetry={retryFeed}
            />
          )}

          {payload && !isLoading && !feedError && (
            <div className={`divide-y ${dividerCls}`}>
              {payload.posts.map((post, index) => (
                <div
                  key={`${post.id}-${index}`}
                  data-post-id={post.id}
                  data-regular-post-id={post.id}
                >
                  <RevealPost
                    isDark={isDark}
                    tutorialId={!isDark && index === 0 ? "tutorial-post" : undefined}
                  >
                    <FeedPost
                      isDark={isDark}
                      isLiked={Boolean(likedPosts[post.id])}
                      isReposted={Boolean(repostedPosts[post.id])}
                      onComment={() => openCommentSheet(post.id)}
                      onLike={() => toggleLiked(post.id)}
                      onRepost={() => toggleReposted(post.id)}
                      post={post}
                    />
                  </RevealPost>
                </div>
              ))}
            </div>
          )}

          {payload && !isLoading && !feedError && (
            <div className={`flex flex-col items-center gap-3 py-10 border-t ${borderCls}`}>
              <p
                className={`text-[11px] font-medium tracking-widest uppercase ${
                  isDark ? "text-white/35" : "text-ink/35"
                }`}
              >
                Sudah selesai melihat feed?
              </p>
              <button
                aria-label="Buka ringkasan waktu"
                className="
                  flex h-14 w-14 items-center justify-center rounded-full
                  bg-white shadow-[0_8px_24px_rgba(18,17,25,0.16)]
                  active:scale-95 transition-transform
                "
                onClick={() => {
                  void handleOpenTimer()
                }}
                type="button"
              >
                <BrandLogo color="#27262F" width={32} />
              </button>
            </div>
          )}
        </div>
      </main>

      <RightPanel theme={themeMode} />

      <button
        aria-label="Lihat ringkasan waktu"
        className="
          md:hidden fixed left-1/2 -translate-x-1/2 z-50
          flex h-14 w-14 items-center justify-center rounded-full
          bg-white shadow-[0_8px_28px_rgba(18,17,25,0.22)]
          active:scale-90 transition-transform
        "
        onClick={() => {
          void handleOpenTimer()
        }}
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        type="button"
      >
        <BrandLogo color="#27262F" width={30} />
      </button>

      {showTimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center gap-4 text-white text-center px-6 max-w-md">
            <BrandLogo color="#FFFFFF" width={48} />
            <div>
              <p className="text-base font-bold tracking-wide mb-3">Waktu yang Anda Habiskan</p>
              <p className="text-[clamp(2.5rem,12vw,4rem)] font-bold tabular-nums leading-none whitespace-nowrap">
                {formatElapsed(displayedElapsedMs)}
              </p>
              <div className="mt-3 flex justify-between px-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                <span>jam</span>
                <span>mnt</span>
                <span>dtk</span>
              </div>
            </div>

            <div className="w-full bg-white/10 rounded-lg p-4 mt-4 max-h-48 overflow-y-auto">
              <p className="text-sm font-bold uppercase tracking-widest mb-3 text-white/70">
                Rincian per Kategori
              </p>
              <div className="space-y-3">
                {displayedBreakdown.map(({ genre, percentage, displaySeconds }) => {
                  const meta = GENRE_META[genre]

                  return (
                    <div key={genre} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{meta.label}</span>
                      <span className="text-white/70">{displaySeconds}s ({percentage}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-sm font-semibold text-[#FF516B] max-w-[260px] leading-relaxed">
              Jangan lupa ambil tangkapan layar halaman ini dan kirimkan ke formulir kuesioner kami, ya!
            </p>

            {submissionMessage && (
              <p
                className={`max-w-[280px] text-xs leading-relaxed ${
                  submissionHasError ? "text-[#FFD3D9]" : "text-white/70"
                }`}
              >
                {submissionMessage}
              </p>
            )}

            <div className="flex gap-4 mt-2">
              <button
                aria-label="Lanjut ke halaman terima kasih"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg active:scale-95 transition-transform"
                onClick={() => navigate("/thank-you")}
                type="button"
              >
                <BrandLogo color="#27262F" width={28} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2 w-full">
              <button
                className="w-full py-3 bg-white text-ink font-bold rounded-full shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-70"
                disabled={isSavingSession}
                onClick={() => {
                  void handleSelfDownload()
                }}
                type="button"
              >
                Unduh Laporan Saya (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {commentSheet && <CommentSheet onClose={closeCommentSheet} />}
      {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}
    </div>
  )
}

function FeedErrorState({
  isDark,
  message,
  onRetry,
}: {
  readonly isDark: boolean
  readonly message: string
  readonly onRetry: () => void
}) {
  return (
    <div className={`px-4 py-10 ${isDark ? "text-white" : "text-ink"}`}>
      <div
        className={`rounded-3xl border px-5 py-6 text-center ${
          isDark ? "border-white/10 bg-white/5" : "border-ink/8 bg-white"
        }`}
      >
        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-ink"}`}>
          Feed tidak dapat dimuat.
        </p>
        <p className={`mt-2 text-sm leading-relaxed ${isDark ? "text-white/70" : "text-haze"}`}>
          {message}
        </p>
        <button
          className="mt-5 inline-flex items-center justify-center rounded-full bg-violet px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(119,109,255,0.35)] active:scale-95 transition-transform"
          onClick={onRetry}
          type="button"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  )
}

function SinglePostSkeleton({ isDark }: { isDark: boolean }) {
  const skeletonClass = isDark ? "bg-white/10" : "bg-ink/8"

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-3">
        <div className={`h-9 w-9 rounded-full animate-pulse ${skeletonClass}`} />
        <div className="space-y-1.5 flex-1">
          <div className={`h-3 w-24 rounded-full animate-pulse ${skeletonClass}`} />
          <div className={`h-2.5 w-14 rounded-full animate-pulse ${skeletonClass}`} />
        </div>
      </div>
      <div className={`w-full aspect-[4/5] animate-pulse ${skeletonClass}`} />
      <div className="flex items-center gap-3 px-3 py-2">
        <div className={`h-5 w-12 rounded-full animate-pulse ${skeletonClass}`} />
        <div className={`h-5 w-12 rounded-full animate-pulse ${skeletonClass}`} />
        <div className={`h-5 w-8 rounded-full animate-pulse ${skeletonClass}`} />
      </div>
      <div className="px-3 py-3 space-y-2">
        <div className={`h-3 w-20 rounded-full animate-pulse ${skeletonClass}`} />
        <div className={`h-3 w-48 rounded-full animate-pulse ${skeletonClass}`} />
      </div>
    </div>
  )
}

function FeedSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className={`divide-y ${isDark ? "divide-white/8" : "divide-ink/6"}`}>
      {Array.from({ length: 3 }).map((_, index) => (
        <SinglePostSkeleton key={index} isDark={isDark} />
      ))}
    </div>
  )
}

function RevealPost({
  children,
  isDark,
  tutorialId,
}: {
  children: React.ReactNode
  isDark: boolean
  tutorialId?: string
}) {
  const [revealed, setRevealed] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (revealed) {
      return
    }

    const element = ref.current
    if (!element) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [revealed])

  return (
    <div ref={ref} {...(tutorialId ? { "data-tutorial-id": tutorialId } : {})}>
      {revealed ? children : <SinglePostSkeleton isDark={isDark} />}
    </div>
  )
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSeconds % 60).padStart(2, "0")
  return `${hours} : ${minutes} : ${seconds}`
}
