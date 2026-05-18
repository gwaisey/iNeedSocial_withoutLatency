import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const feedPath = path.join(root, "public", "content", "feed.json")
const compactVideoWarningBytes = 6 * 1024 * 1024
const defaultVideoWarningBytes = 30 * 1024 * 1024
const allowedGenres = new Set(["humor", "berita", "wisata", "makanan", "olahraga", "game"])
const allowedTypes = new Set(["image", "carousel", "video"])
const issues = []
const warnings = []
const mediaAssets = []
const videoAssets = []

function addIssue(message) {
  issues.push(message)
}

function addWarning(message) {
  warnings.push(message)
}

function formatMb(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(2))
}

function localPathFromPublicSrc(src) {
  if (typeof src !== "string" || !src.startsWith("/")) {
    return null
  }

  return path.join(root, "public", ...src.split("/").filter(Boolean))
}

function readFeed() {
  if (!existsSync(feedPath)) {
    addIssue("feed.json: file is missing")
    return { posts: [] }
  }

  try {
    return JSON.parse(readFileSync(feedPath, "utf8"))
  } catch (error) {
    addIssue(`feed.json: invalid JSON (${error instanceof Error ? error.message : String(error)})`)
    return { posts: [] }
  }
}

const feed = readFeed()
const posts = Array.isArray(feed.posts) ? feed.posts : []
if (!Array.isArray(feed.posts)) {
  addIssue("feed.json: missing posts array")
}

const seenIds = new Set()
for (const [postIndex, post] of posts.entries()) {
  const label = post?.id ?? `posts[${postIndex}]`
  if (!post || typeof post !== "object") {
    addIssue(`${label}: post is not an object`)
    continue
  }

  if (typeof post.id !== "string" || post.id.trim() === "") {
    addIssue(`${label}: missing id`)
  } else if (seenIds.has(post.id)) {
    addIssue(`${label}: duplicate id`)
  } else {
    seenIds.add(post.id)
  }

  if (!allowedTypes.has(post.type)) {
    addIssue(`${label}: invalid type ${String(post.type)}`)
  }

  if (!allowedGenres.has(post.genre)) {
    addIssue(`${label}: invalid genre ${String(post.genre)}`)
  }

  if (!Array.isArray(post.media) || post.media.length === 0) {
    addIssue(`${label}: missing media`)
    continue
  }

  if ((post.type === "image" || post.type === "video") && post.media.length !== 1) {
    addIssue(`${label}: ${post.type} posts must have exactly one media item`)
  }

  if (post.type === "carousel" && post.media.length < 2) {
    addIssue(`${label}: carousel posts must have at least two media items`)
  }

  for (const [mediaIndex, media] of post.media.entries()) {
    const mediaLabel = `${label}.media[${mediaIndex}]`
    const src = media?.src

    if (typeof src !== "string" || !src.startsWith("/content/")) {
      addIssue(`${mediaLabel}: invalid src ${String(src)}`)
      continue
    }

    if (typeof media.alt !== "string" || media.alt.trim() === "") {
      addIssue(`${mediaLabel}: missing alt text`)
    }

    const localPath = localPathFromPublicSrc(src)
    if (!localPath || !existsSync(localPath)) {
      addIssue(`${mediaLabel}: missing local asset ${src}`)
      continue
    }

    const size = statSync(localPath).size
    mediaAssets.push({ postId: post.id, size, src, type: post.type })

    if (!src.startsWith("/content/videos-default/")) {
      continue
    }

    const fileName = path.basename(src)
    const compactSrc = `/content/videos/${fileName}`
    const posterSrc = `/content/video-posters/${fileName.replace(/\.mp4$/i, ".jpg")}`
    const compactPath = localPathFromPublicSrc(compactSrc)
    const posterPath = localPathFromPublicSrc(posterSrc)
    const compactExists = Boolean(compactPath && existsSync(compactPath))
    const posterExists = Boolean(posterPath && existsSync(posterPath))

    if (!compactExists) {
      addIssue(`${mediaLabel}: missing compact video ${compactSrc}`)
    }

    if (!posterExists) {
      addIssue(`${mediaLabel}: missing video poster ${posterSrc}`)
    }

    videoAssets.push({
      compactSize: compactExists ? statSync(compactPath).size : 0,
      defaultSize: size,
      fileName,
      postId: post.id,
    })
  }
}

for (const video of videoAssets) {
  if (video.compactSize > compactVideoWarningBytes) {
    addWarning(`${video.postId}: compact video ${video.fileName} is ${formatMb(video.compactSize)}MB`)
  }

  if (video.defaultSize > defaultVideoWarningBytes) {
    addWarning(`${video.postId}: default video ${video.fileName} is ${formatMb(video.defaultSize)}MB`)
  }
}

const largestAssets = [...mediaAssets]
  .sort((left, right) => right.size - left.size)
  .slice(0, 10)
  .map((asset) => ({
    postId: asset.postId,
    sizeMb: formatMb(asset.size),
    src: asset.src,
  }))

const result = {
  counts: {
    issues: issues.length,
    mediaItems: mediaAssets.length,
    posts: posts.length,
    videoItems: videoAssets.length,
    warnings: warnings.length,
  },
  issues,
  largestAssets,
  warnings,
}

console.log(`Feed content audit: ${posts.length} posts, ${mediaAssets.length} media items, ${videoAssets.length} video items`)

if (warnings.length > 0) {
  console.warn(`Warnings (${warnings.length}):`)
  for (const warning of warnings) {
    console.warn(`- ${warning}`)
  }
}

if (issues.length > 0) {
  console.error(`Issues (${issues.length}):`)
  for (const issue of issues) {
    console.error(`- ${issue}`)
  }
} else {
  console.log("No blocking feed content issues found.")
}

console.log(`AUDIT_FEED_CONTENT_RESULT=${JSON.stringify(result)}`)
process.exitCode = issues.length > 0 ? 1 : 0
