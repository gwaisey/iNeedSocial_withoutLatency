import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { BrandLogo } from "../components/brand-logo"
import { CommentSheet } from "../components/comment-sheet"
import { FeedPost } from "../components/feed-post"
import { RightPanel } from "../components/layout/RightPanel"
import { Sidebar } from "../components/layout/Sidebar"
import { TimerSummaryOverlay } from "../components/timer-summary-overlay"
import { ThemeToggle } from "../components/theme-toggle"
import { isTutorialDone, TutorialOverlay } from "../components/tutorial/TutorialOverlay"
import { useStudyState } from "../context/study-context"
import { useFeedSession } from "../hooks/use-feed-session"
import { socialFeedService } from "../services/feed-service"
import { getUserFacingErrorMessage } from "../utils/error-utils"
import {
  type FeedPayload,
  type ThemeMode,
} from "../types/social"

const APP_VERSION = "without_latency"
const REGULAR_POST_SELECTOR = "[data-regular-post-id]"

type ScrollAnchor = {
  postId: string
  offset: number
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

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
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
  const {
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
  } = useFeedSession({
    appVersion: APP_VERSION,
    headerRef,
    posts: payload?.posts ?? null,
    scrollRef,
  })

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

  const handleOpenTimer = useCallback(async () => {
    setShowTimer(true)
    await openTimer()
  }, [openTimer])

  const handleSelfDownload = useCallback(async () => {
    await downloadReport()
  }, [downloadReport])

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

        setPayload(nextPayload)
      } catch (error) {
        if (!active) {
          return
        }

        setFeedError(
          getUserFacingErrorMessage(error, "Feed tidak dapat dimuat.", "feed-page:load")
        )
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
    closeCommentSheet()
    setSearchParams({ theme: isDark ? "light" : "dark" })
  }

  const retryFeed = () => setFeedRequestKey((current) => current + 1)

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
        <TimerSummaryOverlay
          finalReport={finalReport}
          genreTimes={finalizedGenreTimes ?? genreTimes}
          isSavingSession={isSavingSession}
          onDownload={() => {
            void handleSelfDownload()
          }}
          onFinish={() => navigate("/thank-you")}
          submissionHasError={submissionHasError}
          submissionMessage={submissionMessage}
        />
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

