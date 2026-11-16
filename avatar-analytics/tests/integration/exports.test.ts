// Export files: who may add them, private links, emailing a link to yourself, and clean-up.

import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { beforeAll, describe, expect, it } from "vitest"
import { admin, callFunction, createClientRow, createUser, mockTavusState, resetDatabase, resetMockTavus, type TestUser } from "./helpers"

let owner: TestUser, analyst: TestUser, dana: TestUser, lee: TestUser, pat: TestUser
let northline: { id: string }, harbor: { id: string }
const PDF = new Blob(["%PDF-1.7 test"], { type: "application/pdf" })
const pathFor = (clientId: string, user: TestUser, name = "northline-transcripts.zip") => `${clientId}/${user.id}/${randomUUID()}/${name}`
const upload = (user: TestUser, path: string, body: Blob = new Blob(["PK test"], { type: "application/zip" })) =>
  user.client.storage.from("exports").upload(path, body, { contentType: body.type })

beforeAll(async () => {
  resetDatabase()
  await admin.storage.emptyBucket("exports")
  await resetMockTavus()
  owner = await createUser({ email: "owner@divigner.test", role: "owner" })
  northline = await createClientRow(owner, "Northline Realty", "northline")
  harbor = await createClientRow(owner, "Harbor Dental", "harbor-dental")
  analyst = await createUser({ email: "analyst@divigner.test", role: "analyst" })
  dana = await createUser({ email: "dana@northline.test", role: "client_admin", clientId: northline.id })
  lee = await createUser({ email: "lee@northline.test", role: "client_member", clientId: northline.id })
  pat = await createUser({ email: "pat@harbor.test", role: "client_admin", clientId: harbor.id })
})

describe("adding export files", () => {
  it("lets a person add a file under their own folder for their own client", async () => {
    expect((await upload(dana, pathFor(northline.id, dana))).error).toBeNull()
    expect((await upload(lee, pathFor(northline.id, lee, "one.pdf"), PDF)).error).toBeNull()
  })

  it("refuses another client's folder, another person's folder, and people who may not read transcripts", async () => {
    expect((await upload(pat, pathFor(northline.id, pat))).error).not.toBeNull()
    expect((await upload(dana, pathFor(northline.id, lee))).error).not.toBeNull()
    expect((await upload(analyst, pathFor(northline.id, analyst))).error).not.toBeNull()
    expect((await upload(dana, `not-a-client/${dana.id}/${randomUUID()}/x.zip`)).error).not.toBeNull()
  })

  it("only takes PDF and ZIP files", async () => {
    const res = await upload(dana, pathFor(northline.id, dana, "page.html"), new Blob(["<html>"], { type: "text/html" }))
    expect(res.error).not.toBeNull()
  })

  it("cannot be listed or read directly, even by the person who added it", async () => {
    const path = pathFor(northline.id, dana)
    await upload(dana, path)
    expect((await dana.client.storage.from("exports").download(path)).error).not.toBeNull()
    expect((await dana.client.storage.from("exports").list(`${northline.id}/${dana.id}`)).data ?? []).toEqual([])
    expect((await pat.client.storage.from("exports").download(path)).error).not.toBeNull()
  })
})

describe("private links and email", () => {
  it("makes a link that downloads the file under its own name", async () => {
    const path = pathFor(northline.id, dana)
    await upload(dana, path)
    const res = await callFunction("export-share", { action: "link", path }, { token: dana.token })
    expect(res.status).toBe(200)
    expect(Date.parse(res.body.expires_at)).toBeGreaterThan(Date.now() + 6 * 86_400_000)
    const file = await fetch(res.body.url)
    expect(file.status).toBe(200)
    expect(file.headers.get("content-disposition")).toContain("northline-transcripts.zip")
    expect(await file.text()).toBe("PK test")
    const { data: log } = await admin.from("audit_log").select("action, client_id, actor_id").eq("action", "transcripts.link_created")
    expect(log).toEqual([{ action: "transcripts.link_created", client_id: northline.id, actor_id: dana.id }])
  })

  it("emails the link only to the person who asked", async () => {
    const path = pathFor(northline.id, dana)
    await upload(dana, path)
    const res = await callFunction("export-share", { action: "email", path, to: "someone-else@example.com" }, { token: dana.token })
    expect(res).toMatchObject({ status: 200, body: { emailed_to: "dana@northline.test" } })
    const { emails } = await mockTavusState()
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toEqual(["dana@northline.test"])
    expect(emails[0].subject).toBe("Your transcripts from Northline Realty")
    expect(emails[0].text).toContain(res.body.url)
    expect(emails[0].html).toContain("northline-transcripts.zip")
  })

  it("says so when the email service fails, and tells the app whether email is set up", async () => {
    expect((await callFunction("export-share", { action: "options" }, { token: dana.token })).body).toMatchObject({ email: true, link_days: 7 })
    await resetMockTavus({ emailStatus: 500 })
    const path = pathFor(northline.id, dana)
    await upload(dana, path)
    const res = await callFunction("export-share", { action: "email", path }, { token: dana.token })
    expect(res.status).toBe(502)
    expect(res.body.error).toMatch(/could not be sent/)
    await resetMockTavus()
  })

  it("refuses files that are not the caller's own", async () => {
    const path = pathFor(northline.id, dana)
    await upload(dana, path)
    expect((await callFunction("export-share", { action: "link", path }, { token: lee.token })).status).toBe(403)
    expect((await callFunction("export-share", { action: "link", path }, { token: pat.token })).status).toBe(403)
    expect((await callFunction("export-share", { action: "link", path })).status).toBe(401)
    // A path dressed up to look like the caller's own.
    const forged = `${northline.id}/${pat.id}/${randomUUID()}/x.zip`
    expect((await callFunction("export-share", { action: "link", path: forged }, { token: pat.token })).status).toBe(403)
    expect((await callFunction("export-share", { action: "link", path: `${path}/../../x.zip` }, { token: dana.token })).status).toBe(400)
    expect((await callFunction("export-share", { action: "link", path: pathFor(northline.id, dana) }, { token: dana.token })).status).toBe(404)
  })
})

describe("clean-up", () => {
  it("removes export files after a week and keeps newer ones", async () => {
    const old = pathFor(northline.id, dana, "old.zip")
    const fresh = pathFor(northline.id, dana, "fresh.zip")
    await upload(dana, old)
    await upload(dana, fresh)
    execFileSync("docker", ["exec", "-i", "supabase_db_avatar-analytics", "psql", "-U", "postgres", "-q", "-c",
      `update storage.objects set created_at = now() - interval '8 days' where name = '${old}'`], { stdio: "ignore" })
    const res = await callFunction("export-share", {}, { headers: { "x-cron-secret": "local-cron-secret" } })
    expect(res).toMatchObject({ status: 200, body: { removed: 1 } })
    expect((await callFunction("export-share", { action: "link", path: old }, { token: dana.token })).status).toBe(404)
    expect((await callFunction("export-share", { action: "link", path: fresh }, { token: dana.token })).status).toBe(200)
    expect((await dana.client.rpc("expired_export_paths", { p_days: 0 })).error).not.toBeNull()
  })
})
