import React, { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { RightPanel } from "../components/layout/RightPanel"
import { Sidebar } from "../components/layout/Sidebar"
import { BrandLogo } from "../components/brand-logo"
import { CommentSheet } from "../components/comment-sheet"
import { FeedPost } from "../components/feed-post"
import { ThemeToggle } from "../components/theme-toggle"
import { isTutorialDone, TutorialOverlay } from "../components/tutorial/TutorialOverlay"
import { useStudyState } from "../context/study-context"
import { socialFeedService } from "../services/feed-service"
import { type FeedPayload, type ThemeMode } from "../types/social"
import { saveSessionData, downloadAllReports, downloadSelfReport } from "../services/supabase"

interface GenreTime {
  humor: number
  berita: number
  wisata: number
  makanan: number
  olahraga: number
  game: number
}

export function FeedPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [payload, setPayload] = useState<FeedPayload | null>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Genre tracking
  const [genreTimes, setGenreTimes] = useState<GenreTime>({
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  })
  const [devClicks, setDevClicks] = useState(0)

  const sessionIdRef = useRef<string>('')
  const postStartTimeRef = useRef<Map<string, number>>(new Map())
  const genreMapRef = useRef<Map<string, string>>(new Map())

  const {
    commentSheet,
    feedStartedAt,
    likedPosts,
    repostedPosts,
    closeCommentSheet,
    openCommentSheet,
    startFeedTimer,
    toggleLiked,
    toggleReposted,
  } = useStudyState()

  // Initialize session ID
  useEffect(() => {
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log('✅ Session ID:', sessionIdRef.current)
    startFeedTimer()
  }, [startFeedTimer])

  const themeMode: ThemeMode =
    searchParams.get("theme") === "dark" ? "dark" : "light"
  const isDark = themeMode === "dark"

  // Load feed
  useEffect(() => {
    let active = true
    setPayload(null)
    socialFeedService.getFeedByTheme(themeMode).then((r) => {
      if (active) {
        setPayload(r)
        // Build genre map
        r.posts.forEach((post: any) => {
          genreMapRef.current.set(post.id, post.genre || 'humor')
        })
        console.log('✅ Feed loaded, genre map created')
      }
    })
    return () => { active = false }
  }, [themeMode])

  // Show tutorial once on first load after feed renders
  useEffect(() => {
    if (!payload || isTutorialDone()) return
    const t = setTimeout(() => setShowTutorial(true), 350)
    return () => clearTimeout(t)
  }, [payload])

  // Reset scroll + hero index on theme change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    setHeroIndex(0)
    closeCommentSheet()
  }, [themeMode, closeCommentSheet])

  // Auto-advance hero carousel (dark mode only)
  useEffect(() => {
    if (!isDark || !payload?.heroSlides.length) return undefined
    const id = window.setInterval(
      () => setHeroIndex((i) => (i + 1) % payload.heroSlides.length),
      2600
    )
    return () => window.clearInterval(id)
  }, [isDark, payload])

  // Setup IntersectionObserver for genre tracking
  useEffect(() => {
    if (!payload) return

    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5,
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postElement = entry.target as HTMLElement
        const postId = postElement.getAttribute('data-post-id')
        const genre = genreMapRef.current.get(postId || '') as keyof GenreTime | undefined

        if (!postId || !genre) return

        if (entry.isIntersecting) {
          postStartTimeRef.current.set(postId, Date.now())
          console.log('👀 Post visible:', postId, 'Genre:', genre)
        } else {
          const startTime = postStartTimeRef.current.get(postId)
          if (startTime) {
            const duration = Date.now() - startTime
            setGenreTimes((prev) => ({
              ...prev,
              [genre]: prev[genre] + duration,
            }))
            console.log('⏱️ Post tracked:', postId, `${duration}ms`)
            postStartTimeRef.current.delete(postId)
          }
        }
      })
    }, observerOptions)

    const postElements = document.querySelectorAll('[data-post-id]')
    postElements.forEach((el) => observer.observe(el))

    return () => {
      postElements.forEach((el) => observer.unobserve(el))
    }
  }, [payload])

  useEffect(() => {
    const handler = () => setShowTimer(true)
    window.addEventListener("timeropen", handler)
    return () => window.removeEventListener("timeropen", handler)
  }, [])

  const handleOpenTimer = async () => {
    // Finalize visible posts
    postStartTimeRef.current.forEach((startTime, postId) => {
      const duration = Date.now() - startTime
      const genre = genreMapRef.current.get(postId) as keyof GenreTime | undefined
      if (genre) {
        setGenreTimes((prev) => ({
          ...prev,
          [genre]: prev[genre] + duration,
        }))
      }
    })
    postStartTimeRef.current.clear()

    setShowTimer(true)
    
    // Send data after state updates
    setTimeout(() => sendDataToSuabase(), 100)
  }

  const sendDataToSuabase = async () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0)

    const payload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency',
    }

    console.log('📤 Sending:', JSON.stringify(payload, null, 2))

    try {
      await saveSessionData(payload)
      console.log('✅ Data saved to Supabase!')
    } catch (error) {
      console.error('❌ Error saving data:', error)
    }
  }

  const handleThemeToggle = () =>
    setSearchParams({ theme: isDark ? "light" : "dark" })

  const handleSelfDownload = () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0)
    const reportPayload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency',
    }
    downloadSelfReport(reportPayload)
  }

  const bgClass    = isDark ? "bg-page-dark"  : "bg-page-light"
  const textColor  = isDark ? "text-white"     : "text-ink"
  const dividerCls = isDark ? "divide-white/8" : "divide-ink/6"
  const borderCls  = isDark ? "border-white/8" : "border-ink/8"

  return (
    <div className={`app-shell ${isDark ? "theme-dark" : ""}`}>

      {/* ── Desktop sidebar (position: fixed, hidden on mobile) ── */}
      <Sidebar theme={themeMode} />

      {/* ── Main scrollable content ── */}
      <main
        ref={scrollRef}
        className={`main-content no-scrollbar ${bgClass} ${textColor}`}
      >

        <div className={`sticky top-0 z-40 flex items-center px-4 py-3 border-b backdrop-blur-sm ${borderCls} ${isDark ? "bg-ink/90" : "bg-mist/90"}`}>
          <div className="w-[42px] lg:hidden shrink-0" />
          <div className="flex-1 flex justify-center lg:invisible">
            <BrandLogo color={isDark ? "#F5F4FB" : "#27262F"} width={60} />
          </div>
          <ThemeToggle isDark={isDark} onClick={handleThemeToggle} />
        </div>

        {/* ── Feed stream ────────────────────────────────────────── */}
        <div className="feed-wrapper">

          {/* Loading skeleton */}
          {!payload && <FeedSkeleton isDark={isDark} />}

          {/* Dark mode: hero carousel + posts */}
          {payload && isDark && (
            <div className={`divide-y ${dividerCls}`}>
              {payload.posts.map((post, index) => (
                <RevealPost key={`${post.id}-${index}`} isDark>
                  <div data-post-id={post.id} data-genre={post.genre || 'humor'}>
                    <FeedPost
                      isDark
                      isLiked={Boolean(likedPosts[post.id])}
                      isReposted={Boolean(repostedPosts[post.id])}
                      onComment={() => openCommentSheet(post.id)}
                      onLike={() => toggleLiked(post.id)}
                      onRepost={() => toggleReposted(post.id)}
                      post={post}
                    />
                  </div>
                </RevealPost>
              ))}
            </div>
          )}

          {/* Light mode: regular posts */}
          {payload && !isDark && (
            <div className={`divide-y ${dividerCls}`}>
              {payload.posts.map((post, idx) => (
                <RevealPost
                  key={`${post.id}-${idx}`}
                  isDark={false}
                  tutorialId={idx === 0 ? "tutorial-post" : undefined}
                >
                  <div data-post-id={post.id} data-genre={post.genre || 'humor'}>
                    <FeedPost
                      isDark={false}
                      isLiked={Boolean(likedPosts[post.id])}
                      isReposted={Boolean(repostedPosts[post.id])}
                      onComment={() => openCommentSheet(post.id)}
                      onLike={() => toggleLiked(post.id)}
                      onRepost={() => toggleReposted(post.id)}
                      post={post}
                    />
                  </div>
                </RevealPost>
              ))}
            </div>
          )}

          {/* Timer CTA – bottom of feed */}
          {payload && (
            <div className={`flex flex-col items-center gap-3 py-10 border-t ${borderCls}`}>
              <p className={`text-[11px] font-medium tracking-widest uppercase ${isDark ? "text-white/35" : "text-ink/35"}`}>
                Selesai scrolling?
              </p>
              <button
                aria-label="Open timer page"
                className="
                  flex h-14 w-14 items-center justify-center rounded-full
                  bg-white shadow-[0_8px_24px_rgba(18,17,25,0.16)]
                  active:scale-95 transition-transform
                "
                onClick={handleOpenTimer}
                type="button"
              >
                <BrandLogo color="#27262F" width={32} />
              </button>
            </div>
          )}

        </div>
      </main>

      {/* ── Desktop right panel (position: fixed) ── */}
      <RightPanel theme={themeMode} />

      {/* ── Mobile FAB – timer shortcut (fixed bottom center, mobile only) ── */}
      <button
        aria-label="Lihat durasi scrolling"
        className="
          md:hidden fixed left-1/2 -translate-x-1/2 z-50
          flex h-14 w-14 items-center justify-center rounded-full
          bg-white shadow-[0_8px_28px_rgba(18,17,25,0.22)]
          active:scale-90 transition-transform
        "
        onClick={handleOpenTimer}
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        type="button"
      >
        <BrandLogo color="#27262F" width={30} />
      </button>
      
      {/* ── Timer overlay ── */}
      {showTimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center gap-4 text-white text-center px-6 max-w-md">
            <button 
              onClick={() => setDevClicks(prev => prev + 1)}
              className="active:scale-110 transition-transform"
            >
              <BrandLogo color="#FFFFFF" width={48} />
            </button>
            <div>
              <p className="text-base font-bold tracking-wide mb-3">Time You've Spent</p>
              <p className="text-[clamp(2.5rem,12vw,4rem)] font-bold tabular-nums leading-none whitespace-nowrap">
                {formatElapsed(feedStartedAt)}
              </p>
              <div className="mt-3 flex justify-between px-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                <span>jam</span>
                <span>mnt</span>
                <span>dtk</span>
              </div>
            </div>

            {/* Genre breakdown */}
            <div className="w-full bg-white/10 rounded-lg p-4 mt-4 max-h-48 overflow-y-auto">
              <p className="text-sm font-bold uppercase tracking-widest mb-3 text-white/70">Breakdown per Kategori</p>
              <div className="space-y-3">
                {Object.entries(genreTimes).map(([genre, ms]) => {
                  const totalMs = Object.values(genreTimes).reduce((a, b) => a + b, 0)
                  const percentage = totalMs > 0 ? ((ms / totalMs) * 100).toFixed(1) : '0'
                  const seconds = Math.floor(ms / 1000)
                  
                  const genreEmojis: Record<string, string> = {
                    humor: '😂',
                    berita: '📰',
                    wisata: '✈️',
                    makanan: '🍔',
                    olahraga: '⚽',
                    game: '🎮',
                  }

                  return (
                    <div key={genre} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{genreEmojis[genre] || '📄'} {genre.charAt(0).toUpperCase() + genre.slice(1)}</span>
                      <span className="text-white/70">{seconds}s ({percentage}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-sm font-semibold text-[#FF516B] max-w-[260px] leading-relaxed">
              Jangan lupa untuk screenshot page ini dan submit ke form kuesioner kami ya!
            </p>
            <div className="flex gap-4 mt-2">
              <button
                aria-label="Continue to thank-you screen"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg active:scale-95 transition-transform"
                onClick={() => navigate("/thank-you")}
                type="button"
              >
                <BrandLogo color="#27262F" width={28} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2 w-full">
              {/* User Individual Download */}
              <button
                onClick={handleSelfDownload}
                className="w-full py-3 bg-white text-ink font-bold rounded-full shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                📥 Unduh Laporan Saya (.xlsx)
              </button>
              
              {/* Developer Download (Hidden - click logo 5 times to show) */}
              {devClicks >= 5 && (
                <button
                  onClick={downloadAllReports}
                  className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-[10px] font-bold uppercase tracking-widest text-white/50 transition-colors animate-pulse"
                >
                  📊 Master Recap (All Users)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      {commentSheet && <CommentSheet onClose={closeCommentSheet} />}
      {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}
    </div>
  )
}

// ── Single post skeleton ─────────────────────────────────────────────────────
function SinglePostSkeleton({ isDark }: { isDark: boolean }) {
  const s = isDark ? "bg-white/10" : "bg-ink/8"
  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-3">
        <div className={`h-9 w-9 rounded-full animate-pulse ${s}`} />
        <div className="space-y-1.5 flex-1">
          <div className={`h-3 w-24 rounded-full animate-pulse ${s}`} />
          <div className={`h-2.5 w-14 rounded-full animate-pulse ${s}`} />
        </div>
      </div>
      <div className={`w-full aspect-[4/5] animate-pulse ${s}`} />
      <div className="flex items-center gap-3 px-3 py-2">
        <div className={`h-5 w-12 rounded-full animate-pulse ${s}`} />
        <div className={`h-5 w-12 rounded-full animate-pulse ${s}`} />
        <div className={`h-5 w-8 rounded-full animate-pulse ${s}`} />
      </div>
      <div className="px-3 py-3 space-y-2">
        <div className={`h-3 w-20 rounded-full animate-pulse ${s}`} />
        <div className={`h-3 w-48 rounded-full animate-pulse ${s}`} />
      </div>
    </div>
  )
}

// ── Initial feed skeleton (3 placeholder posts while data loads) ─────────────
function FeedSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className={`divide-y ${isDark ? "divide-white/8" : "divide-ink/6"}`}>
      {Array.from({ length: 3 }).map((_, i) => (
        <SinglePostSkeleton key={i} isDark={isDark} />
      ))}
    </div>
  )
}

// ── RevealPost — skeleton selama 2 detik saat post masuk viewport ────────────
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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (revealed) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [revealed])

  return (
    <div ref={ref} {...(tutorialId ? { "data-tutorial-id": tutorialId } : {})}>
      {revealed ? children : <SinglePostSkeleton isDark={isDark} />}
    </div>
  )
}

function formatElapsed(feedStartedAt: number | null): string {
  const ms = feedStartedAt === null ? 0 : Date.now() - feedStartedAt
  const totalSec = Math.floor(ms / 1000)
  const hours   = String(Math.floor(totalSec / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSec % 60).padStart(2, "0")
  return `${hours} : ${minutes} : ${seconds}`
}