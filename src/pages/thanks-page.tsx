export function ThanksPage() {
  return (
    <div className="min-h-svh flex items-center justify-center bg-app-radial p-6 animate-fade-in">
      {/* Card */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-phone overflow-hidden px-8 py-14 text-ink">
        {/* Decorative bubbles */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-mist/60 pointer-events-none" />
        <div className="absolute -top-12 -right-20 w-56 h-56 rounded-full bg-violet/10 pointer-events-none" />

        {/* Content */}
        <div className="relative space-y-2">
          <h1 className="text-4xl font-medium leading-tight">Terima Kasih!</h1>
          <p className="text-xl font-semibold italic text-haze">Sesi selesai.</p>
        </div>

        <p className="relative mt-6 text-base text-haze leading-relaxed">
          Terima kasih telah mengikuti simulasi ini. Partisipasi Anda sangat berarti bagi penelitian kami.
          <br /><br />
          Anda sekarang dapat keluar dari situs ini.
        </p>
      </div>
    </div>
  )
}
