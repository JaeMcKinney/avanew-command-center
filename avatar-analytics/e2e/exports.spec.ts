import { readFile } from "node:fs/promises"
import { expect, test, type Page } from "@playwright/test"
import { unzipSync } from "fflate"
import { PDFDocument } from "pdf-lib"
import { CLIENT_ADMIN, expectAccessible, expectNoSidewaysScroll, signIn } from "./helpers"

const MOCK = "http://127.0.0.1:54398"

async function openConversations(page: Page) {
  await signIn(page, CLIENT_ADMIN)
  await page.getByRole("link", { name: "Conversations" }).click()
  await expect(page.getByRole("heading", { name: "Conversations", level: 1 })).toBeVisible()
  await page.getByRole("button", { name: "This year" }).click()
  await expect(page.getByRole("checkbox", { name: /^Select the conversation from/ }).first()).toBeVisible()
}
const bar = (page: Page) => page.getByRole("region", { name: "Export selected transcripts" })

test("a client ticks several conversations and downloads them as one ZIP of PDFs", async ({ page }) => {
  await openConversations(page)
  await expect(bar(page)).toHaveCount(0)
  const boxes = page.getByRole("checkbox", { name: /^Select the conversation from/ })

  // One on its own is a PDF.
  await boxes.nth(0).check()
  await expect(bar(page).getByRole("status")).toContainText("1 transcript selected. It downloads as a PDF.")
  await expect(bar(page).getByRole("button", { name: "Download PDF" })).toBeVisible()

  // Several become a ZIP.
  await boxes.nth(1).check()
  await boxes.nth(2).check()
  await expect(bar(page).getByRole("status")).toContainText("3 transcripts selected")
  await expectAccessible(page)
  await expectNoSidewaysScroll(page)
  const [download] = await Promise.all([page.waitForEvent("download"), bar(page).getByRole("button", { name: "Download ZIP" }).click()])
  expect(download.suggestedFilename()).toMatch(/^northline-transcripts-3-conversations-\d{4}-\d{2}-\d{2}\.zip$/)
  const files = unzipSync(new Uint8Array(await readFile(await download.path())))
  const names = Object.keys(files)
  expect(names).toHaveLength(3)
  for (const name of names) {
    expect(name).toMatch(/^(maya|theo|ivy)-\d{4}-\d{2}-\d{2}-\d{4}(-\d+)?\.pdf$/)
    const pdf = await PDFDocument.load(files[name])
    expect(pdf.getTitle()).toMatch(/^Conversation with (Maya|Theo|Ivy)$/)
  }
  await expect(page.getByText("Downloaded the ZIP of 3 transcripts")).toBeVisible()

  // The page's own checkbox ticks the whole page, and clearing empties the selection.
  await page.getByRole("checkbox", { name: "Select every transcript on this page" }).check()
  const onPage = await boxes.count()
  await expect(bar(page).getByRole("status")).toContainText(`${onPage} transcripts selected`)
  await bar(page).getByRole("button", { name: "Clear selection" }).click()
  await expect(bar(page)).toHaveCount(0)
})

test("a client selects every transcript for one avatar, then copies a private link and emails it to themselves", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await fetch(`${MOCK}/__control/reset`, { method: "POST" })
  await openConversations(page)
  await page.getByRole("combobox", { name: "Avatar" }).selectOption({ label: "Ivy" })
  await page.getByRole("button", { name: "Select all transcripts with Ivy in this period" }).click()
  const status = bar(page).getByRole("status")
  await expect(status).toContainText(/\d+ transcripts selected/)
  const selected = Number(/(\d+) transcripts selected/.exec(await status.innerText())![1])
  expect(selected).toBeGreaterThan(await page.getByRole("checkbox", { name: /^Select the conversation from/ }).count() - 1)

  await bar(page).getByRole("button", { name: "Copy private link" }).click()
  await expect(page.getByText("Private link copied. It works for 7 days.")).toBeVisible()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  const file = await fetch(url)
  expect(file.status).toBe(200)
  expect(file.headers.get("content-disposition")).toMatch(/northline-transcripts-\d+-conversations/)
  expect(Object.keys(unzipSync(new Uint8Array(await file.arrayBuffer())))).toHaveLength(selected)

  await bar(page).getByRole("button", { name: "Email to me" }).click()
  await expect(page.getByText("Sent to dana@northline.test")).toBeVisible()
  const { emails } = await (await fetch(`${MOCK}/__control/state`)).json()
  expect(emails).toHaveLength(1)
  expect(emails[0].to).toEqual(["dana@northline.test"])
  // The same file is reused: the emailed link opens the same export.
  expect(emails[0].text).toContain("/storage/v1/object/sign/exports/")
})

test("a client saves an export to Dropbox and to Google Drive, and shares it from a device with a share sheet", async ({ page }) => {
  // Stand-ins for the three outside services, recording what the app hands them.
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown[] }
    w.__shared = []
    Object.assign(navigator, {
      canShare: (data: { files?: File[] }) => Boolean(data.files?.length),
      share: async (data: { files: File[]; title: string }) => { w.__shared.push({ title: data.title, name: data.files[0].name, type: data.files[0].type, size: data.files[0].size }) },
    })
  })
  await page.route("https://www.dropbox.com/static/api/2/dropins.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.__dropbox = []; window.Dropbox = { save: (url, filename, options) => { window.__dropbox.push({ url, filename, key: document.getElementById("dropboxjs").getAttribute("data-app-key") }); options.success() } }`,
  }))
  await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.__scopes = []; window.google = { accounts: { oauth2: { initTokenClient: (config) => ({ requestAccessToken: () => { window.__scopes.push(config.scope); config.callback({ access_token: "test-token" }) } }) } } }`,
  }))
  const uploads: Array<{ auth: string | undefined; body: string }> = []
  await page.route("https://www.googleapis.com/upload/drive/v3/files**", async (route) => {
    uploads.push({ auth: route.request().headers().authorization, body: route.request().postDataBuffer()?.toString("latin1") ?? "" })
    await route.fulfill({ json: { id: "drive-file-1" } })
  })

  await openConversations(page)
  const boxes = page.getByRole("checkbox", { name: /^Select the conversation from/ })
  await boxes.nth(0).check()
  await boxes.nth(1).check()

  await bar(page).getByRole("button", { name: "Share", exact: true }).click()
  await expect(page.getByText("Shared", { exact: true })).toBeVisible()
  const shared = await page.evaluate(() => (window as unknown as { __shared: Array<{ title: string; name: string; type: string; size: number }> }).__shared)
  expect(shared).toHaveLength(1)
  expect(shared[0]).toMatchObject({ title: "Transcripts from Northline Realty", type: "application/zip" })
  expect(shared[0].name).toMatch(/^northline-transcripts-2-conversations-.*\.zip$/)

  await bar(page).getByRole("button", { name: "Save to Dropbox" }).click()
  await expect(page.getByText("Saved to Dropbox")).toBeVisible()
  const dropbox = await page.evaluate(() => (window as unknown as { __dropbox: Array<{ url: string; filename: string; key: string }> }).__dropbox)
  expect(dropbox).toHaveLength(1)
  expect(dropbox[0]).toMatchObject({ filename: shared[0].name, key: "test-dropbox-key" })
  expect((await fetch(dropbox[0].url)).status).toBe(200)

  await bar(page).getByRole("button", { name: "Save to Google Drive" }).click()
  await expect(page.getByText("Saved to Google Drive")).toBeVisible()
  // The app asks only for permission to add files, never to read the Drive.
  expect(await page.evaluate(() => (window as unknown as { __scopes: string[] }).__scopes)).toEqual(["https://www.googleapis.com/auth/drive.file"])
  expect(uploads).toHaveLength(1)
  expect(uploads[0].auth).toBe("Bearer test-token")
  expect(uploads[0].body).toContain(shared[0].name)
})
