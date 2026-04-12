# Arsitektur - iNeedSocial

## Gambaran Umum

iNeedSocial adalah aplikasi React single-page untuk studi penelitian berbasis feed. Alur peserta dibuat sesederhana mungkin:

```text
/splash -> /welcome -> /feed -> overlay durasi -> /thank-you
```

Aplikasi ini bersifat mock-first. Konten feed berasal dari `public/content/feed.json`, sedangkan ringkasan sesi dapat disimpan ke Supabase secara opsional. Client browser hanya menangani penulisan yang aman untuk peserta dan ekspor lokal per pengguna.

## Struktur Runtime

```text
Browser
  -> React SPA
     -> React Router
     -> StudyProvider
     -> Feed service
     -> Supabase session service

Lokal admin
  -> Skrip ekspor semua sesi
     -> Supabase service-role client
     -> File Excel .xlsx
```

File utama:

- `src/App.tsx` mendefinisikan route dan mempertahankan `/timer` sebagai redirect ke `/feed`.
- `src/pages/feed-page.tsx` menangani logika sesi penelitian, overlay durasi, status loading, dan pemulihan posisi scroll saat ganti tema.
- `src/services/feed-service.ts` memuat serta menormalisasi data feed.
- `src/services/supabase.ts` memvalidasi konfigurasi Supabase frontend, menyimpan satu ringkasan sesi, dan me-load `xlsx` secara lazy untuk ekspor per pengguna.
- `scripts/export-all-sessions.mjs` adalah jalur ekspor admin lokal untuk seluruh data sesi menggunakan service-role key privat.
- `src/types/social.ts` berisi tipe feed, genre, dan payload sesi.

## Routing

Route dibuat ringkas:

- `/` redirect ke `/splash`
- `/splash` redirect ke `/welcome`
- `/welcome` memulai studi di `/feed?theme=light`
- `/feed` adalah layar utama studi
- `/timer` redirect ke `/feed`
- `/thank-you` adalah layar akhir

Timer bukan halaman terpisah. Tombol di sidebar desktop dan CTA mobile sama-sama membuka overlay yang sama di dalam `FeedPage`.

## Model Data Feed

Feed service menormalisasi semua post ke model internal yang ketat sebelum dipakai UI.

### Tema

- `light`
- `dark`

### Tipe post

- `image`
- `carousel`
- `video`

### Kategori

- `humor`
- `berita`
- `wisata`
- `makanan`
- `olahraga`
- `game`

Kategori yang tidak dikenal atau kosong dinormalisasi sekali menjadi `humor` di dalam feed service.

## Pelacakan Sesi

`FeedPage` melacak waktu paparan peserta per kategori dengan atribusi kontinu ke post reguler dominan yang sedang terlihat di dalam kontainer scroll.

Perilaku penting:

- Session id dibuat sekali saat sesi feed dimulai.
- Waktu selalu dialokasikan ke satu post reguler setelah feed tampil, sehingga timer utama selaras dengan total kategori.
- Durasi post aktif difinalisasi sebelum overlay durasi dibuka.
- Total kategori yang sudah difinalisasi dipakai ulang untuk penyimpanan Supabase dan ekspor Excel per pengguna.
- Guard mencegah insert sesi ganda jika overlay dibuka kembali.

Overlay membekukan durasi total dan rincian kategori berdasarkan snapshot final sesi tersebut.

## Perilaku Media

`FeedPost` bertanggung jawab atas render konten media.

### Gambar

- Dimuat secara lazy dengan elemen `img` standar.

### Carousel

- Mendukung swipe dan navigasi tombol.
- Tinggi kontainer menyesuaikan dimensi slide aktif.

### Video

- Visibilitas dipantau dengan `IntersectionObserver`.
- Video berhenti saat keluar dari area terlihat.
- Video carousel hanya autoplay pada slide aktif.
- Status mute diterapkan lewat effect, bukan callback ref.

## Penanganan Error

Pemuatan feed eksplisit:

- tampilkan skeleton saat loading,
- tampilkan state retry inline jika pemuatan gagal,
- retry tanpa memuat ulang seluruh aplikasi.

Penyimpanan Supabase frontend juga eksplisit:

- validasi env sebelum membuat client,
- gagal secara graceful jika konfigurasi tidak ada atau tidak valid,
- tampilkan status penyimpanan di overlay durasi tanpa menghambat alur studi.

## Batasan Akses Supabase

Terdapat dua batas akses yang berbeda:

### Frontend peserta

- memakai `VITE_SUPABASE_URL`
- memakai `VITE_SUPABASE_PUBLISHABLE_KEY`
- hanya menyimpan satu ringkasan sesi
- hanya mengekspor laporan sesi milik pengguna yang sedang aktif

### Skrip admin lokal

- memakai `SUPABASE_URL`
- memakai `SUPABASE_SERVICE_ROLE_KEY`
- berjalan di luar browser
- dapat mengambil seluruh isi tabel `feed_sessions`
- menghasilkan satu file Excel admin

`SUPABASE_SERVICE_ROLE_KEY` tidak boleh masuk ke bundle frontend, tidak boleh dipakai di browser, dan tidak boleh di-commit ke repositori.

## Kebersihan Repo

Artefak hasil generate bukan bagian dari source:

- `dist/`
- `*.tsbuildinfo`
- output Vite hasil generate

Konfigurasi Vite TypeScript di `vite.config.ts` tetap menjadi sumber kebenaran tunggal.
