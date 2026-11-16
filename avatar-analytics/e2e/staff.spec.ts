import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { strFromU8, unzipSync } from "fflate"
import { CLIENT_ADMIN, OWNER, expectAccessible, expectNoSidewaysScroll, signIn } from "./helpers"

// A small real PNG: a blue square.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGklEQVR4nGPQj/7/nxLMMGrAqAGjBgwXAwDwxDYQ5m0b3QAAAABJRU5ErkJggg==", "base64")

test("staff see an avatar's IDs and everything Tavus holds about it", async ({ page }) => {
  await signIn(page, OWNER)
  await page.getByRole("link", { name: "Avatars" }).click()
  const card = page.getByRole("listitem").filter({ hasText: "Maya · Northline Leasing Concierge" })
  await expect(card.getByText("p3a91c0de01", { exact: true })).toBeVisible()
  await expect(card.getByText("r3a91c0de01", { exact: true })).toBeVisible()
  await card.getByRole("link", { name: /Maya/i }).click()

  await expect(page.getByRole("heading", { name: "Maya · Northline Leasing Concierge", level: 1 })).toBeVisible()
  await expect(page.getByRole("region", { name: "Identifiers" })).toContainText("Northline Realty")
  await expect(page.getByRole("region", { name: "System prompt" }).locator("pre")).toContainText("You are Maya, a friendly concierge.")
  const knowledge = page.getByRole("region", { name: /^Knowledge base/i })
  await expect(knowledge).toContainText("Office hours and policies")
  await expect(knowledge).toContainText("This document could not be read from Tavus")
  await expect(page.getByRole("region", { name: /^Guardrails/i })).toContainText("Never give legal or financial advice.")
  await expect(page.getByRole("region", { name: /^Objectives/i })).toContainText("Find out when the visitor would like to tour and book it.")
  const tools = page.getByRole("region", { name: /^Tool calls/i })
  await expect(tools).toContainText("book_tour")
  await expect(tools).toContainText("POST https://hooks.northlinerealty.example/tours")
  await expect(tools).toContainText("web_search")
  await expect(page.getByRole("region", { name: "Face, voice and models" })).toContainText("phoenix-4.5")
  // Keys never reach the page, even in the full record.
  await page.getByText("Show the full record").click()
  await expect(page.getByLabel("Show the full record")).toContainText('"api_key": "(hidden)"')
  expect(await page.content()).not.toMatch(/sk-should-never-be-shown|tool-secret-value|hidden-header-value/)
  await expectAccessible(page)
  await expectNoSidewaysScroll(page)

  // The same IDs are on the client's own avatar cards, for staff.
  await page.goto("/admin/clients/northline")
  const maya = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Maya", level: 3 }) })
  await expect(maya.getByText("p3a91c0de01", { exact: true })).toBeVisible()
  await expect(maya.getByText("r3a91c0de01", { exact: true })).toBeVisible()
})

test("staff keep a file on each client: one list, contacts, notes and account details", async ({ page }) => {
  await signIn(page, OWNER)
  await page.getByRole("link", { name: "Clients" }).click()
  const row = page.getByRole("table", { name: /Clients/i }).getByRole("row").filter({ hasText: "Northline Realty" })
  await expect(row).toContainText("Standard")
  await expect(row).toContainText("Morgan Hale")
  await expect(row).toContainText("Real estate")
  await page.getByLabel("Find a client").fill("dental")
  await expect(page.getByRole("status").filter({ hasText: /of \d+ clients/ })).toContainText(/^1 of \d+ clients$/)
  await page.getByLabel("Find a client").fill("")
  await expectAccessible(page)

  await page.getByRole("tab", { name: /^Contacts/i }).click()
  const contacts = page.getByRole("table", { name: /Contacts/i })
  await expect(contacts.getByRole("row").filter({ hasText: "Morgan Hale" })).toHaveCount(1)
  await expect(contacts).toContainText("pat@harbor.test")
  await expectAccessible(page)

  await page.goto("/admin/clients/northline")
  await page.getByRole("tab", { name: "Notes" }).click()
  await expect(page.getByText("Kick-off call. They want a second avatar")).toBeVisible()
  await page.getByRole("button", { name: "Add note" }).click()
  await expect(page.getByText("Write the note first.")).toBeVisible()
  await page.getByLabel("Add a note to Northline Realty's file").fill("Renewal conversation booked for the 3rd.")
  await page.getByLabel("Kind").selectOption("meeting")
  await page.getByRole("button", { name: "Add note" }).click()
  await expect(page.getByText("Note added")).toBeVisible()
  await expect(page.getByRole("listitem").filter({ hasText: "Renewal conversation booked" })).toContainText("Meeting")
  await expectAccessible(page)

  await page.getByRole("tab", { name: "Contacts" }).click()
  await page.getByRole("button", { name: "Add a contact" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Name").fill("Avery Stone")
  await dialog.getByLabel("Email (optional)").fill("not-an-email")
  await dialog.getByRole("button", { name: "Save contact" }).click()
  await expect(dialog.getByText("Enter an email address like name@example.com")).toBeVisible()
  await dialog.getByLabel("Email (optional)").fill("avery@northline.test")
  await dialog.getByRole("button", { name: "Save contact" }).click()
  await expect(page.getByRole("heading", { name: "Avery Stone" })).toBeVisible()

  await page.getByRole("tab", { name: "Details" }).click()
  await expect(page.getByLabel("Website")).toHaveValue("https://northlinerealty.example")
  await page.getByLabel("Industry").fill("Residential real estate")
  await page.getByRole("button", { name: "Save account details" }).click()
  await expect(page.getByText("Account details saved")).toBeVisible()
})

test("staff upload a client's logo, adjust it, and it appears in the client's portal", async ({ page }) => {
  await signIn(page, OWNER)
  await page.goto("/admin/clients/harbor-dental")
  await page.getByRole("tab", { name: "Details" }).click()
  const editor = page.getByRole("region", { name: "Logo" })
  await editor.getByLabel("Choose an image").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") })
  await expect(editor.getByRole("alert")).toHaveText("Choose a PNG, JPG, SVG or WebP image.")
  await editor.getByLabel("Choose an image").setInputFiles({ name: "harbor.png", mimeType: "image/png", buffer: PNG })
  await expect(editor.getByRole("img", { name: /Preview of the Harbor Dental logo/i })).toBeVisible()
  await editor.getByLabel("Size").fill("140")
  await editor.getByRole("radio", { name: "White", exact: true }).check()
  await expectAccessible(page)
  await editor.getByRole("button", { name: "Save logo" }).click()
  await expect(page.getByText("Logo saved for Harbor Dental")).toBeVisible()
  await expect(editor.getByRole("img", { name: "Harbor Dental logo on a light background" })).toBeVisible()

  // Saved as a PNG of the fixed letterhead shape, and shown in the portal header.
  const src = await editor.getByRole("img", { name: "Harbor Dental logo on a light background" }).getAttribute("src")
  expect(src).toMatch(/\/storage\/v1\/object\/public\/logos\/[0-9a-f-]+\/[0-9a-f-]+\.png$/)
  const file = await (await fetch(src!)).arrayBuffer()
  expect(Buffer.from(file).subarray(0, 4).toString("hex")).toBe("89504e47")
  expect(Buffer.from(file).readUInt32BE(16)).toBe(900)
  expect(Buffer.from(file).readUInt32BE(20)).toBe(300)
  await page.goto("/c/harbor-dental")
  await expect(page.locator(`header img[src="${src}"]`)).toBeVisible()
})

test("staff see revenue, what recurs monthly and profit after costs", async ({ page }) => {
  await signIn(page, OWNER)
  await page.getByRole("link", { name: "Finance" }).click()
  await expect(page.getByRole("heading", { name: "Finance", level: 1 })).toBeVisible()
  // Sample data: one client on $199 a month with three paid invoices this year ($597).
  // Extra minutes bought in other tests add to that, so check against the database.
  const query = "select (select coalesce(sum(amount_paid_cents),0) from public.invoices where status='paid') + (select coalesce(sum(amount_cents),0) from public.usage_topups where status='paid')"
  const paid = Number(execFileSync("docker", ["exec", "-i", "supabase_db_avatar-analytics", "psql", "-U", "postgres", "-Atq", "-c", query]).toString().trim()) / 100
  const total = "$" + paid.toLocaleString("en-US")
  expect(paid).toBeGreaterThanOrEqual(597)
  await expect(page.getByRole("heading", { name: /came in$|^Profitable:|^Losing money:/i })).toBeVisible()
  await expect(page.getByText("Recurring each month").locator("..")).toContainText("$199")
  await expect(page.getByText("Revenue", { exact: true }).first().locator("..")).toContainText(total)
  await expect(page.getByRole("img", { name: /^Revenue by month\. [\d,]+ dollars in total/i })).toBeVisible()
  await expect(page.getByRole("list", { name: "Revenue by client" }).getByRole("listitem").first()).toContainText("Northline Realty")
  const months = page.getByRole("table", { name: /Revenue, cost and profit for each month/i })
  await expect(months.getByRole("row").last()).toContainText("Total")
  await expect(months.getByRole("row").last()).toContainText(total)
  const clients = page.getByRole("table", { name: /for each client/i })
  await expect(clients.getByRole("row").filter({ hasText: "Northline Realty" })).toContainText(total)
  await expectAccessible(page)
  await expectNoSidewaysScroll(page)

  // Enter costs and profit appears.
  const costs = page.getByRole("region", { name: "Your costs" })
  await costs.getByLabel("What a minute of talk time costs you (US dollars)").fill("0.10")
  await costs.getByLabel("Fixed costs each month (US dollars)").fill("20")
  await costs.getByRole("button", { name: "Save costs" }).click()
  await expect(page.getByText("Costs saved")).toBeVisible()
  // The answer is stated outright, with a pie of where each dollar went and profit by month as bars.
  await expect(page.getByRole("region", { name: /^(Profitable|Losing money):/i })).toContainText(/of revenue against \$[\d,.]+ of costs, a -?\d+% margin/)
  await expect(page.getByText("Margin", { exact: true }).first().locator("..")).toContainText("%")
  await expect(page.getByRole("img", { name: /^Profit by month\. A (profit|loss) of/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Where each dollar went" })).toBeVisible()
  await expectAccessible(page)
  await expect(clients.getByRole("row").filter({ hasText: "Northline Realty" })).toContainText("%")
  await costs.getByLabel("What a minute of talk time costs you (US dollars)").fill("0")
  await costs.getByLabel("Fixed costs each month (US dollars)").fill("0")
  await costs.getByRole("button", { name: "Save costs" }).click()
  await expect(page.getByText("Costs saved").last()).toBeVisible()
})

test("a client pays a custom amount for extra minutes and downloads a period's invoices", async ({ page }) => {
  await page.route("https://checkout.stripe.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Stripe checkout</h1>" }))
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Billing", exact: true }).click()

  // Invoices for a period, as one ZIP with a summary.
  const invoices = page.getByRole("region", { name: "Invoices" })
  await expect(invoices.getByRole("status")).toContainText("3 invoices")
  await invoices.getByRole("button", { name: "This month" }).click()
  await expect(invoices.getByRole("status")).toContainText("1 invoice")
  await invoices.getByRole("button", { name: "This year" }).click()
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 90_000 }), invoices.getByRole("button", { name: "Download these invoices (ZIP)" }).click()])
  expect(download.suggestedFilename()).toMatch(/^northline-invoices-\d{4}-01-01-to-\d{4}-\d{2}-\d{2}\.zip$/)
  const files = unzipSync(new Uint8Array(await readFile(await download.path())))
  const summary = strFromU8(files["invoices-summary.csv"])
  for (const number of ["DEMO-0001", "DEMO-0002", "DEMO-0003"]) expect(summary).toContain(number)
  expect(summary).toContain("199.00")

  // A custom amount: Standard is $199 for 300 minutes, so $37 buys 55 minutes.
  const usage = page.getByRole("region", { name: "Talk time this period" })
  await usage.getByRole("button", { name: "Add minutes", exact: true }).click()
  await expect(usage.getByRole("alert")).toContainText("Enter a whole number of dollars from $5 to $500.")
  await usage.getByLabel("Or enter another amount (US dollars)").fill("37")
  await expect(usage.getByText("$37 adds 55 minutes")).toBeVisible()
  await expectAccessible(page)
  await usage.getByRole("button", { name: "Add minutes", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Stripe checkout" })).toBeVisible()
  const { stripe } = await (await fetch("http://127.0.0.1:54398/__control/state")).json()
  expect(stripe.sessions.at(-1).form).toMatchObject({ mode: "payment", "line_items[0][price_data][unit_amount]": "3700" })
})

test("every conversation shows its Tavus conversation ID", async ({ page }) => {
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Conversations" }).click()
  await page.getByRole("button", { name: "This year" }).click()
  await expect(page.getByRole("table", { name: /Conversations/i }).getByText(/^demo-\d{5}$/).first()).toBeVisible()
  await page.getByRole("button", { name: /^Read the conversation/i }).first().click()
  await expect(page.getByRole("dialog").getByText(/^demo-\d{5}$/)).toBeVisible()
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Copy Tavus conversation ID demo-/i })).toBeVisible()
})

test("staff read, export and answer for a client from inside the client's file", async ({ page }) => {
  await signIn(page, OWNER)
  await page.goto("/admin/clients/northline")
  // The client's own analytics.
  await page.getByRole("tab", { name: "Analytics" }).click()
  await expect(page.getByRole("region", { name: "Talk time you have used" })).toBeVisible()
  await expect(page.getByRole("img", { name: /Talk time by avatar\. Maya/i })).toBeVisible()

  // Their conversations, with the same filter, transcript view and export bar the client has.
  await page.getByRole("tab", { name: "Conversations" }).click()
  await page.getByRole("button", { name: "This year" }).click()
  await page.getByRole("combobox", { name: "Avatar" }).selectOption({ label: "Maya" })
  await expect(page.getByRole("status").filter({ hasText: "with Maya" })).toBeVisible()
  await page.getByRole("button", { name: /^Read the conversation/i }).first().click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Summary" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Download PDF" })).toBeVisible()
  await page.keyboard.press("Escape")
  const boxes = page.getByRole("checkbox", { name: /^Select the conversation from/i })
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  const bar = page.getByRole("region", { name: "Export selected transcripts" })
  await expect(bar.getByRole("button", { name: "Email to me" })).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent("download"), bar.getByRole("button", { name: "Download ZIP" }).click()])
  expect(download.suggestedFilename()).toMatch(/^northline-transcripts-2-conversations-/)
  expect(Object.keys(unzipSync(new Uint8Array(await readFile(await download.path()))))).toHaveLength(2)
  await expectAccessible(page)
  await expectNoSidewaysScroll(page)

  // And their questions.
  await page.getByRole("tab", { name: "Questions" }).click()
  await expect(page.getByRole("tab", { name: /^Needs an answer/i })).toBeVisible()
  await expect(page.getByRole("tab", { name: /^Answered/i })).toBeVisible()
  // One page title only: the client's name.
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
})
