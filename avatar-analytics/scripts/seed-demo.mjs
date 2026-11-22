// Fills the LOCAL database with made-up clients, avatars and two months of
// calls, so there is something to look at. Never run this against production.
//
//   npm run seed        (needs the local stack, mock Tavus and functions running)
//
// Sign in afterwards as owner@divigner.test or dana@northline.test with the
// password printed at the end.

import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync } from "node:fs"
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

// What a visitor asks a clinic's front-desk avatar. Nothing clinical: times, insurance and what to bring.
const CLINIC_TURNS = [
  ["user", "Hi, are you taking new patients this month?"],
  ["assistant", "We are. New patient visits are open on weekday mornings. Would you like me to find a time?"],
  ["user", "Yes please. Do you take Blue Ridge insurance?"],
  ["assistant", "I'm not certain about that plan. I can have someone from the front desk confirm it for you."],
  ["user", "Okay. What should I bring to the first visit?"],
  ["assistant", "Please bring a photo ID, your insurance card and a list of any medicines you take."],
]

const SAMPLE_TOPICS = {
  "Hi, are you taking new patients this month?": "Are you taking new patients?",
  "Yes please. Do you take Blue Ridge insurance?": "Do you take Blue Ridge insurance?",
  "Okay. What should I bring to the first visit?": "What should I bring to the first visit?",
  "Hi, do you have any two-bedroom homes available in January?": "Do you have two-bedroom homes available in January?",
  "Yes please. Is there a pet deposit?": "Is there a pet deposit?",
  "That works. Can I book a tour for Saturday?": "Can I book a tour for Saturday?",
}

// Avanew's look, as lib/brand.ts holds it.
const AVANEW_THEME = {
  motion: true,
  light: { background: "#edf1f7", card: "#f8fafd", text: "#0b1f3a", action: "#1d3a66", action_text: "#ffffff", highlight: "#d4af4c", sidebar: "#0a1a30" },
  dark: { background: "#0b1828", card: "#10223a", text: "#e6ecf5", action: "#d9b95c", action_text: "#0b1f3a", highlight: "#d9b95c", sidebar: "#07111f" },
}

export async function seedDemo({ days = 75, log = console.log, glass = false, agency = false, history = false, logos = false } = {}) {
  const { url, serviceKey, anonKey, functionsUrl } = settings()
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const must = (result, what) => {
    if (result.error) throw new Error(`${what}: ${result.error.message}`)
    return result.data
  }
  const roles = Object.fromEntries(must(await admin.from("roles").select("id, key"), "roles").map((r) => [r.key, r.id]))

  async function user(email, fullName, role, clientId, agencyId) {
    const created = must(await admin.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } }), `create ${email}`)
    must(await admin.from("profiles").upsert({ id: created.user.id, email, full_name: fullName, side: clientId ? "client" : "divigner", role_id: roles[role], client_id: clientId ?? null, agency_id: clientId ? null : (agencyId ?? null) }), `profile ${email}`)
    return created.user.id
  }

  const signedIn = async (email) => {
    const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    must(await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD }), `sign in ${email}`)
    return c
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
  // Sample pictures kept beside this script, saved the way an upload from the app is.
  const picture = async (folder, file) => {
    const path = `${folder}/${file}`
    must(await admin.storage.from("logos").upload(path, readFileSync(new URL(`./demo-assets/${file}`, import.meta.url)), { contentType: "image/png", upsert: true }), `picture ${file}`)
    return admin.storage.from("logos").getPublicUrl(path).data.publicUrl
  }
  if (logos) must(await admin.from("clients").update({ logo_url: await picture(northline.id, "northline-logo.png") }).eq("id", northline.id), "Northline logo")

  // The agency's clients are clinics, so their conversations read differently from the realty ones.
  const clinicClients = new Set()
  let theirs = null
  if (agency) {
    // A fully set up agency: its look and logos, its own team, its own packages,
    // and two clients with avatars, calls, transcripts, people and files of their own.
    log("Creating an agency, its team and its clients…")
    // A made-up fee, for the demo only. The address works on a developer's machine.
    const avanew = must(await ownerClient.rpc("create_agency", { p_name: "Avanew", p_slug: "avanew", p_domain: "avanew.localhost", p_theme: AVANEW_THEME, p_payment_model: "subscription", p_fee_cents: 25000 }), "agency")
    must(await ownerClient.rpc("agency_set_brand", {
      p_agency_id: avanew.id, p_theme: AVANEW_THEME,
      p_logo_light_url: await picture(avanew.id, "avanew-logo-on-light.png"), p_logo_dark_url: await picture(avanew.id, "avanew-logo-on-dark.png"), p_icon_url: await picture(avanew.id, "avanew-icon.png"),
    }), "agency brand")

    const avaId = await user("ava@avanew.test", "Ava Lindqvist", "owner", null, avanew.id)
    await user("priya@avanew.test", "Priya Nair", "admin", null, avanew.id)
    const maxId = await user("max@avanew.test", "Max Okafor", "manager", null, avanew.id)
    await user("jo@avanew.test", "Jo Bell", "analyst", null, avanew.id)
    const ava = await signedIn("ava@avanew.test")

    const lakeside = must(await ava.rpc("create_client", { p_name: "Lakeside Family Practice", p_slug: "lakeside", p_timezone: "America/Chicago", p_brand_color: "#1D4E89" }), "agency client")
    const hillcrest = must(await ava.rpc("create_client", { p_name: "Hillcrest Pediatrics", p_slug: "hillcrest", p_timezone: "America/Chicago", p_brand_color: "#B45309" }), "agency client")
    must(await admin.from("clients").update({ status: "active", industry: "Primary care", website: "https://lakesidefamily.example", phone: "555-0160", account_manager_id: avaId, logo_url: await picture(lakeside.id, "lakeside-logo.png") }).eq("id", lakeside.id), "Lakeside")
    must(await admin.from("clients").update({ status: "active", industry: "Pediatrics", website: "https://hillcrestpeds.example", phone: "555-0175", account_manager_id: maxId, logo_url: await picture(hillcrest.id, "hillcrest-logo.png") }).eq("id", hillcrest.id), "Hillcrest")
    must(await admin.from("staff_client_assignments").insert({ user_id: maxId, client_id: hillcrest.id }), "assign")
    clinicClients.add(lakeside.id).add(hillcrest.id)

    await user("sam@lakeside.test", "Sam Ortiz", "client_admin", lakeside.id)
    await user("erin@lakeside.test", "Erin Walsh", "client_member", lakeside.id)
    await user("tess@hillcrest.test", "Tess Moreau", "client_admin", hillcrest.id)

    // The agency's avatars come from its own Tavus account, so they are added here directly.
    const cast = [
      [lakeside, "pa90c0de0009", "Dr. Lake", "Front desk", "lakesidefamily.example", 3.4],
      [lakeside, "pa92c0de0011", "Nia", "After-hours line", "lakesidefamily.example", 1.5],
      [hillcrest, "pa91c0de0010", "Poppy", "Parent helper", "hillcrestpeds.example", 2.2],
    ]
    const theirAvatars = []
    for (const [client, palId, name, label, site, busy] of cast) {
      // The stand-in for Tavus serves a picture for any avatar, as Tavus does for a real one.
      const photo = `http://127.0.0.1:54398/photo/${palId}.jpg`
      must(await admin.from("tavus_pals").upsert({ pal_id: palId, name: `${name} · ${client.name}`, agency_id: avanew.id, thumbnail_image_url: photo }), "agency avatar")
      must(await admin.from("tavus_deployments").upsert({
        deployment_id: `d-${palId}-embed`, pal_id: palId, channel: "embed", status: "active", name: `${name} Embed (${site})`, allowed_origins: [`https://${site}`],
        limits: { max_call_duration: 900 }, thumbnail_image_url: photo, agency_id: avanew.id,
      }), "agency deployment")
      const row = must(await admin.from("avatars").insert({ client_id: client.id, tavus_pal_id: palId, display_name: name, role_label: label, photo_url: photo, webhook_status: "active" }).select("id").single(), "agency avatar")
      theirAvatars.push({ id: row.id, client_id: client.id, busy })
    }
    for (let d = days - 1; d >= 0; d--) {
      for (const avatar of theirAvatars) {
        const calls = Math.floor(rand() * (avatar.busy + 1))
        for (let i = 0; i < calls; i++) {
          const start = Math.min(now - 120_000 - Math.floor(rand() * 3_000_000), now - d * 86_400_000 - Math.floor(rand() * 43_200_000))
          const seconds = 45 + Math.floor(rand() ** 2 * 560)
          const id = `demo-${String(++n).padStart(5, "0")}`
          const batch = [
            { conversation_id: id, event_type: "system.pal_joined", timestamp: new Date(start).toISOString(), properties: {} },
            { conversation_id: id, event_type: "system.shutdown", timestamp: new Date(start + seconds * 1000).toISOString(), properties: { shutdown_reason: rand() < 0.85 ? "participant_left_timeout" : "end_conversation_endpoint_hit" } },
          ]
          if (rand() < 0.7) {
            const turns = CLINIC_TURNS.slice(0, 2 + Math.floor(rand() * 5)).map(([role, content], k) => ({ role, content, seconds_from_start: 3 + k * 7, duration: 2 + Math.round(rand() * 40) / 10 }))
            batch.push({ conversation_id: id, event_type: "application.transcription_ready", timestamp: new Date(start + seconds * 1000 + 1500).toISOString(), properties: { transcript: turns } })
          }
          for (const payload of batch) events.push({ avatar: avatar.id, payload })
        }
      }
    }

    // The agency's own packages and what Lakeside has paid it. Made-up prices, for the demo only.
    const theirPlans = must(await admin.from("plans").insert([
      { name: "Practice", description: "For one location and one or two avatars.", monthly_price_cents: 24900, included_minutes: 400, max_concurrent: 2, is_active: true, sort: 1, agency_id: avanew.id },
      { name: "Practice Plus", description: "For several locations or an after-hours line.", monthly_price_cents: 44900, included_minutes: 900, max_concurrent: 5, is_active: true, sort: 2, agency_id: avanew.id },
    ]).select("id, name"), "agency plans")
    const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 5))
    must(await admin.from("client_billing").insert({
      client_id: lakeside.id, plan_id: theirPlans.find((p) => p.name === "Practice").id, status: "active",
      current_period_start: start.toISOString(), current_period_end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 5)).toISOString(),
    }), "agency billing")
    must(await admin.from("invoices").insert([0, 1].map((monthsAgo) => {
      const issued = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - monthsAgo, 1, 5))
      return {
        id: `in_demoLakeside${2 - monthsAgo}`, client_id: lakeside.id, number: `AVN-000${2 - monthsAgo}`, status: "paid", amount_due_cents: 24900, amount_paid_cents: 24900, currency: "usd",
        period_start: issued.toISOString(), period_end: new Date(Date.UTC(issued.getUTCFullYear(), issued.getUTCMonth() + 1, 1, 5)).toISOString(), issued_at: issued.toISOString(),
      }
    })), "agency invoices")

    must(await admin.from("client_contacts").insert([
      { client_id: lakeside.id, full_name: "Sam Ortiz", title: "Practice manager", email: "sam@lakeside.test", phone: "555-0161", is_primary: true, created_by: avaId },
      { client_id: lakeside.id, full_name: "Dr. Helen Lake", title: "Owner", email: "helen@lakeside.test", phone: null, is_primary: false, created_by: avaId },
      { client_id: hillcrest.id, full_name: "Tess Moreau", title: "Office lead", email: "tess@hillcrest.test", phone: "555-0176", is_primary: true, created_by: maxId },
    ]), "agency contacts")
    must(await admin.from("client_notes").insert([
      { client_id: lakeside.id, author_id: avaId, kind: "call", pinned: true, body: "Launch call. Dr. Lake answers the front desk questions; Nia covers evenings. They want the insurance list added before flu season." },
      { client_id: lakeside.id, author_id: avaId, kind: "task", pinned: false, body: "Add the accepted insurance plans to Dr. Lake's knowledge." },
      { client_id: hillcrest.id, author_id: maxId, kind: "meeting", pinned: false, body: "Trial month. Poppy is on the parent resources page only. Review with Tess after four weeks." },
    ]), "agency notes")

    theirs = { avanew, ava, avaId, lakeside, hillcrest, avatars: theirAvatars }
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
    const subject = clinicClients.has(client)
      ? (questions.length > 1 ? "new patient visits, insurance and what to bring" : "whether the practice is taking new patients")
      : (questions.length > 1 ? "availability, pets and tours" : "two-bedroom homes in January")
    const summary = `The visitor asked about ${subject}. `
      + (missed ? "The avatar could not fully answer every question, so a follow-up is expected." : "The avatar answered and offered next steps.")
    must(await admin.rpc("save_conversation_insights", { p_conversation_id: conversation_id, p_summary: summary, p_questions: questions, p_model: "demo" }), "insights")
    if (missed) {
      for (const g of must(await admin.from("question_groups").select("id, question").eq("client_id", client), "groups")) groupIds.set(`${client}|${g.question}`, g.id)
    }
  }

  log("Opening support tickets…")
  const dana = await signedIn("dana@northline.test")
  const lee = await signedIn("lee@northline.test")
  const pat = await signedIn("pat@harbor.test")
  const withTranscript = must(await admin.from("conversations").select("conversation_id").eq("client_id", northline.id).eq("has_transcript", true)
    .order("started_at", { ascending: false }).limit(1), "a conversation")[0]
  const open = async (as, clientId, subject, body, category, conversationId = null) =>
    must(await as.rpc("support_open_ticket", { p_client_id: clientId, p_subject: subject, p_body: body, p_category: category, p_conversation_id: conversationId ?? undefined }), `ticket "${subject}"`)
  const reply = async (as, ticket, body, internal = false) => must(await as.rpc("support_reply", { p_ticket_id: ticket.id, p_body: body, p_internal: internal }), "reply")

  const hours = await open(dana, northline.id, "Maya gave the wrong office hours",
    "A visitor was told the leasing office closes at 5 pm on Saturdays. We close at 2 pm on Saturdays. Can you correct this?", "change_request", withTranscript?.conversation_id)
  must(await ownerClient.rpc("support_assign", { p_ticket_id: hours.id, p_assignee_id: ownerId }), "assign")
  await reply(ownerClient, hours, "Maya's knowledge still has last year's hours page. Updating the Saturday hours and re-testing before I answer.", true)
  await reply(ownerClient, hours, "Thanks, Dana. Maya now says the office closes at 2 pm on Saturdays. Could you confirm the Sunday hours are still 12 to 4?")

  await open(dana, northline.id, "Avatar is not loading on our listings page",
    "Since this morning the Maya window stays blank on northlinerealty.example/listings. It works on the home page.", "avatar_down")

  const teammate = await open(lee, northline.id, "How do I add a teammate?", "Our new leasing agent needs to read transcripts. Where do I invite her?", "question")
  await reply(ownerClient, teammate, "Dana can invite her from the Team page in your portal. Choose Client member so she can read transcripts.")
  must(await lee.rpc("support_set_status", { p_ticket_id: teammate.id, p_status: "resolved" }), "resolve")

  await open(pat, harbor.id, "Which package suits one avatar?", "We expect about 300 minutes of calls a month. Which package should we choose?", "billing")

  /** The agency's side of support, Glass Health for its clinic, and a client that has let the agency read its transcripts. */
  async function finishAgency({ ava, avaId, lakeside, hillcrest, avatars: theirAvatars }) {
    const sam = await signedIn("sam@lakeside.test")
    const tess = await signedIn("tess@hillcrest.test")
    const insurance = await open(sam, lakeside.id, "Dr. Lake could not answer an insurance question",
      "A visitor asked whether we take Blue Ridge and was told someone would follow up. Can the accepted plans be added?", "change_request")
    must(await ava.rpc("support_assign", { p_ticket_id: insurance.id, p_assignee_id: avaId }), "assign")
    await reply(ava, insurance, "Adding the plan list from their website to Dr. Lake's knowledge today.", true)
    await reply(ava, insurance, "Thanks, Sam. The accepted plans are going in today. Could you send the current list so we match your website?")
    const evenings = await open(sam, lakeside.id, "Can Nia start at 5 pm instead of 6 pm?", "Our phones now switch over at 5 pm on weekdays.", "question")
    await reply(ava, evenings, "Done. Nia now takes over at 5 pm on weekdays.")
    must(await sam.rpc("support_set_status", { p_ticket_id: evenings.id, p_status: "resolved" }), "resolve")
    await open(tess, hillcrest.id, "Poppy's window covers our menu on phones", "On a phone the window sits over the menu button on the parent resources page.", "avatar_down")

    // Hillcrest has let its agency read transcripts for a week, so both states can be seen: Lakeside has not.
    must(await tess.rpc("grant_transcript_access", { p_client_id: hillcrest.id, p_hours: 168, p_reason: "Reviewing Poppy's first month together" }), "transcript access")

    // Lakeside's avatars look things up in Glass Health, on Lakeside's own Glass account.
    must(await ava.rpc("glass_enable", { p_client_id: lakeside.id, p_enabled: true }), "turn Glass on")
    const token = (await ava.auth.getSession()).data.session.access_token
    const saved = await fetch(`${functionsUrl}/glass-connection`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${token}` },
      // A stand-in key that only the mock Glass accepts.
      body: JSON.stringify({ action: "save", client_id: lakeside.id, key: "sk-gla-test-demo-lakeside-0001" }),
    })
    if (!saved.ok) throw new Error(`glass-connection: ${(await saved.json()).error}`)
    const drLake = theirAvatars.find((a) => a.client_id === lakeside.id)
    const calls = must(await admin.from("conversations").select("conversation_id, started_at").eq("avatar_id", drLake.id).order("started_at", { ascending: false }).limit(60), "Lakeside calls")
    const asked = []
    for (const call of calls) {
      const questions = rand() < 0.6 ? 1 + Math.floor(rand() * 2) : 0
      for (let q = 0; q < questions; q++) {
        const at = new Date(new Date(call.started_at).getTime() + (20 + q * 40) * 1000)
        const input = 9_000 + Math.floor(rand() * 24_000), output = 140 + Math.floor(rand() * 240)
        asked.push({
          client_id: lakeside.id, avatar_id: drLake.id, conversation_id: call.conversation_id, asked_at: at.toISOString(),
          usage_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(at), status: "ok",
          // Made-up rates, for the demo only.
          input_tokens: input, output_tokens: output, duration_ms: 4200 + output * 12, cost_cents: Math.round(((input * 250 + output * 1500) / 1_000_000) * 10_000) / 10_000, glass_version: "5.5-2026-03-31",
        })
      }
    }
    if (asked.length) must(await admin.from("glass_calls").insert(asked), "Glass questions")
    must(await admin.from("client_glass").update({ last_used_at: asked[0]?.asked_at ?? null }).eq("client_id", lakeside.id), "last used")
  }

  if (glass) {
    // A clinic whose avatar looks things up in Glass Health. Off by default so
    // the browser tests keep their two clients; `npm run seed` turns it on.
    log("Creating a clinic that uses Glass Health…")
    const clinic = must(await ownerClient.rpc("create_client", { p_name: "Riverside Clinic", p_slug: "riverside-clinic", p_timezone: "America/Chicago", p_brand_color: "#1D4ED8" }), "clinic")
    must(await admin.from("clients").update({ status: "active", industry: "Primary care" }).eq("id", clinic.id), "activate clinic")
    await call("avatar-link", { action: "link", client_id: clinic.id, pals: [{ pal_id: "pa00c0de0004", display_name: "Ada" }] })
    const ada = must(await admin.from("avatars").select("id").eq("client_id", clinic.id).single(), "Ada")
    must(await admin.from("avatars").update({ role_label: "Clinical evidence guide" }).eq("id", ada.id), "label")
    await user("noor@riverside.test", "Noor Haddad", "client_admin", clinic.id)

    must(await ownerClient.rpc("glass_enable", { p_client_id: clinic.id, p_enabled: true }), "turn Glass on")
    // A stand-in key that only the mock Glass accepts.
    await call("glass-connection", { action: "save", client_id: clinic.id, key: "sk-gla-test-demo-riverside-0001" })
    // Made-up rates, for the demo only.
    const inRate = 250, outRate = 1500
    must(await admin.from("settings").update({ value: inRate }).eq("key", "glass.input_cents_per_million"), "rate")
    must(await admin.from("settings").update({ value: outRate }).eq("key", "glass.output_cents_per_million"), "rate")

    const clinicEvents = []
    const asked = []
    for (let d = days - 1; d >= 0; d--) {
      const calls = Math.floor(rand() * 3.4)
      for (let i = 0; i < calls; i++) {
        const start = Math.min(now - 120_000 - Math.floor(rand() * 3_000_000), now - d * 86_400_000 - Math.floor(rand() * 43_200_000))
        const seconds = 90 + Math.floor(rand() ** 2 * 600)
        const id = `demo-${String(++n).padStart(5, "0")}`
        clinicEvents.push({ conversation_id: id, event_type: "system.pal_joined", timestamp: new Date(start).toISOString(), properties: {} })
        clinicEvents.push({ conversation_id: id, event_type: "system.shutdown", timestamp: new Date(start + seconds * 1000).toISOString(), properties: { shutdown_reason: "participant_left_timeout" } })
        const questions = rand() < 0.75 ? 1 + Math.floor(rand() * 3) : 0
        for (let q = 0; q < questions; q++) {
          const at = new Date(start + (20 + q * 45) * 1000)
          const input = 10_000 + Math.floor(rand() * 30_000), output = 140 + Math.floor(rand() * 260)
          const failed = rand() < 0.04
          asked.push({
            client_id: clinic.id, avatar_id: ada.id, conversation_id: id, asked_at: at.toISOString(),
            usage_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(at),
            status: failed ? "error" : "ok", error_code: failed ? "timeout" : null,
            input_tokens: failed ? 0 : input, output_tokens: failed ? 0 : output, duration_ms: failed ? 45_000 : 4400 + output * 12,
            cost_cents: failed ? null : Math.round(((input * inRate + output * outRate) / 1_000_000) * 10_000) / 10_000, glass_version: "5.5-2026-03-31",
          })
        }
      }
    }
    for (let i = 0; i < clinicEvents.length; i += 25) {
      await Promise.all(clinicEvents.slice(i, i + 25).map(async (payload) =>
        must(await admin.rpc("ingest_tavus_event", { p_avatar_id: ada.id, p_payload: payload, p_source: "webhook" }), "ingest")))
    }
    for (let i = 0; i < asked.length; i += 200) must(await admin.from("glass_calls").insert(asked.slice(i, i + 200)), "Glass questions")
    must(await admin.from("client_glass").update({ last_used_at: asked.at(-1)?.asked_at ?? null }).eq("client_id", clinic.id), "last used")
    log(`Riverside Clinic: ${asked.length} Glass questions. Sign in as noor@riverside.test.`)
  }

  if (history) {
    // One avatar that has since been unlinked, so the record of past avatars has something in it.
    // Off by default so the browser tests keep Northline's three avatars; `npm run seed` turns it on.
    const { data: ivy } = await admin.from("avatars").select("id").eq("client_id", northline.id).eq("display_name", "Ivy").maybeSingle()
    if (ivy) must(await admin.from("avatars").update({ unlinked_at: new Date(now - 2 * 86_400_000).toISOString() }).eq("id", ivy.id), "unlink Ivy")
  }

  if (agency && theirs) await finishAgency(theirs)

  log(`Done: ${n} calls.`)
  log(`Everyone's password is ${DEMO_PASSWORD}`)
  log("Divigner (creates agencies, has its own clients): owner@divigner.test")
  log("  Its client Northline Realty: dana@northline.test (admin), lee@northline.test (member)")
  log("  Its client Harbor Dental, one avatar: pat@harbor.test")
  if (glass) log("  Its client Riverside Clinic, with Glass Health: noor@riverside.test")
  if (agency) {
    log("Agency Avanew, at http://avanew.localhost:5180/login: ava@avanew.test (Owner), priya@avanew.test (Admin), max@avanew.test (Manager), jo@avanew.test (Analyst)")
    log("  Its client Lakeside Family Practice, with Glass Health: sam@lakeside.test (admin), erin@lakeside.test (member)")
    log("  Its client Hillcrest Pediatrics, transcripts shared with Avanew: tess@hillcrest.test")
  }
  return { northline, harbor, calls: n }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  seedDemo({ glass: true, agency: true, history: true, logos: true }).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
