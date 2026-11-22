import { expect, test } from "@playwright/test"
import { CLIENT_ADMIN, OWNER, expectAccessible, expectNoSidewaysScroll, signIn } from "./helpers"

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

test("on a phone, pages that do not fit the tab bar are under More", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The tab bar only shows on small screens")
  await signIn(page, CLIENT_ADMIN)
  const tabs = page.getByRole("navigation", { name: "Main" }).filter({ visible: true })
  await expect(tabs.getByRole("link")).toHaveCount(4)
  await expect(tabs.getByRole("link", { name: "Billing" })).toHaveCount(0)
  const more = tabs.getByRole("button", { name: "More" })
  expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await more.click()
  const menu = page.getByRole("dialog", { name: "More" })
  await expect(menu.getByRole("link")).toHaveText(["Avatars", "Team", "Billing"])
  await expectAccessible(page)
  await menu.getByRole("link", { name: "Billing" }).click()
  await expect(page.getByRole("heading", { name: "Billing", level: 1 })).toBeVisible()
  await expect(menu).toHaveCount(0)
  await expectNoSidewaysScroll(page)
  await expectAccessible(page)

})

test("on a phone, staff reach every page too", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The tab bar only shows on small screens")
  await signIn(page, OWNER)
  const tabs = page.getByRole("navigation", { name: "Main" }).filter({ visible: true })
  await tabs.getByRole("link", { name: "Support" }).click()
  await expect(page.getByRole("heading", { name: "Support Desk", level: 1 })).toBeVisible()
  await expectNoSidewaysScroll(page)
  await expectAccessible(page)
  await tabs.getByRole("button", { name: "More" }).click()
  await expect(page.getByRole("dialog", { name: "More" }).getByRole("link")).toHaveText(["Finance", "Packages", "Team", "Agencies", "Activity"])
  await page.getByRole("dialog", { name: "More" }).getByRole("link", { name: "Finance" }).click()
  await expect(page.getByRole("heading", { name: "Finance", level: 1 })).toBeVisible()
  await expectNoSidewaysScroll(page)
  await tabs.getByRole("button", { name: "More" }).click()
  await page.getByRole("dialog", { name: "More" }).getByRole("link", { name: "Agencies" }).click()
  await expect(page.getByRole("heading", { name: "Agencies", level: 1 })).toBeVisible()
  await expectNoSidewaysScroll(page)
  await expectAccessible(page)
  await page.getByRole("link", { name: "Avanew" }).click()
  await page.getByRole("tab", { name: "Brand" }).click()
  await expect(page.getByRole("group", { name: "Light Version" })).toBeVisible()
  await expectNoSidewaysScroll(page)
  await tabs.getByRole("button", { name: "More" }).click()
  await page.getByRole("dialog", { name: "More" }).getByRole("link", { name: "Activity" }).click()
  await expect(page.getByRole("heading", { name: "Activity", level: 1 })).toBeVisible()
})
