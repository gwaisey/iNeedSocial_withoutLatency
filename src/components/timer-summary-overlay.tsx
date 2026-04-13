import { BrandLogo } from "./brand-logo"
import type { GenreTimes, SessionReportPayload } from "../types/social"
import {
  buildDisplayedGenreBreakdown,
  formatElapsed,
  GENRE_META,
  sumGenreTimes,
} from "../utils/feed-session"

type TimerSummaryOverlayProps = {
  finalReport: SessionReportPayload | null
  genreTimes: GenreTimes
  isSavingSession: boolean
  onDownload: () => void
  onFinish: () => void
  submissionHasError: boolean
  submissionMessage: string | null
}

export function TimerSummaryOverlay({
  finalReport,
  genreTimes,
  isSavingSession,
  onDownload,
  onFinish,
  submissionHasError,
  submissionMessage,
}: TimerSummaryOverlayProps) {
  const displayedElapsedMs = finalReport?.total_time ?? sumGenreTimes(genreTimes)
  const displayedBreakdown = buildDisplayedGenreBreakdown(genreTimes)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm animate-fade-in">
      <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center text-white">
        <BrandLogo color="#FFFFFF" width={48} />
        <div>
          <p className="mb-3 text-base font-bold tracking-wide">Waktu yang Anda Habiskan</p>
          <p className="whitespace-nowrap text-[clamp(2.5rem,12vw,4rem)] font-bold leading-none tabular-nums">
            {formatElapsed(displayedElapsedMs)}
          </p>
          <div className="mt-3 flex justify-between px-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
            <span>jam</span>
            <span>mnt</span>
            <span>dtk</span>
          </div>
        </div>

        <div className="mt-4 max-h-48 w-full overflow-y-auto rounded-lg bg-white/10 p-4">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-white/70">
            Rincian per Kategori
          </p>
          <div className="space-y-3">
            {displayedBreakdown.map(({ genre, percentage, displaySeconds }) => {
              const meta = GENRE_META[genre]

              return (
                <div key={genre} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{meta.label}</span>
                  <span className="text-white/70">
                    {displaySeconds}s ({percentage}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="max-w-[260px] text-sm font-semibold leading-relaxed text-[#FF516B]">
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

        <div className="mt-2 flex gap-4">
          <button
            aria-label="Lanjut ke halaman terima kasih"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg transition-transform active:scale-95"
            onClick={onFinish}
            type="button"
          >
            <BrandLogo color="#27262F" width={28} />
          </button>
        </div>

        <div className="mt-4 flex w-full flex-col gap-2">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-bold text-ink shadow-md transition-transform active:scale-95 disabled:opacity-70"
            disabled={isSavingSession}
            onClick={onDownload}
            type="button"
          >
            Unduh Laporan Saya (.xlsx)
          </button>
        </div>
      </div>
    </div>
  )
}
