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

const SAMPLE_TOPICS = {
  "Hi, do you have any two-bedroom homes available in January?": "Do you have two-bedroom homes available in January?",
  "Yes please. Is there a pet deposit?": "Is there a pet deposit?",
  "That works. Can I book a tour for Saturday?": "Can I book a tour for Saturday?",
}

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

  log("Creating packages and a subscription…")
  // Made-up packages and prices, for the demo only.
  const plans = must(await admin.from("plans").insert([
    { name: "Starter", description: "For a single avatar and a quiet site.", monthly_price_cents: 9900, included_minutes: 150, max_concurrent: 1, stripe_price_id: "price_demoStarter", is_active: true, sort: 1 },
    { name: "Standard", description: "For a busy site with a few avatars.", monthly_price_cents: 19900, included_minutes: 300, max_concurrent: 3, stripe_price_id: "price_demoStandard", is_active: true, sort: 2 },
    { name: "Plus", description: "For several sites or long conversations.", monthly_price_cents: 34900, included_minutes: 600, max_concurrent: 5, stripe_price_id: "price_demoPlus", is_active: true, sort: 3 },
  ]).select("id, name"), "plans")
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 5))
  const monthEnd = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1, 5))
  must(await admin.from("client_billing").insert({
    client_id: northline.id, plan_id: plans.find((p) => p.name === "Standard").id, status: "active", stripe_customer_id: "cus_demoNorthline",
    stripe_subscription_id: "sub_demoNorthline", current_period_start: monthStart.toISOString(), current_period_end: monthEnd.toISOString(),
  }), "billing")
  const invoiceFor = (n, monthsAgo) => {
    const issued = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - monthsAgo, 1, 5))
    return {
      id: `in_demo${n}`, client_id: northline.id, number: `DEMO-000${n}`, status: "paid", amount_due_cents: 19900, amount_paid_cents: 19900, currency: "usd",
      hosted_invoice_url: `https://invoice.stripe.test/i/in_demo${n}`, invoice_pdf: `https://invoice.stripe.test/i/in_demo${n}/pdf`,
      period_start: issued.toISOString(), period_end: new Date(Date.UTC(issued.getUTCFullYear(), issued.getUTCMonth() + 1, 1, 5)).toISOString(), issued_at: issued.toISOString(),
    }
  }
  must(await admin.from("invoices").insert([invoiceFor(3, 0), invoiceFor(2, 1), invoiceFor(1, 2)]), "invoices")

  log("Filling in client files…")
  const ownerId = must(await admin.from("profiles").select("id").eq("side", "divigner").limit(1), "owner")[0].id
  must(await admin.from("clients").update({ website: "https://northlinerealty.example", industry: "Real estate", phone: "555-0100", account_manager_id: ownerId }).eq("id", northline.id), "account")
  must(await admin.from("clients").update({ website: "https://harbor-dental.example", industry: "Dental care" }).eq("id", harbor.id), "account")
  must(await admin.from("client_contacts").insert([
    { client_id: northline.id, full_name: "Morgan Hale", title: "Operations lead", email: "morgan@northline.test", phone: "555-0101", is_primary: true, created_by: ownerId },
    { client_id: northline.id, full_name: "Dana Reyes", title: "Marketing manager", email: "dana@northline.test", phone: null, is_primary: false, created_by: ownerId },
    { client_id: harbor.id, full_name: "Pat Kim", title: "Practice manager", email: "pat@harbor.test", phone: "555-0140", is_primary: true, created_by: ownerId },
  ]), "contacts")
  must(await admin.from("client_notes").insert([
    { client_id: northline.id, author_id: ownerId, kind: "call", pinned: true, body: "Kick-off call. They want a second avatar for the buyer side in the new year, and transcripts sent to the leasing team each Monday." },
    { client_id: northline.id, author_id: ownerId, kind: "note", pinned: false, body: "Logo arrives next week from their designer. Using their name in the header until then." },
    { client_id: harbor.id, author_id: ownerId, kind: "meeting", pinned: false, body: "Demo went well. Deciding on a package after their board meets." },
  ]), "notes")

  log("Writing summaries and questions…")
  const pending = must(await admin.from("conversation_insights").select("conversation_id").eq("status", "pending"), "pending")
  const transcripts = must(await admin.from("transcripts").select("conversation_id, turns"), "transcripts")
  const turnsOf = new Map(transcripts.map((t) => [t.conversation_id, t.turns]))
  const groupIds = new Map() // client|topic -> group id, so repeats are counted rather than duplicated
  const clientOf = new Map(must(await admin.from("conversations").select("conversation_id, client_id"), "conversations").map((c) => [c.conversation_id, c.client_id]))
  for (const { conversation_id } of pending) {
    const turns = turnsOf.get(conversation_id) ?? []
    const client = clientOf.get(conversation_id)
    const questions = []
    turns.forEach((turn, i) => {
      if (turn.role !== "user" || !turn.content.includes("?")) return
      const topic = SAMPLE_TOPICS[turn.content] ?? turn.content
      const reply = turns[i + 1]?.content ?? ""
      const outcome = !reply ? "unanswered" : /not certain/i.test(reply) ? "weak" : "answered"
      questions.push({ question: topic, outcome, topic, group_id: groupIds.get(`${client}|${topic}`) ?? null })
    })
    const missed = questions.filter((q) => q.outcome !== "answered").length
    const summary = `The visitor asked about ${questions.length > 1 ? "availability, pets and tours" : "two-bedroom homes in January"}. `
      + (missed ? "The avatar could not fully answer every question, so a follow-up is expected." : "The avatar answered and offered next steps.")
    must(await admin.rpc("save_conversation_insights", { p_conversation_id: conversation_id, p_summary: summary, p_questions: questions, p_model: "demo" }), "insights")
    if (missed) {
      for (const g of must(await admin.from("question_groups").select("id, question").eq("client_id", client), "groups")) groupIds.set(`${client}|${g.question}`, g.id)
    }
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
