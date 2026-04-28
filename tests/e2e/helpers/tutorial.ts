import type { Page } from "@playwright/test"

export async function dismissTutorialIfVisible(page: Page) {
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
