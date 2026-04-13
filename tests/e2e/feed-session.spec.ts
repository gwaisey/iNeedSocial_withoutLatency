import { expect, test, type Page } from "@playwright/test"

function sumGenreTimes(snapshot: {
  genreTimes?: Record<string, number>
} | null) {
  return Object.values(snapshot?.genreTimes ?? {}).reduce(
    (total, value) => total + value,
    0
  )
}

async function readSessionSnapshot(page: Page) {
  return page.evaluate(() => {
    const sessionId = window.sessionStorage.getItem("gaby:study:active-session")
    if (!sessionId) {
      return null
    }

    const raw = window.sessionStorage.getItem(`gaby:study:${sessionId}:feed-session`)
    return raw ? (JSON.parse(raw) as { genreTimes?: Record<string, number> }) : null
  })
}

async function dismissTutorialIfVisible(page: Page) {
  await page.waitForTimeout(500)

  const tutorialSkipButton = page.getByTestId("tutorial-skip-button")
  if (await tutorialSkipButton.isVisible().catch(() => false)) {
    await tutorialSkipButton.click()
  }
}

test("refresh keeps the same study session state in the feed", async ({ page }) => {
  await page.goto("/")
  await page.waitForURL("**/welcome")

  await page.getByTestId("start-study-button").click()
  await page.waitForURL("**/feed?theme=light")
  await dismissTutorialIfVisible(page)

  const firstLikeButton = page.locator('[data-testid^="like-button-"]').first()
  await firstLikeButton.waitFor({ state: "visible" })
  await firstLikeButton.click()

  await expect(firstLikeButton).toHaveAttribute("data-liked", "true")

  await page.waitForTimeout(1_200)
  await page.reload()
  await page.waitForURL("**/feed?theme=light")
  await dismissTutorialIfVisible(page)

  const reloadedLikeButton = page.locator('[data-testid^="like-button-"]').first()
  await reloadedLikeButton.waitFor({ state: "visible" })
  await expect(reloadedLikeButton).toHaveAttribute("data-liked", "true")

  const snapshotAfterRefresh = await readSessionSnapshot(page)
  expect(sumGenreTimes(snapshotAfterRefresh)).toBeGreaterThan(0)

  await page.waitForTimeout(700)
  await page.getByTestId("timer-open-button").click()

  await expect(page.getByTestId("timer-value")).not.toHaveText("00 : 00 : 00")
  await page.getByTestId("finish-session-button").click()
  await page.waitForURL("**/thank-you")
})

test("malformed feed payload shows the localized retry state", async ({ page }) => {
  await page.route("**/content/feed.json", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        posts: [{ id: "rusak" }],
      }),
      contentType: "application/json",
      status: 200,
    })
  })

  await page.goto("/feed?theme=light")

  await expect(page.getByText("Feed tidak dapat dimuat.")).toBeVisible()
  await expect(page.getByText("Format feed tidak valid.")).toBeVisible()
  await expect(page.getByTestId("feed-error-retry")).toBeVisible()
})
