import type { Page } from "@playwright/test"

async function forceCompleteTutorial(page: Page) {
  await page.evaluate(() => {
    const sessionId = window.sessionStorage.getItem("ineedsocial:study:active-session")
    if (!sessionId) {
      return
    }

    window.sessionStorage.setItem(
      `ineedsocial:study:${sessionId}:tutorial`,
      JSON.stringify({ completed: true, currentStep: 0 })
    )
  })
  await page.reload()
  await waitForFeedAfterTutorial(page)
}

async function waitForFeedAfterTutorial(page: Page) {
  await page.getByTestId("feed-scroll-container").waitFor({ state: "visible" })
  await page
    .locator("[data-regular-post-id]")
    .first()
    .waitFor({ state: "attached", timeout: 5_000 })
    .catch(() => {})

  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('[data-testid="feed-scroll-container"]')
      ?.dispatchEvent(new Event("scroll"))
    window.dispatchEvent(new Event("resize"))
  })
}

async function hasUnfinishedTutorial(page: Page) {
  return page.evaluate(() => {
    const sessionId = window.sessionStorage.getItem("ineedsocial:study:active-session")
    if (!sessionId) {
      return false
    }

    const raw = window.sessionStorage.getItem(`ineedsocial:study:${sessionId}:tutorial`)
    if (!raw) {
      return true
    }

    try {
      const state = JSON.parse(raw) as { completed?: boolean }
      return !state.completed
    } catch {
      return true
    }
  })
}

export async function dismissTutorialIfVisible(page: Page) {
  // Non-tutorial e2e specs should not spend their timeout budget clicking onboarding UI.
  // Dedicated tutorial specs still exercise the real overlay path.
  if (await hasUnfinishedTutorial(page)) {
    await forceCompleteTutorial(page)
    return
  }

  await waitForFeedAfterTutorial(page)
}
