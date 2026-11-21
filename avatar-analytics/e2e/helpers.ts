import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

export const PASSWORD = "Correct-horse-9-battery"
export const OWNER = "owner@divigner.test"
export const CLIENT_ADMIN = "dana@northline.test"
export const CLIENT_MEMBER = "lee@northline.test"

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
}

/** Fails on any WCAG 2.2 A or AA problem axe can detect. */
export async function expectAccessible(page: Page) {
  await page.waitForLoadState("networkidle")
  // A dialog that is still fading in reads as low contrast, so let animations finish first.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))))
  // axe ships its own copy of Playwright's types, which lags a version behind.
  const results = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()
  const summary = results.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")}${v.id === "color-contrast" ? ` [${n.html.slice(0, 140)}] ${n.any[0]?.message ?? ""}` : ""}`).join(" | ")}`)
  expect(summary).toEqual([])
}

export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/** The newest email sent to an address, from the local mail catcher. */
export async function latestEmailLink(to: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()
    const id = list.messages?.[0]?.ID
    if (id) {
      const message = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)).json()
      const link = /https?:\/\/[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+/.exec(message.Text || message.HTML)?.[0]
      if (link) return link.replace(/&amp;/g, "&")
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`No email with a link arrived for ${to}`)
}
