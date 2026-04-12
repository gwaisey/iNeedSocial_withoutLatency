# iNeedSocial

iNeedSocial adalah aplikasi web React + TypeScript + Vite yang mensimulasikan feed media sosial untuk kebutuhan penelitian. Peserta melewati halaman splash, halaman sambutan, feed utama, lalu halaman terima kasih. Ringkasan durasi studi ditampilkan sebagai overlay di dalam feed, bukan sebagai halaman terpisah.

## Tumpukan Teknologi

| Lapisan | Teknologi |
| --- | --- |
| Framework | React 19 + TypeScript 5 |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v3 |
| Ikon | Lucide React |
| Build tool | Vite 6 |
| Data | Feed JSON lokal + penyimpanan sesi opsional ke Supabase |

## Kebutuhan

- Node.js 18+
- npm 9+

## Instalasi

```bash
npm install
```

## Menjalankan Proyek

Mode pengembangan:

```bash
npm run dev
```

Build produksi:

```bash
npm run build
```

Pratinjau hasil build:

```bash
npm run preview
```

## Variabel Lingkungan

Salin `.env.example` menjadi `.env`, lalu isi sesuai kebutuhan.

### Variabel frontend untuk aplikasi peserta

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Jika dua variabel frontend di atas belum diisi atau tidak valid, aplikasi tetap bisa berjalan. Overlay durasi hanya akan menampilkan pesan non-blocking, dan peserta tetap dapat mengunduh laporan sesinya sendiri secara lokal.

### Variabel privat untuk ekspor admin

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` hanya dipakai oleh skrip admin lokal. Jangan pernah mengekspos nilai ini ke browser, menyimpannya di kode frontend, atau meng-commit-nya ke git.

## Alur Studi

```text
/ -> /splash -> /welcome -> /feed?theme=light -> overlay durasi -> /thank-you
```

| Layar | URL | Fungsi |
| --- | --- | --- |
| Splash | `/splash` | Layar pembuka yang mengarahkan ke halaman sambutan |
| Sambutan | `/welcome` | Titik masuk sebelum peserta melihat feed |
| Feed | `/feed` | Pengalaman studi utama dalam tema terang atau gelap |
| Overlay durasi | di dalam `/feed` | Menampilkan durasi dan rincian kategori |
| Terima kasih | `/thank-you` | Layar penutup setelah sesi selesai |

`/timer` tetap tersedia sebagai redirect kompatibilitas ke `/feed`, tetapi bukan halaman studi mandiri.

## Data Feed

Konten feed dibaca dari:

```text
public/content/feed.json
```

Tipe post yang didukung:

- `image`
- `carousel`
- `video`

Setiap post dinormalisasi ke salah satu kategori penelitian berikut:

- `humor`
- `berita`
- `wisata`
- `makanan`
- `olahraga`
- `game`

Aliran post yang sama digunakan untuk mode terang dan gelap. Konten stimulus penelitian di `public/content/feed.json` dipertahankan apa adanya.

## Penyimpanan Sesi dan Ekspor

- Aplikasi peserta menyimpan satu ringkasan sesi ke Supabase untuk setiap sesi studi.
- Browser peserta hanya menjalankan perilaku yang aman untuk peserta.
- Peserta dapat mengunduh laporan sesinya sendiri dalam format `.xlsx` dari overlay durasi.
- Ekspor seluruh sesi tidak tersedia di UI peserta.

### Ekspor semua sesi untuk admin

Gunakan skrip admin lokal berikut:

```bash
npm run export:all-sessions
```

Skrip ini:

- membaca `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`,
- mengambil semua baris dari tabel `feed_sessions`,
- membuat file Excel bernama `Laporan_Semua_Sesi_YYYY-MM-DD.xlsx`,
- menggunakan sheet bernama `Semua Sesi`.

Skrip admin ini berjalan di luar aplikasi peserta dan tidak menggunakan publishable key frontend.

## Struktur Proyek

```text
src/
  components/
  context/
  pages/
  services/
  types/
  App.tsx
  main.tsx
public/
  content/
  icons/
  manifest.json
  sw.js
scripts/
  export-all-sessions.mjs
```

## Catatan

- Saat feed dimuat, aplikasi menampilkan skeleton.
- Jika pemuatan feed gagal, aplikasi menampilkan state retry di dalam halaman.
- Waktu feed dialokasikan terus-menerus ke post dominan yang terlihat, sehingga timer utama selaras dengan total kategori.
- Video hanya autoplay saat terlihat, dan video di carousel hanya autoplay pada slide aktif.
- Output build di `dist/` adalah artefak hasil generate dan tidak perlu di-commit.
