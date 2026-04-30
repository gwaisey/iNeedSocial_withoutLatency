import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getAppwriteStorageOrigin,
  getAppwriteVideoSource,
  getCloudflareStreamDownloadUrl,
  getCloudflareStreamManifestUrl,
  getCloudflareStreamOrigin,
  getKnownVideoAspectRatio,
  getResolvedVideoSource,
  getVideoPosterSource,
  isDirectVideoFileSource,
} from "./auto-play-video-config"

describe("auto-play video config", () => {
  beforeEach(() => {
    stubAppwriteEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const appwriteEndpoint = "https://sgp.cloud.appwrite.io/v1"
  const appwriteProjectId = "69f22cb20001f8be28b3"
  const appwriteBucketId = "69f2b4dd002f17ed5c64"

  function stubAppwriteEnv() {
    vi.stubEnv("VITE_APPWRITE_ENDPOINT", appwriteEndpoint)
    vi.stubEnv("VITE_APPWRITE_PROJECT_ID", appwriteProjectId)
    vi.stubEnv("VITE_APPWRITE_BUCKET_ID", appwriteBucketId)
  }

  it("prefers explicit posters but can derive a static poster path from a video source", () => {
    expect(getVideoPosterSource("/content/videos-default/pinata.mp4", "/custom/poster.jpg")).toBe(
      "/custom/poster.jpg"
    )

    expect(getVideoPosterSource("/content/videos-default/pinata.mp4")).toBe(
      "/content/video-posters/pinata.jpg"
    )

    expect(getVideoPosterSource("/content/files/photo.jpg")).toBeUndefined()
  })

  it("maps local video references to Appwrite direct storage URLs", () => {
    stubAppwriteEnv()
    const appwritePinataUrl = `${appwriteEndpoint}/storage/buckets/${appwriteBucketId}/files/pinata/view?project=${appwriteProjectId}`

    expect(getAppwriteStorageOrigin()).toBe("https://sgp.cloud.appwrite.io")
    expect(getAppwriteVideoSource("/content/videos-default/pinata.mp4")).toBe(appwritePinataUrl)
    expect(getResolvedVideoSource("/content/videos-default/pinata.mp4")).toBe(appwritePinataUrl)
    expect(isDirectVideoFileSource(appwritePinataUrl)).toBe(true)
  })

  it("falls back to built-in Appwrite defaults when env vars are absent", () => {
    vi.unstubAllEnvs()

    const appwritePinataUrl =
      "https://sgp.cloud.appwrite.io/v1/storage/buckets/69f2b4dd002f17ed5c64/files/pinata/view?project=69f22cb20001f8be28b3"

    expect(getAppwriteStorageOrigin()).toBe("https://sgp.cloud.appwrite.io")
    expect(getAppwriteVideoSource("/content/videos-default/pinata.mp4")).toBe(appwritePinataUrl)
    expect(getResolvedVideoSource("/content/videos-default/pinata.mp4")).toBe(appwritePinataUrl)
  })

  it("keeps Cloudflare Stream URL helpers as a legacy fallback", () => {
    vi.stubEnv("VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE", "mjiwvs3h8hhcy2t8")

    expect(getCloudflareStreamManifestUrl("dad0deb02906401e5950bfe6816fb4a4")).toBe(
      "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/manifest/video.m3u8"
    )
    expect(getCloudflareStreamDownloadUrl("dad0deb02906401e5950bfe6816fb4a4")).toBe(
      "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/downloads/default.mp4"
    )
    expect(getCloudflareStreamOrigin()).toBe("https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com")
    expect(
      getResolvedVideoSource(undefined, "dad0deb02906401e5950bfe6816fb4a4", "mp4")
    ).toBe(
      "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/downloads/default.mp4"
    )
    expect(
      getResolvedVideoSource(undefined, "dad0deb02906401e5950bfe6816fb4a4", "hls")
    ).toBe(
      "https://customer-mjiwvs3h8hhcy2t8.cloudflarestream.com/dad0deb02906401e5950bfe6816fb4a4/manifest/video.m3u8"
    )
    expect(
      getVideoPosterSource("/content/videos-default/pinata.mp4", undefined, "dad0deb02906401e5950bfe6816fb4a4")
    ).toBe(
      "/content/video-posters/pinata.jpg"
    )
  })

  it("prefers Appwrite direct video sources over Cloudflare Stream fallbacks", () => {
    stubAppwriteEnv()
    vi.stubEnv("VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE", "mjiwvs3h8hhcy2t8")

    const appwritePinataUrl = `${appwriteEndpoint}/storage/buckets/${appwriteBucketId}/files/pinata/view?project=${appwriteProjectId}`

    expect(
      getResolvedVideoSource(
        "/content/videos-default/pinata.mp4",
        "dad0deb02906401e5950bfe6816fb4a4",
        "mp4"
      )
    ).toBe(appwritePinataUrl)
    expect(
      getResolvedVideoSource(
        "/content/videos-default/pinata.mp4",
        "dad0deb02906401e5950bfe6816fb4a4",
        "hls"
      )
    ).toBe(appwritePinataUrl)
  })

  it("derives a stable aspect ratio from known poster dimensions", () => {
    expect(getKnownVideoAspectRatio("/content/videos-default/captain-america.mp4")).toBe("720 / 400")
    expect(getKnownVideoAspectRatio("/content/videos-default/pinata.mp4")).toBe("480 / 854")
    expect(getKnownVideoAspectRatio("/content/files/photo.jpg")).toBeUndefined()
  })
})
