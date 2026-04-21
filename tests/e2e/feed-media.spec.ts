import { expect, test, type Page } from "@playwright/test"

async function dismissTutorialIfVisible(page: Page) {
  const tutorialSkipButton = page.getByTestId("tutorial-skip-button")
  const tutorialIsVisible = await tutorialSkipButton
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (tutorialIsVisible) {
    await tutorialSkipButton.click({ force: true })
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="tutorial-skip-button"]'), {
        timeout: 5_000,
      })
      .catch(() => {})
  }
}

async function getFeedScrollTop(page: Page) {
  return page.getByTestId("feed-scroll-container").evaluate((element) => element.scrollTop)
}

async function setFeedScrollTop(page: Page, top: number) {
  await page.getByTestId("feed-scroll-container").evaluate((element, nextTop) => {
    element.scrollTop = nextTop
    element.dispatchEvent(new Event("scroll"))
  }, top)
}

async function waitForFeedScrollTopAtLeast(page: Page, minimumTop: number) {
  await expect
    .poll(async () => getFeedScrollTop(page), {
      message: `Expected feed scrollTop to reach at least ${minimumTop}px`,
    })
    .toBeGreaterThan(minimumTop)
}

async function waitForRenderedImageMedia(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    if (!post) {
      return false
    }

    const images = Array.from(post.querySelectorAll("img[alt]"))
    if (!images.length) {
      return false
    }

    return images.some((node) => {
      if (!(node instanceof HTMLImageElement)) {
        return false
      }

      const style = window.getComputedStyle(node)
      return node.complete && node.naturalWidth > 0 && style.opacity !== "0"
    })
  }, postId)
}

async function waitForRenderedVideoMedia(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    if (!post) {
      return false
    }

    const video = post.querySelector("video")
    if (!(video instanceof HTMLVideoElement)) {
      return false
    }

    const style = window.getComputedStyle(video)
    return style.opacity !== "0" && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  }, postId)
}

async function waitForRenderedVideoFallbackMedia(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    if (!post) {
      return false
    }

    const poster = post.querySelector('img[aria-hidden="true"]')
    if (!(poster instanceof HTMLImageElement)) {
      return false
    }

    return poster.complete && poster.naturalWidth > 0
  }, postId)
}

async function waitForVideoPlaying(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    const video = post?.querySelector("video")
    return (
      video instanceof HTMLVideoElement &&
      !video.paused &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    )
  }, postId)
}

async function waitForVideoPausedAndReset(page: Page, postId: string) {
  await page.waitForFunction((targetPostId) => {
    const post = document.querySelector<HTMLElement>(`[data-regular-post-id="${targetPostId}"]`)
    const video = post?.querySelector("video")
    return (
      video instanceof HTMLVideoElement &&
      video.paused &&
      Math.abs(video.currentTime) < 0.05
    )
  }, postId)
}

async function waitForSinglePlayingVideo(page: Page, expectedPostId: string) {
  await page.waitForFunction((targetPostId) => {
    const playingVideos = Array.from(document.querySelectorAll("video")).filter((node) => {
      return node instanceof HTMLVideoElement && !node.paused
    })

    if (playingVideos.length !== 1) {
      return false
    }

    const ownerPost = playingVideos[0].closest<HTMLElement>("[data-regular-post-id]")
    return ownerPost?.dataset.regularPostId === targetPostId
  }, expectedPostId)
}

async function scrollPostIntoView(page: Page, postId: string) {
  const post = page.locator(`[data-regular-post-id="${postId}"]`)
  await post.scrollIntoViewIfNeeded()
  await expect(post).toBeVisible()
}

async function startStudy(page: Page) {
  await page.goto("/")
  await page.waitForURL("**/welcome")
  await page.getByTestId("start-study-button").click()
  await page.waitForURL("**/feed?theme=light")
}

test("only the visible video plays and it resets after leaving the viewport", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")
  await waitForVideoPlaying(page, "post-video-sample")
  await waitForSinglePlayingVideo(page, "post-video-sample")

  await scrollPostIntoView(page, "post-buffalo")
  await waitForRenderedVideoMedia(page, "post-buffalo")
  await waitForVideoPlaying(page, "post-buffalo")
  await waitForSinglePlayingVideo(page, "post-buffalo")
  await waitForVideoPausedAndReset(page, "post-video-sample")
})

test("photo, carousel, and video media render again after leaving and returning to feed", async ({
  page,
}) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await waitForRenderedImageMedia(page, "post-snoopy")
  await setFeedScrollTop(page, 1_050)
  await waitForFeedScrollTopAtLeast(page, 650)
  await waitForRenderedImageMedia(page, "post-carousel")
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")

  await page.goBack()
  await page.waitForURL("**/welcome")

  await page.goForward()
  await page.waitForURL("**/feed?theme=light")
  await waitForRenderedImageMedia(page, "post-snoopy")
  await setFeedScrollTop(page, 1_050)
  await waitForFeedScrollTopAtLeast(page, 650)
  await waitForRenderedImageMedia(page, "post-carousel")
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")
})

test("refresh with a controlling service worker keeps videos rendering", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")

  await page.reload()
  await page.waitForURL("**/feed?theme=light")
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller))
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")
})

test("refresh resets autoplay-with-sound preference while keeping videos rendering", async ({
  page,
}) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")

  const muteButton = page.getByTestId("mute-button-post-video-sample")
  await expect(muteButton).toHaveAttribute("data-muted", "true")
  await muteButton.click()
  await expect(muteButton).toHaveAttribute("data-muted", "false")

  await page.reload()
  await page.waitForURL("**/feed?theme=light")
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller))
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")
  await expect(page.getByTestId("mute-button-post-video-sample")).toHaveAttribute(
    "data-muted",
    "true"
  )
})

test("autoplay failures are buffered locally without crashing the feed", async ({ page }) => {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play

    HTMLMediaElement.prototype.play = function () {
      const source = (this as HTMLMediaElement).currentSrc || this.getAttribute("src") || ""
      if (source.includes("pinata.mp4")) {
        return Promise.reject(new DOMException("autoplay blocked", "NotAllowedError"))
      }

      return originalPlay.call(this)
    }
  })

  await startStudy(page)
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoFallbackMedia(page, "post-video-sample")
  await expect(page.locator('[data-regular-post-id="post-video-sample"]')).toBeVisible()

  await expect
    .poll(async () =>
      page.evaluate(() => window.sessionStorage.getItem("ineedsocial:runtime-monitoring"))
    )
    .toContain("Video autoplay was blocked or interrupted.")
})

test("video mute preference stays session-scoped across later videos", async ({ page }) => {
  await startStudy(page)
  await dismissTutorialIfVisible(page)

  await scrollPostIntoView(page, "post-video-sample")
  await waitForRenderedVideoMedia(page, "post-video-sample")

  const firstVideoMuteButton = page.getByTestId("mute-button-post-video-sample")
  await expect(firstVideoMuteButton).toHaveAttribute("data-muted", "true")
  await firstVideoMuteButton.click()
  await expect(firstVideoMuteButton).toHaveAttribute("data-muted", "false")

  await scrollPostIntoView(page, "post-kopi-kak")
  await waitForRenderedVideoMedia(page, "post-kopi-kak")
  await expect(page.getByTestId("mute-button-post-kopi-kak")).toHaveAttribute(
    "data-muted",
    "false"
  )

  await page.getByTestId("sidebar-exit-button").click()
  await page.getByTestId("exit-session-confirm-button").click()
  await page.waitForURL("**/welcome")

  await page.getByTestId("start-study-button").click()
  await page.waitForURL("**/feed?theme=light")
  await dismissTutorialIfVisible(page)
  await scrollPostIntoView(page, "post-video-sample")
  await expect(page.getByTestId("mute-button-post-video-sample")).toHaveAttribute(
    "data-muted",
    "true"
  )
})
