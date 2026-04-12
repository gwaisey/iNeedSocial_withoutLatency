import {
  GENRE_KEYS,
  type FeedPayload,
  type GenreKey,
  type Post,
  type ThemeMode,
} from "../types/social"

const BASE_URL = ""
const USE_MOCK = true
const VALID_GENRES = new Set<GenreKey>(GENRE_KEYS)

type RawPost = Omit<Post, "genre"> & { genre?: string | null }

type RawFeedPayload = {
  posts?: RawPost[]
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Permintaan data gagal dengan status ${response.status} untuk ${path}.`)
  }

  return response.json() as Promise<T>
}

function normalizeGenre(genre?: string | null): GenreKey {
  return VALID_GENRES.has(genre as GenreKey) ? (genre as GenreKey) : "humor"
}

function normalizeFeedPayload(theme: ThemeMode, payload: RawFeedPayload): FeedPayload {
  return {
    theme,
    posts: Array.isArray(payload.posts)
      ? payload.posts.map((post) => ({
          ...post,
          genre: normalizeGenre(post.genre),
        }))
      : [],
  }
}

async function mockGetFeed(theme: ThemeMode): Promise<FeedPayload> {
  const payload = await apiFetch<RawFeedPayload>("/content/feed.json")
  return normalizeFeedPayload(theme, payload)
}

async function realGetFeed(theme: ThemeMode): Promise<FeedPayload> {
  const payload = await apiFetch<RawFeedPayload>(`/api/feed?theme=${theme}`)
  return normalizeFeedPayload(theme, payload)
}

export const socialFeedService = {
  getFeedByTheme(theme: ThemeMode): Promise<FeedPayload> {
    return USE_MOCK ? mockGetFeed(theme) : realGetFeed(theme)
  },
}
