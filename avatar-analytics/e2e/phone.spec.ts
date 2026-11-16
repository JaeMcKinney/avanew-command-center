import { expect, test } from "@playwright/test"
import { CLIENT_ADMIN, OWNER, signIn } from "./helpers"

test("on a phone, navigation is a tab bar and everything can be reached by keyboard", async ({ page }) => {
  await signIn(page, CLIENT_ADMIN)
  const tabs = page.getByRole("navigation", { name: "Main" }).filter({ visible: true })
  await expect(tabs).toHaveCount(1)
  await expect(tabs.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page")

  // Tap targets are at least 44px tall.
  for (const link of await tabs.getByRole("link").all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  for (const button of await page.getByRole("group", { name: "Date range" }).getByRole("button").all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(40)
  }

  await tabs.getByRole("link", { name: "Conversations" }).click()
  await expect(page.getByRole("heading", { name: "Conversations", level: 1 })).toBeVisible()

  // The first Tab stop is a link that skips the navigation.
  await page.goto("/c/northline")
  await expect(page.getByRole("heading", { name: "Talk time you have used" })).toBeVisible()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused()
})

test("on a phone, staff get the same tab bar", async ({ page }) => {
  await signIn(page, OWNER)
  const tabs = page.getByRole("navigation", { name: "Main" }).filter({ visible: true })
  await tabs.getByRole("link", { name: "Clients" }).click()
  await expect(page.getByRole("heading", { name: "Clients", level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Northline Realty" })).toBeVisible()
})
