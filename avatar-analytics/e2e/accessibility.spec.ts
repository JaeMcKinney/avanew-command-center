import { expect, test } from "@playwright/test"
import { CLIENT_ADMIN, expectAccessible, expectNoSidewaysScroll, OWNER, signIn } from "./helpers"

// Runs on a desktop and on a phone, in light and dark, against WCAG 2.2 AA.
for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme })

    test("sign-in page", async ({ page }) => {
      await page.goto("/login")
      await expectAccessible(page)
      await expectNoSidewaysScroll(page)
    })

    test("admin pages", async ({ page }) => {
      await signIn(page, OWNER)
      for (const path of ["/admin", "/admin/clients", "/admin/clients/new", "/admin/clients/northline", "/admin/avatars", "/admin/avatars/p3a91c0de01", "/admin/team", "/admin/plans", "/admin/finance", "/admin/activity"]) {
        await page.goto(path)
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
        await expectAccessible(page)
        await expectNoSidewaysScroll(page)
      }
      // Dialogs too.
      await page.goto("/admin/clients/northline")
      await page.getByRole("button", { name: "Link avatars" }).first().click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await expectAccessible(page)
    })

    test("client portal pages", async ({ page }) => {
      await signIn(page, CLIENT_ADMIN)
      for (const path of ["/c/northline", "/c/northline/conversations", "/c/northline/questions", "/c/northline/avatars", "/c/northline/team", "/c/northline/billing"]) {
        await page.goto(path)
        await expect(page.getByRole("heading").first()).toBeVisible()
        await expectAccessible(page)
        await expectNoSidewaysScroll(page)
      }
      // Table views of the charts.
      await page.goto("/c/northline")
      for (const button of await page.getByRole("button", { name: "Show as table" }).all()) await button.click()
      await expectAccessible(page)
    })
  })
}
