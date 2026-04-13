import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  ensureStudySession,
  getSessionStorage,
  readInteractionState,
  startNewStudySession,
  writeInteractionState,
} from "./study-session-storage"

type StudyContextValue = {
  commentSheet: string | null
  likedPosts: Record<string, boolean>
  repostedPosts: Record<string, boolean>
  sessionId: string
  closeCommentSheet: () => void
  openCommentSheet: (postId: string) => void
  startStudySession: () => void
  toggleLiked: (postId: string) => void
  toggleReposted: (postId: string) => void
}

const StudyContext = createContext<StudyContextValue | null>(null)

export function StudyProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [sessionId, setSessionId] = useState(() => ensureStudySession(getSessionStorage()))
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>(
    () => readInteractionState(getSessionStorage(), sessionId, "liked")
  )
  const [repostedPosts, setRepostedPosts] = useState<Record<string, boolean>>(
    () => readInteractionState(getSessionStorage(), sessionId, "reposted")
  )
  const [commentSheet, setCommentSheet] = useState<string | null>(null)

  useEffect(() => {
    writeInteractionState(getSessionStorage(), sessionId, "liked", likedPosts)
  }, [likedPosts, sessionId])

  useEffect(() => {
    writeInteractionState(getSessionStorage(), sessionId, "reposted", repostedPosts)
  }, [repostedPosts, sessionId])

  const toggleLiked = useCallback((postId: string) => {
    setLikedPosts((curr) => ({ ...curr, [postId]: !curr[postId] }))
  }, [])

  const toggleReposted = useCallback((postId: string) => {
    setRepostedPosts((curr) => ({ ...curr, [postId]: !curr[postId] }))
  }, [])

  const closeCommentSheet = useCallback(() => setCommentSheet(null), [])
  const openCommentSheet = useCallback((postId: string) => setCommentSheet(postId), [])
  const startStudySession = useCallback(() => {
    const nextSessionId = startNewStudySession(getSessionStorage())
    setSessionId(nextSessionId)
    setLikedPosts({})
    setRepostedPosts({})
    setCommentSheet(null)
  }, [])

  const value = useMemo(
    () => ({
      commentSheet,
      likedPosts,
      repostedPosts,
      sessionId,
      closeCommentSheet,
      openCommentSheet,
      startStudySession,
      toggleLiked,
      toggleReposted,
    }),
    [
      commentSheet,
      likedPosts,
      repostedPosts,
      sessionId,
      closeCommentSheet,
      openCommentSheet,
      startStudySession,
      toggleLiked,
      toggleReposted,
    ]
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
