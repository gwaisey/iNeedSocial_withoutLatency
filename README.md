# iNeedSocial

Aplikasi simulasi media sosial berbasis web untuk keperluan penelitian "latency test". Dibangun dengan React + TypeScript + Vite, mendukung PWA, dan dapat dijalankan sepenuhnya secara lokal tanpa backend.

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | React 19 + TypeScript 5 |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| Build Tool | Vite 8 |
| PWA | vite-plugin-pwa |

---

## Prasyarat

- **Node.js** v18 atau lebih baru
- **npm** v9 atau lebih baru (atau pnpm / yarn)

Cek versi yang terpasang:

```bash
node -v
npm -v
```

---

## Instalasi

```bash
# Clone atau masuk ke direktori proyek
cd social-media

# Install semua dependensi
npm install
```

---

## Menjalankan Aplikasi

### Mode Development (Hot Reload)

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173` secara default.

### Build untuk Production

```bash
npm run build
```

Output akan tersimpan di folder `dist/`.

### Preview Build Production

```bash
npm run preview
```

Menjalankan hasil build di `http://localhost:4173` untuk verifikasi sebelum deploy.

---

## Struktur Direktori

```
social-media/
├── public/
│   ├── content/
│   │   ├── feed.json          ← Data postingan (edit di sini)
│   │   ├── files/             ← Simpan file gambar di sini
│   │   └── videos/            ← Simpan file video di sini
│   ├── icons/                 ← Icon PWA (192px, 512px, svg)
│   ├── manifest.json          ← Konfigurasi PWA
│   └── sw.js                  ← Service Worker
├── src/
│   ├── components/            ← Komponen UI reusable
│   ├── context/               ← Global state (likes, timer)
│   ├── pages/                 ← Halaman-halaman aplikasi
│   ├── services/              ← Fetch data / API layer
│   ├── types/                 ← TypeScript type definitions
│   ├── App.tsx                ← Routing utama
│   ├── main.tsx               ← Entry point
│   └── index.css              ← Global styles + Tailwind
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## Menambah Konten Feed

Semua konten postingan dikelola melalui satu file:

```
public/content/feed.json
```

### Format Postingan

```json
{
  "posts": [
    {
      "id": "post-unik-id",
      "type": "image",
      "username": "nama_pengguna",
      "likes": "1.234",
      "caption": "Teks caption postingan",
      "media": [
        {
          "src": "/content/files/nama-file.jpg",
          "alt": "Deskripsi gambar"
        }
      ]
    }
  ]
}
```

### Tipe Postingan yang Didukung

| `type` | Keterangan | Jumlah `media` |
|--------|-----------|----------------|
| `"image"` | Gambar tunggal | 1 item |
| `"carousel"` | Beberapa gambar, bisa diswipe | 2 item atau lebih |
| `"video"` | Video dengan kontrol player | 1 item (+ opsional `poster`) |

#### Contoh postingan carousel:

```json
{
  "id": "post-carousel-1",
  "type": "carousel",
  "username": "lifestyle.id",
  "likes": "3.456",
  "caption": "Swipe untuk lihat semua 👉",
  "media": [
    { "src": "/content/files/foto1.jpg", "alt": "Foto 1" },
    { "src": "/content/files/foto2.jpg", "alt": "Foto 2" },
    { "src": "/content/files/foto3.jpg", "alt": "Foto 3" }
  ]
}
```

#### Contoh postingan video:

```json
{
  "id": "post-video-1",
  "type": "video",
  "username": "creator.id",
  "likes": "5.678",
  "caption": "Video seru nih! 🎬",
  "media": [
    {
      "src": "/content/videos/video-saya.mp4",
      "alt": "Deskripsi video",
      "poster": "/content/files/thumbnail.jpg"
    }
  ]
}
```

### Menambah Hero Slides (Dark Mode)

Hero carousel hanya tampil di dark mode. Edit bagian `heroSlides` di `feed.json`:

```json
{
  "heroSlides": [
    {
      "id": "hero-1",
      "src": "/content/files/hero-image.jpg",
      "alt": "Deskripsi hero"
    }
  ]
}
```

---

## Menghubungkan ke Backend (API Nyata)

Saat ini aplikasi menggunakan data mock dari `feed.json`. Untuk menghubungkan ke API backend:

1. Buka `src/services/feed-service.ts`
2. Ubah `USE_MOCK` menjadi `false`:

```ts
const USE_MOCK = false
```

3. Pastikan backend menyediakan endpoint:

```
GET /api/feed?theme=light
GET /api/feed?theme=dark
```

Dengan response format yang sama seperti `feed.json`.

---

## Fitur PWA

Aplikasi mendukung Progressive Web App dan dapat diinstall di perangkat mobile maupun desktop:

- **Install to Home Screen** — tersedia di browser mobile
- **Standalone mode** — berjalan tanpa browser chrome
- **Service Worker** — caching aset statis

Untuk mengaktifkan PWA, pastikan aplikasi di-serve melalui HTTPS (atau `localhost`).

---

## Alur Penggunaan (User Flow)

```
/ → /splash (1.4 detik) → /welcome → /feed?theme=light → /timer → /thank-you
```

| Halaman | URL | Fungsi |
|---------|-----|--------|
| Splash | `/splash` | Intro screen, auto-redirect ke welcome |
| Welcome | `/welcome` | Halaman selamat datang, klik untuk mulai |
| Feed | `/feed` | Feed utama, parameter `?theme=light` atau `?theme=dark` |
| Timer | `/timer` | Menampilkan durasi waktu scroll |
| Thank You | `/thank-you` | Halaman penutup, bisa restart |

---

## Kustomisasi Tema

Warna brand dapat diubah di `tailwind.config.js`:

```js
colors: {
  ink:    "#27262F",  // warna teks utama (light mode)
  mist:   "#F5F4FB",  // warna teks utama (dark mode)
  haze:   "#7C7995",  // teks muted
  dusk:   "#3E3D4A",  // background dark mode
  signal: "#C83C53",  // warna like (merah)
  violet: "#776DFF",  // warna brand utama
}
```
