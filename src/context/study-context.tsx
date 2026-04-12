import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type StudyContextValue = {
  commentSheet: string | null
  likedPosts: Record<string, boolean>
  repostedPosts: Record<string, boolean>
  closeCommentSheet: () => void
  openCommentSheet: (postId: string) => void
  toggleLiked: (postId: string) => void
  toggleReposted: (postId: string) => void
}

const StudyContext = createContext<StudyContextValue | null>(null)

const STORAGE_KEY_LIKED = "gaby:liked"
const STORAGE_KEY_REPOSTED = "gaby:reposted"

function readStorage(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function writeStorage(key: string, value: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage might be unavailable in private mode
  }
}

export function StudyProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>(
    () => readStorage(STORAGE_KEY_LIKED)
  )
  const [repostedPosts, setRepostedPosts] = useState<Record<string, boolean>>(
    () => readStorage(STORAGE_KEY_REPOSTED)
  )
  const [commentSheet, setCommentSheet] = useState<string | null>(null)

  useEffect(() => {
    writeStorage(STORAGE_KEY_LIKED, likedPosts)
  }, [likedPosts])

  useEffect(() => {
    writeStorage(STORAGE_KEY_REPOSTED, repostedPosts)
  }, [repostedPosts])

  const toggleLiked = useCallback((postId: string) => {
    setLikedPosts((curr) => ({ ...curr, [postId]: !curr[postId] }))
  }, [])

  const toggleReposted = useCallback((postId: string) => {
    setRepostedPosts((curr) => ({ ...curr, [postId]: !curr[postId] }))
  }, [])

  const closeCommentSheet = useCallback(() => setCommentSheet(null), [])
  const openCommentSheet = useCallback((postId: string) => setCommentSheet(postId), [])

  const value = useMemo(
    () => ({
      commentSheet,
      likedPosts,
      repostedPosts,
      closeCommentSheet,
      openCommentSheet,
      toggleLiked,
      toggleReposted,
    }),
    [commentSheet, likedPosts, repostedPosts, closeCommentSheet, openCommentSheet, toggleLiked, toggleReposted]
  )

  return (
    <StudyContext.Provider value={value}>
      {children}
    </StudyContext.Provider>
  )
}

export function useStudyState() {
  const context = useContext(StudyContext)
  if (!context) throw new Error("useStudyState must be used inside StudyProvider")
  return context
}
