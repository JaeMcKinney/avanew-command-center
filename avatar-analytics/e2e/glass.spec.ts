import { execFileSync } from "node:child_process"
import { createHmac } from "node:crypto"
import { expect, test } from "@playwright/test"
import { expectAccessible, expectNoSidewaysScroll, OWNER, signIn } from "./helpers"

const sql = (statement: string) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_avatar-analytics", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq", "-c", statement]).toString().trim()

// A stand-in key that only the mock Glass accepts.
const TEST_KEY = "sk-gla-test-harbor-000000007788"

/** Posts a question to the avatar's tool address the way Tavus does, signed with the avatar's secret. */
async function avatarAsks(conversationId: string, question: string) {
  const [token, secret] = sql(`select s.webhook_token || '|' || s.callback_secret from public.avatar_secrets s join public.avatars a on a.id = s.avatar_id
    join public.clients c on c.id = a.client_id where c.slug = 'harbor-dental' and a.unlinked_at is null limit 1`).split("|")
  const body = JSON.stringify({ name: "consult_clinical_evidence", arguments: JSON.stringify({ question }), tool_call_id: `call_${Date.now()}`, conversation_id: conversationId, inference_id: "inf_1", turn_idx: 2 })
  return fetch(`http://127.0.0.1:54399/functions/v1/glass-consult/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tavus-Signature": createHmac("sha256", secret).update(body).digest("hex") },
    body,
  })
}

// Leave the sample data as the other tests expect it: Harbor Dental without Glass.
test.afterAll(() => {
  sql(`delete from public.glass_calls where client_id = (select id from public.clients where slug = 'harbor-dental');
       delete from public.client_glass where client_id = (select id from public.clients where slug = 'harbor-dental');
       update public.settings set value = '0' where key like 'glass.%';`)
})

test("Divigner turns Glass on, the client connects their account, and avatar questions are counted", async ({ page, browser }) => {
  // The client does not see Glass until Divigner turns it on.
  const clientContext = await browser.newContext()
  const client = await clientContext.newPage()
  await signIn(client, "pat@harbor.test")
  await expect(client.getByRole("link", { name: "Glass Health", exact: true })).toHaveCount(0)
  await expect(client.getByRole("heading", { name: "Glass Health Your Avatars Have Used" })).toHaveCount(0)

  await signIn(page, OWNER)
  await page.goto("/admin/clients/harbor-dental")
  await page.getByRole("tab", { name: "Glass Health" }).click()
  await expect(page.getByRole("heading", { name: "Glass Health Is Not Turned On" })).toBeVisible()
  await page.getByRole("button", { name: "Turn on Glass Health" }).click()
  await expect(page.getByText("Glass Health is turned on.")).toBeVisible()
  await expect(page.getByText("Waiting for a key")).toBeVisible()
  await expectAccessible(page)

  // The client enters their own key. It is checked with Glass and never shown again.
  await client.reload()
  await client.getByRole("link", { name: "Glass Health", exact: true }).click()
  await expect(client.getByRole("heading", { name: "Glass Health", level: 1 })).toBeVisible()
  await expect(client.getByText("Your avatars cannot look anything up until a key is entered.")).toBeVisible()
  await client.getByLabel("Glass Health Key").fill("sk-gla-test-harbor-0000000invalid")
  await client.getByRole("button", { name: "Save key" }).click()
  await expect(client.getByText("Key not accepted")).toBeVisible()
  await client.getByLabel("Replace the Key").fill(TEST_KEY)
  await client.getByRole("button", { name: "Replace key" }).click()
  await expect(client.getByText("Key saved. Glass Health accepted it.")).toBeVisible()
  await expect(client.getByText("Connected", { exact: true })).toBeVisible()
  await expect(client.getByText("Ends in 7788")).toBeVisible()
  await expect(client.getByLabel("Replace the Key")).toHaveValue("")
  expect(await client.content()).not.toContain(TEST_KEY)
  await expect(client.getByRole("button", { name: "Turn off Glass Health" })).toHaveCount(0)
  await expect(client.getByText("0 questions")).toBeVisible()

  // An avatar asks two questions during one of the client's calls.
  sql("update public.settings set value = '200' where key = 'glass.input_cents_per_million'; update public.settings set value = '1000' where key = 'glass.output_cents_per_million';")
  const conversationId = sql(`select conversation_id from public.conversations where client_id = (select id from public.clients where slug = 'harbor-dental')
    and usage_date >= date_trunc('month', now())::date order by started_at desc limit 1`)
  for (const question of ["Is amoxicillin still first-line before dental work?", "And for a penicillin allergy?"]) {
    const res = await avatarAsks(conversationId, question)
    expect(res.status).toBe(200)
    expect((await res.json()).answer).toContain("first-line choices")
  }

  // The usage shows on the Glass page, beside talk time.
  await client.reload()
  await expect(client.getByText("2 questions", { exact: true })).toBeVisible()
  const stats = client.getByRole("region", { name: "Usage" })
  await expect(stats.getByText("24,000 in · 360 out")).toBeVisible()
  await expect(stats.getByText("$0.05").first()).toBeVisible()
  const byAvatar = client.getByRole("table", { name: /Talk time and Glass Health use by avatar/ })
  await expect(byAvatar.getByRole("row", { name: /Zara/ })).toContainText("24,360")
  await expect(client.getByText("Last Used by an Avatar")).toBeVisible()
  await expectAccessible(client)
  await expectNoSidewaysScroll(client)

  // And on the dashboard and against the conversation itself.
  await client.getByRole("link", { name: "Dashboard" }).click()
  const summary = client.getByRole("region", { name: "Glass Health Your Avatars Have Used" })
  await expect(summary.getByText("24.4K tokens · about $0.05").first()).toBeVisible()
  await summary.getByRole("link", { name: "See Glass Health usage" }).click()
  await expect(client).toHaveURL(/\/c\/harbor-dental\/glass$/)
  await client.getByRole("link", { name: "Conversations" }).click()
  const row = client.getByRole("table", { name: /Conversations/ }).getByRole("row").filter({ hasText: conversationId })
  await expect(client.getByRole("columnheader", { name: "Glass Questions" })).toBeVisible()
  await expect(row).toContainText("24.4K tokens")

  // Divigner sees the same in the client's file, and cannot see the key either.
  await page.reload()
  await page.getByRole("tab", { name: "Glass Health" }).click()
  await expect(page.getByText("Ends in 7788")).toBeVisible()
  await expect(page.getByText("2 questions", { exact: true })).toBeVisible()
  expect(await page.content()).not.toContain(TEST_KEY)

  // A member of the client's team sees the usage but cannot change the key.
  sql(`update public.profiles set role_id = (select id from public.roles where key = 'client_member') where email = 'pat@harbor.test'`)
  await client.goto("/c/harbor-dental/glass")
  await expect(client.getByText("Only an account admin can enter or change the key.")).toBeVisible()
  await expect(client.getByLabel("Replace the Key")).toHaveCount(0)
  sql(`update public.profiles set role_id = (select id from public.roles where key = 'client_admin') where email = 'pat@harbor.test'`)

  // Removing the key stops lookups and keeps the history.
  await client.reload()
  await client.getByRole("button", { name: "Remove key" }).click()
  await client.getByRole("alertdialog").getByRole("button", { name: "Remove key" }).click()
  await expect(client.getByText("Key removed.")).toBeVisible()
  await expect(client.getByText("Waiting for a key")).toBeVisible()
  expect((await avatarAsks(conversationId, "One more?")).status).toBe(422)
  await expect(client.getByText("2 questions", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Turn off Glass Health" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Turn off" }).click()
  await expect(page.getByRole("heading", { name: "Glass Health Is Not Turned On" })).toBeVisible()
  await clientContext.close()
})
