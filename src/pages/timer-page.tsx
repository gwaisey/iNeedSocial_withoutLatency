import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { BrandLogo } from "../components/brand-logo"
import { useStudyState } from "../context/study-context"

export function TimerPage() {
  const navigate = useNavigate()
  const { feedStartedAt } = useStudyState()
  const [elapsedMs] = useState(() =>
    feedStartedAt === null ? 0 : Date.now() - feedStartedAt
  )

  return (
    <div className="min-h-svh flex items-center justify-center animate-fade-in">
      {/* Transparent dark overlay — see-through to feed content behind */}
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[90vw] sm:max-w-xs mx-auto flex flex-col items-center gap-4 text-white text-center px-4">

        {/* Logo */}
        <BrandLogo color="#FFFFFF" width={48} />

        {/* Timer display */}
        <div className="mt-2 w-full">
          <p className="text-base sm:text-lg font-bold tracking-wide mb-3">
            Time You&apos;ve Spent
          </p>
          <p className="text-[clamp(2.5rem,12vw,4rem)] font-bold tracking-widest tabular-nums leading-none">
            {formatTimer(elapsedMs)}
          </p>
          <div className="mt-3 flex justify-between px-2 text-[clamp(0.6rem,2.5vw,0.75rem)] font-bold uppercase tracking-[0.2em] text-white/60">
            <span>jam</span>
            <span>mnt</span>
            <span>dtk</span>
          </div>
        </div>

        {/* Reminder */}
        <p className="text-[clamp(0.75rem,3vw,0.875rem)] font-semibold leading-relaxed text-[#FF516B] max-w-[260px]">
          Don&apos;t forget to screenshot this page and submit to our post-questionnaire!
        </p>

        {/* CTA */}
        <button
          aria-label="Continue to thank-you screen"
          className="
            mt-2 flex h-14 w-14 items-center justify-center
            rounded-full bg-white
            shadow-[0_20px_35px_rgba(18,17,25,0.35)]
            hover:scale-105 active:scale-95
            transition-transform
          "
          onClick={() => navigate("/thank-you")}
          type="button"
        >
          <BrandLogo color="#27262F" width={32} />
        </button>

      </div>
    </div>
  )
}

function formatTimer(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const hours   = String(Math.floor(totalSec / 3600)).padStart(2, "0")
  const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0")
  const seconds = String(totalSec % 60).padStart(2, "0")
  return `${hours} : ${minutes} : ${seconds}`
}
