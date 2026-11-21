import { expect, test } from "@playwright/test"
import { CLIENT_ADMIN, expectAccessible, expectNoSidewaysScroll, OWNER, signIn } from "./helpers"

const emails = async () => (await (await fetch("http://127.0.0.1:54398/__control/state")).json()).emails as Array<{ to: string[]; subject: string; text: string }>

test("a client opens a ticket, Divigner answers it, and an internal note stays with Divigner", async ({ page, browser }) => {
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Support" }).click()
  await expect(page.getByRole("heading", { name: "Support", level: 1 })).toBeVisible()
  await expect(page.getByText("Client Portal")).toBeVisible()

  // The sample tickets: one is waiting on the client, one is with Divigner, one is resolved.
  const table = page.getByRole("table", { name: /Support tickets/ })
  await expect(table.getByRole("row", { name: /Maya gave the wrong office hours/ })).toContainText("Waiting on You")
  await expect(table.getByRole("row", { name: /Avatar is not loading/ })).toContainText("With Divigner")
  await expect(table.getByRole("row", { name: /How do I add a teammate/ })).toContainText("Resolved")
  await expect(table).not.toContainText("Which package suits one avatar") // another client's
  await expectAccessible(page)

  await page.getByRole("button", { name: "New ticket" }).click()
  const dialog = page.getByRole("dialog", { name: "New Support Ticket" })
  await dialog.getByRole("button", { name: "Open ticket" }).click()
  await expect(dialog.getByText("Enter a short subject")).toBeVisible()
  await dialog.getByLabel("What Is This About?").selectOption("change_request")
  await dialog.getByLabel("Subject").fill("Please add our holiday hours")
  await dialog.getByLabel("Details").fill("We are closed December 24 to 26.")
  await dialog.getByRole("button", { name: "Open ticket" }).click()
  await expect(page.getByRole("heading", { name: /Ticket #\d+: Please add our holiday hours/ })).toBeVisible()
  const ticketUrl = page.url()
  const number = ticketUrl.split("/").pop()!
  await expect(page.getByLabel("Ticket details")).toContainText("With Divigner")
  await expect(page.getByLabel("Ticket details")).toContainText("Opened by Dana Reyes in the portal")

  // Divigner's side, in a separate browser session.
  const staffContext = await browser.newContext()
  const staff = await staffContext.newPage()
  await signIn(staff, OWNER)
  await staff.getByRole("link", { name: "Support" }).click()
  await expect(staff.getByRole("heading", { name: "Support Desk" })).toBeVisible()
  await expect(staff.getByRole("complementary").getByText("Divigner Admin")).toBeVisible()
  const queue = staff.getByRole("table", { name: /Support tickets/ })
  await expect(queue.getByRole("row", { name: /Avatar is not loading/ })).toContainText("Urgent")
  await expect(queue.getByRole("row", { name: /Please add our holiday hours/ })).toContainText("Northline Realty")
  await expectAccessible(staff)
  await queue.getByRole("link", { name: /Please add our holiday hours/ }).click()
  await expect(staff.getByRole("heading", { name: `Ticket #${number}: Please add our holiday hours` })).toBeVisible()

  await staff.getByLabel("Assigned To").selectOption({ label: "Jordan Owner" })
  await expect(staff.getByText("Assigned to Jordan Owner", { exact: false }).first()).toBeVisible()
  await staff.getByLabel(/Internal note\. Only Divigner staff/).check()
  await staff.getByLabel("Internal Note", { exact: true }).fill("Their site lists different dates. Check before answering.")
  await staff.getByRole("button", { name: "Add internal note" }).click()
  await expect(staff.getByText("Internal Note · Not Shown to the Client")).toBeVisible()
  await staff.getByLabel("Reply to Northline Realty").fill("Done. Maya now tells visitors you are closed December 24 to 26.")
  await staff.getByRole("button", { name: "Send reply" }).click()
  await expect(staff.getByLabel("Ticket details")).toContainText("Waiting on Client")
  await expectAccessible(staff)
  await staffContext.close()

  // Back with the client: the reply is there, the internal note is not.
  await page.reload()
  await expect(page.getByText("Done. Maya now tells visitors you are closed December 24 to 26.")).toBeVisible()
  await expect(page.getByText("Their site lists different dates")).toHaveCount(0)
  await expect(page.getByText("Internal Note")).toHaveCount(0)
  await expect(page.getByLabel("Ticket details")).toContainText("Waiting on You")
  await expect(page.getByLabel("Ticket details")).toContainText("Assigned to Jordan Owner at Divigner")
  await expectAccessible(page)
  await page.getByRole("button", { name: "Mark as resolved" }).click()
  await expect(page.getByLabel("Ticket details")).toContainText("Resolved")
  await expect(page.getByText("Marked as resolved")).toBeVisible()

  // Each side was emailed about the other's reply, and nobody was emailed the note.
  await expect.poll(async () => (await emails()).filter((e) => e.subject === `[Ticket #${number}] Please add our holiday hours`).length).toBeGreaterThanOrEqual(2)
  const sent = (await emails()).filter((e) => e.subject === `[Ticket #${number}] Please add our holiday hours`)
  expect(sent.some((e) => e.to.includes(OWNER) && e.text.includes("We are closed December 24 to 26."))).toBe(true)
  expect(sent.some((e) => e.to.includes(CLIENT_ADMIN) && e.text.includes("Done. Maya now tells visitors"))).toBe(true)
  expect(sent.some((e) => e.text.includes("Their site lists different dates"))).toBe(false)
})

test("every conversation shows its ID, and a problem reported from one carries that ID", async ({ page }) => {
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Conversations" }).click()
  const table = page.getByRole("table", { name: /Conversations/ })
  await expect(table.getByRole("columnheader", { name: "Conversation ID" })).toBeVisible()
  const firstRow = table.getByRole("row").filter({ has: page.getByRole("button", { name: /Read the conversation/ }) }).first()
  const conversationId = (await firstRow.locator("code").innerText()).trim()
  expect(conversationId.length).toBeGreaterThan(3)

  await firstRow.getByRole("button", { name: /Read the conversation/ }).click()
  const transcript = page.getByRole("dialog", { name: /Conversation With/ })
  await expect(transcript.getByText(conversationId)).toBeVisible()
  await transcript.getByRole("button", { name: "Report a problem" }).click()
  const dialog = page.getByRole("dialog", { name: "New Support Ticket" })
  await expect(dialog.getByText(conversationId)).toBeVisible()
  await dialog.getByLabel("Details").fill("The avatar gave the wrong answer about tours.")
  await dialog.getByRole("button", { name: "Open ticket" }).click()
  await expect(page.getByRole("heading", { name: /Ticket #\d+: A problem with a conversation/ })).toBeVisible()
  await expect(page.getByLabel("Ticket details").getByText(conversationId)).toBeVisible()
})

test("a ticket is not shown to another client, and staff see a client's tickets in the client file", async ({ page, browser }) => {
  await signIn(page, "pat@harbor.test")
  await page.goto("/c/harbor-dental/support/1001")
  await expect(page.getByText("This Ticket Is Not Available")).toBeVisible()
  await page.goto("/c/harbor-dental/support")
  await expect(page.getByRole("table", { name: /Support tickets/ })).toContainText("Which package suits one avatar")
  await expect(page.getByRole("table", { name: /Support tickets/ })).not.toContainText("Maya gave the wrong office hours")

  const staff = await (await browser.newContext()).newPage()
  await signIn(staff, OWNER)
  await staff.goto("/admin/clients/harbor-dental")
  await staff.getByRole("tab", { name: "Support" }).click()
  const table = staff.getByRole("table", { name: /Support tickets/ })
  await expect(table).toContainText("Which package suits one avatar")
  await expect(table).not.toContainText("Maya gave the wrong office hours")
  await expectNoSidewaysScroll(staff)
})
