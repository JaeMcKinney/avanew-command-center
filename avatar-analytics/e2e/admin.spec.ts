import { expect, test } from "@playwright/test"
import { latestEmailLink, OWNER, signIn } from "./helpers"

test("the Owner adds a client, links its avatar by name and invites the client", async ({ page, browser }) => {
  await signIn(page, OWNER)
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: "Northline Realty" })).toBeVisible()

  // Step 1: details. The portal address is suggested from the name.
  await page.getByRole("link", { name: "New client" }).click()
  await page.getByLabel("Client name").fill("Cedar Law Group")
  await expect(page.getByLabel("Portal address")).toHaveValue("cedar-law-group")
  await page.getByLabel("Brand colour", { exact: true }).fill("#9A3412")
  await page.getByRole("button", { name: "Create client and continue" }).click()

  // Step 2: the search starts from the client's name and finds the PAL in Tavus.
  await expect(page.getByRole("heading", { name: "Link avatars" })).toBeFocused()
  await expect(page.getByLabel("Search your Tavus avatars")).toHaveValue("Cedar")
  await expect(page.getByText("1 avatar found for “Cedar”")).toBeVisible()
  await page.getByLabel(/Cedar Law Intake/).check()
  await page.getByRole("button", { name: "Link avatar" }).click()
  await expect(page.getByText("Linked 1 avatar to Cedar Law Group.")).toBeVisible()
  await expect(page.getByText("Already linked to Cedar Law Group")).toBeVisible()
  await page.getByRole("button", { name: "Continue" }).click()

  // Step 3: invite the client's main contact.
  await page.getByLabel("Their name").fill("Riley Cedar")
  await page.getByLabel("Their email").fill("riley@cedarlaw.test")
  await page.getByRole("button", { name: "Send invite" }).click()
  await expect(page.getByRole("heading", { name: "Cedar Law Group is set up" })).toBeVisible()
  await expect(page.getByText("Invite sent to riley@cedarlaw.test.")).toBeVisible()

  // The client page shows the avatar, waiting for its first call.
  await page.getByRole("link", { name: "Open Cedar Law Group" }).click()
  await expect(page.getByRole("heading", { name: "Cedar Law Intake" })).toBeVisible()
  await expect(page.getByText("Waiting for first call")).toBeVisible()
  await page.getByRole("tab", { name: "People" }).click()
  await expect(page.getByText("riley@cedarlaw.test")).toBeVisible()

  // Tavus was told to report this avatar's calls to the app, and nothing else.
  const tavus = await (await fetch("http://127.0.0.1:54398/__control/state")).json()
  const cedar = tavus.pals.find((p: { pal_name: string }) => p.pal_name === "Cedar Law Intake")
  expect(cedar.callback_url).toContain("/functions/v1/tavus-webhook/")
  expect(cedar._callback_secret).toMatch(/^[0-9a-f]{64}$/)

  // The invited person follows the emailed link, chooses a password, and lands in their own portal.
  const link = await latestEmailLink("riley@cedarlaw.test")
  const invited = await (await browser.newContext()).newPage()
  await invited.goto(link)
  await expect(invited.getByRole("heading", { name: "Choose a password" })).toBeVisible()
  await invited.getByLabel("New password").fill("short")
  await invited.getByLabel("Type it again").fill("short")
  await invited.getByRole("button", { name: "Save and continue" }).click()
  await expect(invited.getByRole("alert")).toHaveText("Use at least 10 characters.")
  await invited.getByLabel("New password").fill("A-long-enough-password-1")
  await invited.getByLabel("Type it again").fill("A-long-enough-password-1")
  await invited.getByRole("button", { name: "Save and continue" }).click()
  await invited.waitForURL("**/c/cedar-law-group")
  await expect(invited.getByRole("heading", { name: "Talk time you have used" })).toBeVisible()
  await expect(invited.getByRole("list", { name: "Your avatars" })).toContainText("Cedar Law Intake")
  await expect(invited).toHaveTitle("Cedar Law Group dashboard · Avalytics")
})

test("linking warns before taking over a webhook an avatar already uses", async ({ page }) => {
  await signIn(page, OWNER)
  // Give an unlinked PAL a webhook that points somewhere else.
  const state = await (await fetch("http://127.0.0.1:54398/__control/state")).json()
  const pals = state.pals.map((p: { pal_name: string }) => (p.pal_name === "Summit Fitness Coach" ? { ...p, callback_url: "https://hooks.summit.example/tavus" } : p))
  await fetch("http://127.0.0.1:54398/__control/reset", { method: "POST", body: JSON.stringify({ pals }) })

  await page.goto("/admin/clients/harbor-dental")
  await page.getByRole("button", { name: "Link avatars" }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Search your Tavus avatars").fill("sumit fitnes") // typos on purpose
  await dialog.getByLabel(/Summit Fitness Coach/).check()
  await dialog.getByRole("button", { name: "Link avatar" }).click()
  await expect(dialog.getByRole("alert")).toContainText("sends its call events to hooks.summit.example")
  await dialog.getByRole("button", { name: "Link and send calls here" }).click()
  await expect(page.getByText("Linked 1 avatar to Harbor Dental.")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("heading", { name: "Summit Fitness Coach" })).toBeVisible()

  // Unlinking hands the webhook back.
  await page.getByRole("button", { name: "Unlink Summit Fitness Coach" }).click()
  await page.getByRole("button", { name: "Unlink avatar" }).click()
  await expect(page.getByText("Avatar unlinked.")).toBeVisible()
  // The avatar stays on record, with what it did, and can be linked back.
  const history = page.getByRole("region", { name: "Previously Linked" })
  await expect(history.getByText("Summit Fitness Coach")).toBeVisible()
  await expect(history).toContainText(/Linked .* · unlinked /)
  await expect(history.getByRole("button", { name: "Link Summit Fitness Coach again" })).toBeVisible()
  const after = await (await fetch("http://127.0.0.1:54398/__control/state")).json()
  expect(after.pals.find((p: { pal_name: string }) => p.pal_name === "Summit Fitness Coach").callback_url).toBe("https://hooks.summit.example/tavus")
})

test("the Owner changes what a role may do, and it takes effect", async ({ page, browser }) => {
  await signIn(page, OWNER)
  await page.goto("/admin/team")
  const box = page.getByRole("checkbox", { name: "Client member: Copy embed codes" })
  await expect(box).not.toBeChecked()
  await expect(page.getByRole("checkbox", { name: "Owner: Manage the team" })).toBeDisabled()

  const member = await (await browser.newContext()).newPage()
  await signIn(member, "lee@northline.test")
  await expect(member.getByRole("link", { name: "Avatars" })).toHaveCount(0)

  await box.check()
  await expect(page.getByText("Permission updated.")).toBeVisible()
  await member.reload()
  await expect(member.getByRole("link", { name: "Avatars" })).toBeVisible()

  await box.uncheck()
  await expect(box).not.toBeChecked()
})
