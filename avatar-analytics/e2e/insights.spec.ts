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
  await expect(dialog.getByRole("heading", { name: "Questions the visitor asked" })).toBeVisible()
  await expect(dialog.getByText("Do you have two-bedroom homes available in January?")).toBeVisible()
  await expect(dialog.getByText("Answered", { exact: true }).first()).toBeVisible()
  await expectAccessible(page)

  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download PDF" }).click()])
  expect(download.suggestedFilename()).toMatch(/^northline-[a-z]+-\d{4}-\d{2}-\d{2}-transcript\.pdf$/)
  const pdf = await PDFDocument.load(await readFile(await download.path()))
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1)
  expect(pdf.getTitle()).toMatch(/^Conversation with (Maya|Theo|Ivy)$/)
  expect(pdf.getAuthor()).toBe("Divigner")
})

test("a client downloads every transcript for one avatar in a period as a single PDF", async ({ page }) => {
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Conversations" }).click()
  await expect(page.getByRole("heading", { name: "Conversations", level: 1 })).toBeVisible()
  await page.getByRole("combobox", { name: "Avatar" }).selectOption({ label: "Theo" })
  await page.getByRole("button", { name: "This year" }).click()
  await expect(page.getByRole("status").filter({ hasText: "with Theo" })).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download transcripts (PDF)" }).click()])
  expect(download.suggestedFilename()).toMatch(/^northline-theo-transcripts-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.pdf$/)
  const pdf = await PDFDocument.load(await readFile(await download.path()))
  const said = /Downloaded (\d+) transcripts?/.exec(await page.getByText(/Downloaded \d+ transcript/).innerText())!
  // Every conversation starts on its own page.
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(Number(said[1]))
  expect(Number(said[1])).toBeGreaterThan(1)
  expect(pdf.getTitle()).toBe("Conversation transcripts for Northline Realty")
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
