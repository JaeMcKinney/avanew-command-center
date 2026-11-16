import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { PDFDocument } from "pdf-lib"
import { CLIENT_ADMIN, CLIENT_MEMBER, expectAccessible, expectNoSidewaysScroll, signIn } from "./helpers"

const MOCK = "http://127.0.0.1:54398"

test("a client reads the summary and questions for a call and downloads it as a branded PDF", async ({ page }) => {
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Conversations" }).click()
  await page.getByRole("button", { name: "This year" }).click()
  await page.getByRole("button", { name: /^Read the conversation/ }).first().click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Summary" })).toBeVisible()
  await expect(dialog.getByText(/The visitor asked about/)).toBeVisible()
  // The questions are split into what the avatar answered and what it did not, with a count of each.
  await expect(dialog.getByRole("status").filter({ hasText: "The visitor asked" })).toContainText(/The visitor asked \d+ questions?\. The avatar answered \d+, partly answered \d+ and did not answer \d+\./)
  const answered = dialog.getByRole("region", { name: /^Questions answered \(\d+\)$/ })
  const unanswered = dialog.getByRole("region", { name: /^Questions not answered \(\d+\)$/ })
  await expect(answered.getByText("Do you have two-bedroom homes available in January?")).toBeVisible()
  await expect(unanswered.getByText("Do you have two-bedroom homes available in January?")).toHaveCount(0)
  const partly = dialog.getByRole("region", { name: /^Questions partly answered \(\d+\)$/ })
  await expect(partly).toBeVisible()
  // Each section holds only its own kind.
  await expect(answered.getByText(/Partly answered|Not answered/)).toHaveCount(0)
  await expect(partly.getByText("Not answered", { exact: true })).toHaveCount(0)
  await expect(unanswered.getByText("Partly answered", { exact: true })).toHaveCount(0)
  await expectAccessible(page)

  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download PDF" }).click()])
  expect(download.suggestedFilename()).toMatch(/^northline-[a-z]+-\d{4}-\d{2}-\d{2}-\d{4}-transcript\.pdf$/)
  const pdf = await PDFDocument.load(await readFile(await download.path()))
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1)
  expect(pdf.getTitle()).toMatch(/^Conversation with (Maya|Theo|Ivy)$/)
  expect(pdf.getAuthor()).toBe("Divigner")
})

test("a client answers a question once and it is added to every avatar that was asked", async ({ page }) => {
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Questions" }).click()
  await expect(page.getByRole("heading", { name: "Questions", level: 1 })).toBeVisible()
  const card = page.getByRole("listitem").filter({ hasText: "Is there a pet deposit?" })
  await expect(card).toContainText(/Asked \d+ times/)
  await expectAccessible(page)
  await expectNoSidewaysScroll(page)

  // An empty answer is refused, in words.
  await card.getByRole("button", { name: "Save answer" }).click()
  await expect(card.getByRole("alert")).toHaveText("Write an answer first.")

  await card.getByLabel("Your answer").fill("Yes. The pet deposit is $300, plus $35 a month in pet rent.")
  await card.getByRole("button", { name: "Save answer" }).click()
  await expect(page.getByText("Answer saved and added to the avatar's knowledge")).toBeVisible()
  await expect(page.getByRole("tab", { name: /^Answered \(1\)/ })).toBeVisible()
  await page.getByRole("tab", { name: /^Answered/ }).click()
  const answered = page.getByRole("listitem").filter({ hasText: "Is there a pet deposit?" })
  await expect(answered).toContainText("$300, plus $35 a month")
  await expect(answered).toContainText("Added to avatar knowledge")
  // Check the page once the confirmation message has gone (it fades, which confuses the contrast check).
  await expect(page.getByText("Answer saved and added to the avatar's knowledge")).toHaveCount(0, { timeout: 10_000 })
  await expectAccessible(page)

  // Tavus was given a knowledge page for each avatar, and that page carries the answer.
  const tavus = await (await fetch(`${MOCK}/__control/state`)).json()
  expect(tavus.documents.length).toBeGreaterThanOrEqual(1)
  expect(await (await fetch(tavus.documents[0].document_url)).text()).toContain("The pet deposit is $300")

  // Dismissing a different question takes it off the list.
  await page.getByRole("tab", { name: /^Needs an answer/ }).click()
  const other = page.getByRole("listitem").filter({ hasText: "Can I book a tour for Saturday?" })
  await other.getByRole("button", { name: "Dismiss" }).click()
  await expect(page.getByText("Question dismissed")).toBeVisible()
  await expect(page.getByRole("tab", { name: /^Dismissed \(1\)/ })).toBeVisible()
})

test("a client member can read questions but not answer them", async ({ page }) => {
  await signIn(page, CLIENT_MEMBER)
  await page.getByRole("link", { name: "Questions" }).click()
  await expect(page.getByRole("heading", { name: "Questions", level: 1 })).toBeVisible()
  await expect(page.getByRole("tab", { name: /^Needs an answer/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "Save answer" })).toHaveCount(0)
  await expect(page.getByLabel("Your answer")).toHaveCount(0)
})
