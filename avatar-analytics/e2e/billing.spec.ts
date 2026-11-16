import { execFileSync } from "node:child_process"
import { expect, test, type Page } from "@playwright/test"
import { CLIENT_ADMIN, CLIENT_MEMBER, OWNER, expectAccessible, expectNoSidewaysScroll, signIn } from "./helpers"

const MOCK = "http://127.0.0.1:54398"
const NOW = Math.floor(Date.now() / 1000)
const sql = (statement: string) => execFileSync("docker", ["exec", "-i", "supabase_db_avatar-analytics", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq", "-c", statement]).toString().trim()

/** Gives the stand-in Stripe the subscription the sample data refers to. */
async function resetStripe(overrides: Record<string, unknown> = {}) {
  const state = await (await fetch(`${MOCK}/__control/state`)).json()
  await fetch(`${MOCK}/__control/reset`, {
    method: "POST",
    body: JSON.stringify({
      deployments: state.deployments,
      stripe: {
        customers: [], sessions: [], portals: [], calls: [], failNext: 0,
        subscriptions: { sub_demoNorthline: { id: "sub_demoNorthline", customer: "cus_demoNorthline", status: "active", cancel_at_period_end: false, metadata: {}, items: { data: [{ id: "si_demo", price: { id: "price_demoStandard" }, current_period_start: NOW - 10 * 86_400, current_period_end: NOW + 20 * 86_400 }] } } },
        ...overrides,
      },
    }),
  })
}
const stripeCalls = async () => (await (await fetch(`${MOCK}/__control/state`)).json()).stripe.calls as Array<{ method: string; path: string; form: Record<string, string> }>
const emails = async () => (await (await fetch(`${MOCK}/__control/state`)).json()).emails as Array<{ to: string[]; subject: string; text: string }>

async function openBilling(page: Page, email = CLIENT_ADMIN) {
  await signIn(page, email)
  await page.getByRole("link", { name: "Billing", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Billing", level: 1 })).toBeVisible()
}

test.describe.configure({ mode: "serial" })

test("a client sees their package, price, usage and invoices", async ({ page }) => {
  await resetStripe()
  await openBilling(page)
  const pkg = page.getByRole("region", { name: "Your package" })
  await expect(pkg).toContainText("Standard")
  await expect(pkg).toContainText("$199 a month")
  await expect(pkg).toContainText("300 minutes of talk time each month")
  await expect(pkg).toContainText("Up to 3 calls at the same time")
  await expect(pkg.getByText("Active", { exact: true })).toBeVisible()
  await expect(pkg).toContainText(/Your next payment of \$199 is on \w+ \d+, \d{4}/)

  // Usage matches the database, in words and on the bar.
  const usedSeconds = Number(sql("select (public.usage_standings()->>'used_seconds') from public.usage_standings() limit 1"))
  const usage = page.getByRole("region", { name: "Talk time this period" })
  await expect(usage).toContainText(`${Math.round(usedSeconds / 60)}`)
  await expect(usage).toContainText("of 300 minutes used")
  await expect(usage.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(Math.min(100, Math.floor(usedSeconds / 180))))

  const invoices = page.getByRole("table", { name: /Invoices/ })
  await expect(invoices.getByRole("row")).toHaveCount(4)
  await expect(invoices.getByRole("row").nth(1)).toContainText("DEMO-0003")
  await expect(invoices.getByRole("row").nth(1)).toContainText("$199")
  await expect(invoices.getByRole("link", { name: /Download invoice DEMO-0003/ })).toHaveAttribute("href", "https://invoice.stripe.test/i/in_demo3/pdf")
  await expectAccessible(page)
  await expectNoSidewaysScroll(page)
})

test("a client changes package themselves, then cancels and changes their mind", async ({ page }) => {
  await resetStripe()
  await openBilling(page)
  await page.getByRole("button", { name: "Change package" }).click()
  const dialog = page.getByRole("dialog", { name: "Change package" })
  await expect(dialog.getByRole("listitem").filter({ hasText: "Standard" }).first()).toContainText("Your package")
  await expect(dialog.getByRole("button", { name: "Switch to Standard" })).toHaveCount(0)
  await expectAccessible(page)
  await dialog.getByRole("button", { name: "Switch to Plus" }).click()
  await expect(page.getByText("Your package is now Plus.")).toBeVisible()
  const pkg = page.getByRole("region", { name: "Your package" })
  await expect(pkg).toContainText("$349 a month")
  await expect(page.getByRole("region", { name: "Talk time this period" })).toContainText("of 600 minutes used")
  expect((await stripeCalls()).find((c) => c.method === "POST" && c.path === "/subscriptions/sub_demoNorthline")!.form).toMatchObject({ "items[0][price]": "price_demoPlus" })

  // Cancel, with a reason. The Owner is told.
  await page.getByRole("button", { name: "Cancel subscription" }).click()
  const confirm = page.getByRole("alertdialog", { name: "Cancel your subscription?" })
  await expect(confirm).toContainText("You will not be charged again")
  await expectAccessible(page)
  await confirm.getByLabel("Why are you cancelling? (optional)").fill("Trying a different approach this quarter.")
  await confirm.getByRole("button", { name: "Cancel subscription" }).click()
  await expect(page.getByText(/Your subscription will end on/)).toBeVisible()
  await expect(pkg.getByText("Ending soon")).toBeVisible()
  await expect(pkg).toContainText(/Your subscription is cancelled and ends on/)
  const toOwner = (await emails()).filter((e) => e.to.includes(OWNER)).at(-1)!
  expect(toOwner.text).toContain("Northline Realty cancelled their subscription")
  expect(toOwner.text).toContain("Trying a different approach this quarter.")

  await pkg.getByRole("button", { name: "Keep my subscription" }).click()
  await expect(page.getByText("Your subscription continues.")).toBeVisible()
  await expect(pkg.getByText("Active", { exact: true })).toBeVisible()
  await expect(pkg.getByRole("button", { name: "Cancel subscription" })).toBeVisible()
})

test("paying and updating a card happen on Stripe's own pages", async ({ page }) => {
  await resetStripe()
  await page.route("https://billing.stripe.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Stripe billing page</h1>" }))
  await openBilling(page)
  await page.getByRole("button", { name: /Payment method/ }).click()
  await expect(page.getByRole("heading", { name: "Stripe billing page" })).toBeVisible()
  expect(page.url()).toMatch(/^https:\/\/billing\.stripe\.test\//)
})

test("when the minutes run out the client sees a pause notice, and a bigger package turns the avatars back on", async ({ page }) => {
  await resetStripe()
  // Put the client back on the smallest package, already over its allowance, and run the check.
  sql("update public.client_billing set plan_id = (select id from public.plans where name = 'Starter'), cancel_at_period_end = false, current_period_start = now() - interval '28 days' where stripe_subscription_id = 'sub_demoNorthline'")
  const check = await fetch("http://127.0.0.1:54399/functions/v1/usage-check", { method: "POST", headers: { "x-cron-secret": "local-cron-secret" }, body: "{}" })
  expect(await check.json()).toMatchObject({ paused: 1 })

  await openBilling(page)
  await expect(page.getByRole("status").filter({ hasText: "Your avatars are paused." })).toBeVisible()
  await expect(page.getByRole("region", { name: "Your package" }).getByText("Paused: minutes used up")).toBeVisible()
  await expect(page.getByRole("region", { name: "Talk time this period" })).toContainText("All of this period's minutes are used.")
  expect((await emails()).some((e) => e.to.includes(CLIENT_ADMIN) && e.subject.includes("Your avatars are paused"))).toBe(true)
  await expectAccessible(page)

  await page.getByRole("button", { name: "Change package" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Switch to Plus" }).click()
  await expect(page.getByText("Your package is now Plus, and your avatars are back on.")).toBeVisible()
  await expect(page.getByText("Your avatars are paused.")).toHaveCount(0)
  expect(sql("select status from public.clients where slug = 'northline'")).toBe("active")
  // Leave the sample data as other tests expect it.
  sql("update public.client_billing set plan_id = (select id from public.plans where name = 'Standard') where stripe_subscription_id = 'sub_demoNorthline'")
})

test("a client without a subscription chooses a package and is sent to Stripe to pay", async ({ page }) => {
  await resetStripe()
  await page.route("https://checkout.stripe.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Stripe checkout</h1>" }))
  await openBilling(page, "pat@harbor.test")
  await expect(page.getByRole("heading", { name: "Choose a package" })).toBeVisible()
  await expect(page.getByRole("listitem").filter({ hasText: "Starter" })).toContainText("$99 a month")
  await expectAccessible(page)
  await page.getByRole("button", { name: "Subscribe to Standard" }).click()
  await expect(page.getByRole("heading", { name: "Stripe checkout" })).toBeVisible()
  const session = (await stripeCalls()).find((c) => c.path === "/checkout/sessions")!
  expect(session.form).toMatchObject({ mode: "subscription", "line_items[0][price]": "price_demoStandard" })
})

test("a client member cannot see billing unless they are given the permission", async ({ page }) => {
  await signIn(page, CLIENT_MEMBER)
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Billing" })).toHaveCount(0)
  await page.goto("/c/northline/billing")
  await expect(page.getByText("You do not have access to this page")).toBeVisible()
})

test("staff set up packages and the usage rules", async ({ page }) => {
  await signIn(page, OWNER)
  await page.getByRole("link", { name: "Packages" }).click()
  const table = page.getByRole("table", { name: "Packages" })
  await expect(table.getByRole("row")).toHaveCount(4)
  await expectAccessible(page)
  await expectNoSidewaysScroll(page)

  await page.getByRole("button", { name: "Add a package" }).first().click()
  const dialog = page.getByRole("dialog", { name: "Add a package" })
  await dialog.getByRole("button", { name: "Save package" }).click()
  await expect(dialog.getByText("Give the package a name")).toBeVisible()
  await expectAccessible(page)
  await dialog.getByLabel("Name").fill("Enterprise")
  await dialog.getByLabel("Monthly price (US dollars)").fill("799")
  await dialog.getByLabel("Minutes included each month").fill("2000")
  await dialog.getByLabel("Calls at the same time (optional)").fill("10")
  await dialog.getByLabel("Order").fill("9")
  await dialog.getByRole("button", { name: "Save package" }).click()
  await expect(page.getByText("Package added")).toBeVisible()
  const row = table.getByRole("row").filter({ hasText: "Enterprise" })
  await expect(row).toContainText("$799")
  await expect(row).toContainText("2,000")
  await expect(row).toContainText("Needs a Stripe price")

  await row.getByRole("button", { name: "Edit Enterprise" }).click()
  const edit = page.getByRole("dialog", { name: "Edit Enterprise" })
  await edit.getByLabel("Stripe price ID").fill("price_demoEnterprise")
  await edit.getByRole("button", { name: "Save package" }).click()
  await expect(row).toContainText("On offer")

  const rules = page.getByRole("region", { name: "When minutes run low" })
  await rules.getByLabel("Send one warning email at (% of minutes used)").fill("80")
  await rules.getByRole("button", { name: "Save usage rules" }).click()
  await expect(page.getByText("Usage rules saved")).toBeVisible()
  expect(sql("select value from public.settings where key = 'usage.alert_percent'")).toBe("80")
  sql("update public.settings set value = '90' where key = 'usage.alert_percent'; delete from public.plans where name = 'Enterprise'")
})
