import { expect, test } from "@playwright/test"
import { expectAccessible, expectNoSidewaysScroll, OWNER, signIn } from "./helpers"

const AGENCY_OWNER = "ava@avanew.test"
const AGENCY_CLIENT = "sam@lakeside.test"

test("Divigner sees an agency's totals, gives it a look, and never sees its clients", async ({ page }) => {
  await signIn(page, OWNER)
  await page.getByRole("link", { name: "Agencies" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Agencies" })).toBeVisible()

  // Totals for the agency: two clients, two avatars, and minutes. No client names.
  const row = page.getByRole("row", { name: /Avanew/ })
  await expect(row).toContainText("Active")
  await expect(row.getByRole("cell").nth(3)).toHaveText("2")
  await expect(page.getByText(/Lakeside|Hillcrest|Dr\. Lake|Poppy/)).toHaveCount(0)
  await expectAccessible(page)

  // The agency's file: its look, taken from Avanew's, with its logos.
  await row.getByRole("link", { name: "Avanew" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Avanew" })).toBeVisible()
  await expect(page.getByText(/Lakeside|Hillcrest|Dr\. Lake|Poppy/)).toHaveCount(0)
  await page.getByRole("tab", { name: "Brand" }).click()
  await page.getByRole("button", { name: "Use Avanew's look" }).click()
  await expect(page.getByRole("img", { name: /Logo for Dark Backgrounds/ })).toBeVisible()
  await expectAccessible(page)
  await expectNoSidewaysScroll(page)

  // A logo can also be given as a web address, which takes the place of the file.
  const address = page.getByLabel("Or a Web Address").nth(2)
  await address.fill("example.test/icon.png")
  await expect(page.getByText("The address must start with https://")).toBeVisible()
  await expect(page.getByRole("button", { name: "Save brand" })).toBeDisabled()
  await address.fill("https://example.test/icon.png")
  await expect(page.getByRole("img", { name: /Tab Icon/ })).toHaveAttribute("src", "https://example.test/icon.png")
  // Choosing a file again takes the place of the address.
  await page.getByRole("button", { name: "Use Avanew's look" }).click()
  await expect(page.getByRole("img", { name: /Tab Icon/ })).toHaveAttribute("src", /^blob:/)

  // A look that cannot be read is refused before it is saved.
  const text = page.getByRole("group", { name: "Light Version" }).getByLabel("Text", { exact: true })
  await text.fill("#f8fafd")
  await expect(page.getByRole("alert")).toContainText("Text is too close to Page or Panel")
  await expect(page.getByRole("button", { name: "Save brand" })).toBeDisabled()
  await text.fill("#0b1f3a")
  await page.getByRole("button", { name: "Save brand" }).click()
  await expect(page.getByText("Brand saved.")).toBeVisible()

  // Divigner keeps its own name and look.
  await expect(page.getByRole("complementary").getByText("Divigner Admin")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.brand ?? "none")).toBe("none")

  await page.getByRole("tab", { name: "People" }).click()
  await expect(page.getByRole("row", { name: /Ava Lindqvist/ })).toContainText("Owner")

  // Its clients are nowhere on Divigner's side.
  await page.goto("/admin/clients")
  await expect(page.getByRole("link", { name: "Northline Realty" })).toBeVisible()
  await expect(page.getByText(/Lakeside|Hillcrest/)).toHaveCount(0)
  await page.goto("/c/lakeside")
  await expect(page.getByText("Lakeside Family Practice")).toHaveCount(0)
})

test("an agency's team works under its own name and look, with its own clients", async ({ page, browser }) => {
  // The sign-in page wears the agency's look when opened for that agency.
  await page.goto("/login?agency=avanew")
  await expect(page.getByRole("img", { name: "Avanew" })).toBeVisible()
  await expect(page).toHaveTitle("Sign In · Avalytics by Avanew")
  await expectAccessible(page)

  await page.getByLabel("Email").fill(AGENCY_OWNER)
  await page.getByLabel("Password").fill("Correct-horse-9-battery")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible()
  await expect(page.getByRole("complementary").getByText("Avanew Admin")).toBeVisible()
  await expect(page).toHaveTitle("Overview · Avalytics by Avanew")
  expect(await page.evaluate(() => document.documentElement.dataset.brand)).toBe("agency")

  // The same pages Divigner's staff have, for the agency's clients only. No Agencies page.
  const nav = page.getByRole("complementary").getByRole("navigation", { name: "Main" })
  await expect(nav.getByRole("link")).toHaveText(["Overview", "Clients", "Support", "Avatars", "Finance", "Packages", "Team", "Brand", "Activity"])
  await expect(page.getByRole("link", { name: "Lakeside Family Practice" })).toBeVisible()
  await expect(page.getByText("Northline")).toHaveCount(0)
  await expectAccessible(page)
  await page.goto("/admin/agencies")
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0)

  await page.goto("/admin/clients/northline")
  await expect(page.getByText("Northline Realty")).toHaveCount(0)
  await page.goto("/admin/team")
  await expect(page.getByRole("heading", { level: 2, name: "Avanew Users" })).toBeVisible()
  await expect(page.getByText("Jordan Owner")).toHaveCount(0)
  // Roles are shared with everyone, so an agency reads them and Divigner sets them.
  await expect(page.getByRole("checkbox", { name: "Admin: Manage clients" })).toBeDisabled()

  // The agency changes its own look: gentle motion off.
  await page.getByRole("link", { name: "Brand" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Brand" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe("on")
  await page.getByRole("checkbox", { name: "Gentle motion" }).uncheck()
  await page.getByRole("button", { name: "Save brand" }).click()
  await expect(page.getByText("Brand saved.")).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.motion)).toBe("off")
  await expectAccessible(page)
  await page.getByRole("checkbox", { name: "Gentle motion" }).check()
  await page.getByRole("button", { name: "Save brand" }).click()
  await expect(page.getByText("Brand saved.").first()).toBeVisible()

  // The agency's client gets the agency's name too, and never Divigner's.
  const context = await browser.newContext()
  const client = await context.newPage()
  await signIn(client, AGENCY_CLIENT)
  await expect(client.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(client.getByRole("contentinfo")).toContainText("Avalytics by Avanew")
  await expect(client.getByText("Divigner")).toHaveCount(0)
  expect(await client.evaluate(() => document.documentElement.dataset.brand)).toBe("agency")
  await expectAccessible(client)
  await context.close()
})

test("the dark version of an agency's look is readable too", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" })
  const page = await context.newPage()
  await signIn(page, AGENCY_OWNER)
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible()
  await expectAccessible(page)
  await page.goto("/admin/brand")
  await expect(page.getByRole("heading", { level: 1, name: "Brand" })).toBeVisible()
  await expectAccessible(page)
  await context.close()
})
