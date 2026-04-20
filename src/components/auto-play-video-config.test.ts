import { describe, expect, it } from "vitest"
import { getVideoPosterSource } from "./auto-play-video-config"

describe("auto-play video config", () => {
  it("prefers explicit posters but can derive a static poster path from a video source", () => {
    expect(getVideoPosterSource("/content/videos/pinata.mp4", "/custom/poster.jpg")).toBe(
      "/custom/poster.jpg"
    )

    expect(getVideoPosterSource("/content/videos/pinata.mp4")).toBe(
      "/content/video-posters/pinata.jpg"
    )

    expect(getVideoPosterSource("/content/files/photo.jpg")).toBeUndefined()
  })
})
