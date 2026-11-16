// Fills the LOCAL database with made-up clients, avatars and two months of
// calls, so there is something to look at. Never run this against production.
//
//   npm run seed        (needs the local stack, mock Tavus and functions running)
//
// Sign in afterwards as owner@divigner.test or dana@northline.test with the
// password printed at the end.

import { createClient } from "@supabase/supabase-js"
import { existsSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const DEMO_PASSWORD = "Correct-horse-9-battery"

function settings() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local")
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const functionsUrl = process.env.VITE_FUNCTIONS_URL ?? "http://127.0.0.1:54399/functions/v1"
  if (!url || !serviceKey || !anonKey) throw new Error("Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local")
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error(`Refusing to seed ${url}: this script is for a local database only.`)
  return { url, serviceKey, anonKey, functionsUrl }
}

// A small seeded random generator, so the sample data is the same every run.
function random(seed) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SAMPLE_TURNS = [
  ["user", "Hi, do you have any two-bedroom homes available in January?"],
  ["assistant", "We do. Three two-bedroom homes open up in January. Would you like to hear about them?"],
  ["user", "Yes please. Is there a pet deposit?"],
  ["assistant", "I'm not certain about the pet deposit. I can have someone from the team follow up with you."],
  ["user", "That works. Can I book a tour for Saturday?"],
  ["assistant", "Of course. I have 10 am or 2 pm on Saturday. Which suits you?"],
]

export async function seedDemo({ days = 75, log = console.log } = {}) {
  const { url, serviceKey, anonKey, functionsUrl } = settings()
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const must = (result, what) => {
    if (result.error) throw new Error(`${what}: ${result.error.message}`)
    return result.data
  }
  const roles = Object.fromEntries(must(await admin.from("roles").select("id, key"), "roles").map((r) => [r.key, r.id]))

  async function user(email, fullName, role, clientId) {
    const created = must(await admin.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } }), `create ${email}`)
    must(await admin.from("profiles").upsert({ id: created.user.id, email, full_name: fullName, side: clientId ? "client" : "divigner", role_id: roles[role], client_id: clientId ?? null }), `profile ${email}`)
    return created.user.id
  }

  log("Creating the Owner…")
  await user("owner@divigner.test", "Jordan Owner", "owner")
  const ownerClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const session = must(await ownerClient.auth.signInWithPassword({ email: "owner@divigner.test", password: DEMO_PASSWORD }), "sign in")
  const call = async (name, body) => {
    const res = await fetch(`${functionsUrl}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${session.session.access_token}` },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`${name}: ${json.error}`)
    return json
  }

  log("Loading avatars from the mock Tavus…")
  await call("tavus-sync", {})

  log("Creating clients and linking avatars…")
  const northline = must(await ownerClient.rpc("create_client", { p_name: "Northline Realty", p_slug: "northline", p_timezone: "America/New_York", p_brand_color: "#0F766E" }), "client")
  const harbor = must(await ownerClient.rpc("create_client", { p_name: "Harbor Dental", p_slug: "harbor-dental", p_timezone: "America/Los_Angeles", p_brand_color: "#7C3AED" }), "client")
  must(await admin.from("clients").update({ status: "active" }).in("id", [northline.id, harbor.id]), "activate")

  await call("avatar-link", { action: "link", client_id: northline.id, pals: [
    { pal_id: "p3a91c0de01", display_name: "Maya" }, { pal_id: "p7c20c0de02", display_name: "Theo" }, { pal_id: "pe551c0de03", display_name: "Ivy" },
  ] })
  await call("avatar-link", { action: "link", client_id: harbor.id, pals: [{ pal_id: "pb00c0de0006", display_name: "Zara" }], replace_existing_callback: true })
  const labels = { Maya: "Leasing concierge", Theo: "Buyer intake", Ivy: "After-hours", Zara: "Front desk" }
  const avatars = must(await admin.from("avatars").select("id, display_name, client_id"), "avatars")
  for (const a of avatars) must(await admin.from("avatars").update({ role_label: labels[a.display_name] }).eq("id", a.id), "label")

  log("Creating people…")
  await user("sam@divigner.test", "Sam Manager", "manager")
  await user("dana@northline.test", "Dana Reyes", "client_admin", northline.id)
  await user("lee@northline.test", "Lee Park", "client_member", northline.id)
  await user("pat@harbor.test", "Pat Kim", "client_admin", harbor.id)

  log(`Creating ${days} days of calls…`)
  const rand = random(20261116)
  const weight = { Maya: 3.2, Theo: 1.4, Ivy: 0.6, Zara: 2.2 }
  const events = []
  const now = Date.now()
  let n = 0
  for (let d = days - 1; d >= 0; d--) {
    for (const avatar of avatars) {
      const calls = Math.floor(rand() * (weight[avatar.display_name] + 1) + (rand() < 0.25 ? 1 : 0))
      for (let i = 0; i < calls; i++) {
        // Between 9 am and 9 pm UTC-ish, never in the future.
        const start = Math.min(now - 120_000 - Math.floor(rand() * 3_000_000), now - d * 86_400_000 - Math.floor(rand() * 43_200_000))
        const seconds = 20 + Math.floor(rand() ** 2 * 780)
        const id = `demo-${String(++n).padStart(5, "0")}`
        const reason = seconds > 700 ? "max_call_duration reached" : rand() < 0.85 ? "participant_left_timeout" : "end_conversation_endpoint_hit"
        events.push({ avatar: avatar.id, payload: { conversation_id: id, event_type: "system.pal_joined", timestamp: new Date(start).toISOString(), properties: {} } })
        events.push({ avatar: avatar.id, payload: { conversation_id: id, event_type: "system.shutdown", timestamp: new Date(start + seconds * 1000).toISOString(), properties: { shutdown_reason: reason } } })
        if (rand() < 0.7) {
          const turns = SAMPLE_TURNS.slice(0, 2 + Math.floor(rand() * 5)).map(([role, content], k) => ({ role, content, seconds_from_start: 3 + k * 7, duration: 2 + Math.round(rand() * 40) / 10 }))
          events.push({ avatar: avatar.id, payload: { conversation_id: id, event_type: "application.transcription_ready", timestamp: new Date(start + seconds * 1000 + 1500).toISOString(), properties: { transcript: turns } } })
        }
      }
    }
  }
  for (let i = 0; i < events.length; i += 25) {
    await Promise.all(events.slice(i, i + 25).map(async (e) =>
      must(await admin.rpc("ingest_tavus_event", { p_avatar_id: e.avatar, p_payload: e.payload, p_source: "webhook" }), "ingest")))
  }

  log(`Done: ${n} calls for ${avatars.length} avatars.`)
  log(`Sign in as owner@divigner.test (Divigner) or dana@northline.test (client). Password: ${DEMO_PASSWORD}`)
  return { northline, harbor, calls: n }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  seedDemo().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
