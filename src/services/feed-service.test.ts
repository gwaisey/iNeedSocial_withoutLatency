import { describe, expect, it } from "vitest"
import { normalizeFeedPayload, resolveFeedSource } from "./feed-service"

describe("feed-service helpers", () => {
  it("defaults feed source to mock unless explicitly set to api", () => {
    expect(resolveFeedSource(undefined)).toBe("mock")
    expect(resolveFeedSource("mock")).toBe("mock")
    expect(resolveFeedSource("anything-else")).toBe("mock")
    expect(resolveFeedSource("api")).toBe("api")
  })

  it("normalizes unknown genres to humor", () => {
    const payload = normalizeFeedPayload("light", {
      posts: [
        {
          id: "post-1",
          type: "image",
          username: "uji",
          likes: "10",
          caption: "uji",
          media: [{ src: "/img.jpg", alt: "uji" }],
          genre: "tidak-valid",
        },
      ],
    })

    expect(payload.posts[0]?.genre).toBe("humor")
  })
})
