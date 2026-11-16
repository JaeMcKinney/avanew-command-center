import { createClient } from "@supabase/supabase-js"
import { expect, test } from "@playwright/test"
import { CLIENT_ADMIN, CLIENT_MEMBER, OWNER, signIn } from "./helpers"

process.loadEnvFile(".env.local")
const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}

/** Whole minutes for a client from a given day to today, straight from the database. */
async function minutesSince(slug: string, from: string) {
  const { data: client } = await admin.from("clients").select("id").eq("slug", slug).single()
  const { data } = await admin.from("usage_daily").select("billable_seconds").eq("client_id", client!.id).gte("usage_date", from)
  return Math.round(data!.reduce((sum, r) => sum + r.billable_seconds, 0) / 60).toLocaleString("en-US")
}

test("a client sees their own talk time, avatars and charts", async ({ page }) => {
  await signIn(page, CLIENT_ADMIN)
  await page.waitForURL("**/c/northline")
  const today = todayIn("America/New_York")

  // The three headline numbers match the database.
  const stats = page.getByRole("region", { name: "Talk time you have used" })
  await expect(stats.getByText("This month").locator("..")).toContainText(`${await minutesSince("northline", today.slice(0, 8) + "01")}min`)
  await expect(stats.getByText("This year").locator("..")).toContainText(`${await minutesSince("northline", today.slice(0, 4) + "-01-01")}min`)

  // Their avatars, and only theirs.
  const avatars = page.getByRole("list", { name: "Your avatars" })
  await expect(avatars.getByRole("listitem")).toHaveCount(3)
  await expect(avatars).toContainText("Maya")
  await expect(avatars).toContainText("Leasing concierge")
  await expect(page.getByText("Zara")).toHaveCount(0)

  // The ring chart is described in words, and can be read as a table.
  await expect(page.getByRole("img", { name: /Talk time by avatar\. Maya \d+ min, \d+%/ })).toBeVisible()
  await page.getByRole("button", { name: "Show as table" }).first().click()
  const table = page.getByRole("table", { name: /Talk time by avatar/ })
  await expect(table.getByRole("rowheader", { name: "Maya" })).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "Share" })).toBeVisible()

  // Changing the period updates the summary and the chart's grouping.
  await page.getByRole("button", { name: "This year" }).click()
  await expect(page.getByRole("button", { name: "This year" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByText(/By month, in minutes/)).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "Showing" })).toContainText(`${await minutesSince("northline", today.slice(0, 4) + "-01-01")} min`)

  // A custom period is checked before it is used.
  await page.getByRole("button", { name: "Custom" }).click()
  await page.getByLabel("From", { exact: true }).fill("2026-12-31")
  await page.getByLabel("To", { exact: true }).fill("2026-01-01")
  await page.getByRole("button", { name: "Show", exact: true }).click()
  await expect(page.getByRole("alert")).toHaveText("The start date must be on or before the end date.")
  await page.getByLabel("From", { exact: true }).fill(today)
  await page.getByLabel("To", { exact: true }).fill(today)
  await page.getByRole("button", { name: "Show", exact: true }).click()
  await expect(page.getByText(/By day, in minutes/)).toBeVisible()
})

test("a client reads a conversation and copies an embed code", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Conversations" }).click()
  await page.getByRole("button", { name: "This year" }).click()
  await page.getByRole("button", { name: /^Read the conversation/ }).first().click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading")).toContainText("Conversation with")
  await expect(dialog.getByText("Visitor").first()).toBeVisible()
  await expect(dialog.getByText(/two-bedroom homes/).first()).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("link", { name: "Avatars" }).click()
  await expect(page.getByRole("heading", { name: "Maya", level: 3 })).toBeVisible()
  await page.getByRole("button", { name: "Copy code" }).first().click()
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('<tavus-embed deployment-id="d-maya-embed"></tavus-embed>')
  // Clients cannot unlink or edit avatars.
  await expect(page.getByRole("button", { name: /Unlink/ })).toHaveCount(0)
})

test("a client cannot reach the admin area or another client's portal", async ({ page }) => {
  await signIn(page, CLIENT_ADMIN)
  await page.goto("/admin")
  await page.waitForURL("**/c/northline")
  await page.goto("/admin/clients/harbor-dental")
  await page.waitForURL("**/c/northline")
  await page.goto("/c/harbor-dental")
  await expect(page.getByText("This page is not available")).toBeVisible()
  await expect(page.getByText("Zara")).toHaveCount(0)
})

test("a client member sees less than a client admin", async ({ page }) => {
  await signIn(page, CLIENT_MEMBER)
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Conversations" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0)
  await page.goto("/c/northline/team")
  await expect(page.getByText("You do not have access to this page")).toBeVisible()
})

test("a client admin invites a colleague and can remove their access", async ({ page }) => {
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Team" }).click()
  await page.getByRole("button", { name: "Invite a user" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Name").fill("Noor Ali")
  await dialog.getByLabel("Email").fill("not-an-email")
  await dialog.getByRole("button", { name: "Send invite" }).click()
  await expect(dialog.getByRole("alert")).toHaveText("Enter a valid email address")
  await dialog.getByLabel("Email").fill("noor@northline.test")
  // Only client roles are offered.
  await expect(dialog.getByLabel("Role").locator("option")).toHaveText(["Client admin", "Client member"])
  await dialog.getByRole("button", { name: "Send invite" }).click()
  await expect(page.getByText("Invite sent to noor@northline.test.")).toBeVisible()

  await page.getByRole("button", { name: "Remove access for Noor Ali" }).click()
  await expect(page.getByRole("listitem").filter({ hasText: "Noor Ali" })).toContainText("No access")
})

test("staff can see what a client sees, with the client's branding", async ({ page }) => {
  await signIn(page, OWNER)
  await page.goto("/admin/clients/northline")
  await page.getByRole("link", { name: "See what the client sees" }).click()
  await expect(page.getByText("You are seeing what Northline Realty sees.")).toBeVisible()
  const brand = await page.evaluate(() => getComputedStyle(document.querySelector("header")!).getPropertyValue("--brand").trim())
  expect(brand.toLowerCase()).toBe("#0f766e")
  await page.getByRole("link", { name: "Back to admin" }).click()
  await page.waitForURL("**/admin/clients/northline")
})

test("signing in with a wrong password explains what happened", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill(CLIENT_ADMIN)
  await page.getByLabel("Password").fill("wrong-password")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("alert")).toHaveText("That email and password do not match. Check them and try again.")
  await page.goto("/admin")
  await page.waitForURL("**/login")
})
