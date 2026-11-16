// A stand-in for the Tavus API, for local development and tests. It speaks
// just enough of the real API (docs.tavus.io/openapi.yaml) for this app:
// listing PALs and deployments, reading and patching a PAL, and conversations.
//
//   node tests/mock-tavus.mjs          → http://127.0.0.1:54398/v2
//
// Tests reset and inspect it through /__control/*.

import http from "node:http"

const PORT = Number(process.env.MOCK_TAVUS_PORT ?? 54398)

function seed() {
  const pal = (pal_id, pal_name, extra = {}) => ({
    pal_id, pal_name, pipeline_mode: "full", default_face_id: "r" + pal_id.slice(1),
    callback_url: null, created_at: "2026-09-01 10:00:00.000000", updated_at: "2026-11-02T09:00:00.000000Z", ...extra,
  })
  const dep = (deployment_id, pal_id, name, channel, allowed_origins, extra = {}) => ({
    deployment_id, pal_id, name, channel, status: "active", allowed_origins,
    limits: { max_call_duration: 900, daily_call_limit: null, concurrent_call_limit: null },
    usage_total: 42, usage_today: 3,
    thumbnail_image_url: `https://cdn.replica.tavus.io/mock/${pal_id}.jpg`,
    created_at: "2026-10-06T07:59:33.863176+00:00Z", updated_at: "2026-10-17T11:55:10.643621+00:00Z", ...extra,
  })
  return {
    pals: [
      pal("p3a91c0de01", "Maya · Northline Leasing Concierge"),
      pal("p7c20c0de02", "Theo · Northline Buyer Intake"),
      pal("pe551c0de03", "Ivy · Northline After-hours"),
      pal("pa00c0de0004", "Zoey Care Concierge"),
      pal("pf00c0de0005", "Onboarding Guide"),
      pal("pb00c0de0006", "Harbor Dental Front Desk", { callback_url: "https://hooks.harbor-dental.example/tavus" }),
      pal("pc00c0de0007", "Cedar Law Intake"),
      pal("pd00c0de0008", "Summit Fitness Coach"),
    ],
    deployments: [
      dep("d-maya-embed", "p3a91c0de01", "Maya Embed (northlinerealty.com)", "embed", ["https://northlinerealty.com"]),
      dep("d-maya-widget", "p3a91c0de01", "Maya Widget", "widget", ["https://northlinerealty.com"]),
      dep("d-theo-embed", "p7c20c0de02", "Theo Embed", "embed", ["https://northlinerealty.com"]),
      dep("d-ivy-page", "pe551c0de03", "Ivy Link", "landing-page", []),
      dep("d-zoey-embed", "pa00c0de0004", "Zoey Embed (willowcare.example WordPress, no cam)", "embed",
        ["https://willowcare.example", "https://www.willowcare.example"]),
      dep("d-harbor-embed", "pb00c0de0006", "Harbor Embed", "embed", ["https://harbor-dental.example"]),
    ],
    conversations: [],
    documents: [],
    emails: [],
    emailStatus: 200,
    recrawls: [],
    recrawlStatus: 202,
    anthropicCalls: 0,
    anthropicStatus: 200,
    patches: [],
    deploymentPatches: [],
    failDeploymentPatchFor: [],
    stripe: { customers: [], sessions: [], portals: [], subscriptions: {}, calls: [], failNext: 0 },
    failPatchFor: [],
    emptyLists: false,
  }
}

let state = seed()

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

function readText(req) {
  return new Promise((resolve) => {
    let data = ""
    req.on("data", (c) => (data += c))
    req.on("end", () => resolve(data))
  })
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ""
    req.on("data", (c) => (data += c))
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : null) } catch { resolve(null) }
    })
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname

  if (path === "/__control/reset" && req.method === "POST") {
    state = { ...seed(), ...((await readBody(req)) ?? {}) }
    return send(res, 200, { ok: true })
  }
  if (path === "/__control/state") return send(res, 200, state)
  if (path === "/__control/health") return send(res, 200, { ok: true })

  // ── A stand-in for the Anthropic Messages API, used for conversation summaries ──
  // It "reads" the transcript in the request: every visitor line ending in "?"
  // is a question, unanswered when the reply says it is not certain.
  if (path === "/anthropic/v1/messages" && req.method === "POST") {
    state.anthropicCalls++
    if (state.anthropicStatus !== 200) {
      return send(res, state.anthropicStatus, { type: "error", error: { type: state.anthropicStatus === 401 ? "authentication_error" : "api_error", message: "mock failure" } })
    }
    const body = await readBody(req)
    const prompt = body.messages[0].content
    const existing = [...prompt.matchAll(/^- ([0-9a-f-]{36}): (.+)$/gm)].map((m) => ({ id: m[1], question: m[2] }))
    const lines = prompt.split("<transcript>")[1].split("</transcript>")[0].trim().split("\n")
    const questions = []
    lines.forEach((line, i) => {
      const said = line.replace(/^[^:]+: /, "")
      if (!line.startsWith("Visitor:") || !said.includes("?")) return
      const reply = lines[i + 1] ?? ""
      const outcome = !reply ? "unanswered" : /not certain|don't know/i.test(reply) ? "unanswered" : /check (the|our) website/i.test(reply) ? "weak" : "answered"
      const topic = said.split(/(?<=[.!]) /).find((part) => part.includes("?")) ?? said
      questions.push({ question: said, outcome, topic, group_id: existing.find((g) => g.question === topic)?.id ?? null })
    })
    const result = { summary: `The visitor asked ${questions.length} question${questions.length === 1 ? "" : "s"}. ${questions.some((q) => q.outcome !== "answered") ? "The avatar could not answer all of them." : "The avatar answered them."}`, questions }
    return send(res, 200, {
      id: "msg_mock", type: "message", role: "assistant", model: body.model,
      content: [{ type: "text", text: JSON.stringify(result) }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 100, output_tokens: 50 },
    })
  }

  // ── A stand-in for the Stripe API: just the calls the app makes ──
  if (path.startsWith("/stripe/v1/")) {
    if (!/^Bearer sk_/.test(req.headers.authorization ?? "")) return send(res, 401, { error: { message: "Invalid API Key provided" } })
    const sp = path.slice("/stripe/v1".length)
    const form = req.method === "POST" ? Object.fromEntries(new URLSearchParams(await readText(req))) : {}
    state.stripe.calls.push({ method: req.method, path: sp, form })
    if (state.stripe.failNext > 0) {
      state.stripe.failNext--
      return send(res, 402, { error: { message: "mock failure" } })
    }
    const now = Math.floor(Date.now() / 1000)
    if (sp === "/customers") {
      const customer = { id: `cus_mock${state.stripe.customers.length + 1}`, name: form.name, email: form.email, metadata: { client_id: form["metadata[client_id]"] } }
      state.stripe.customers.push(customer)
      return send(res, 200, customer)
    }
    if (sp === "/checkout/sessions") {
      const session = { id: `cs_mock${state.stripe.sessions.length + 1}`, url: `https://checkout.stripe.test/pay/cs_mock${state.stripe.sessions.length + 1}`, form }
      state.stripe.sessions.push(session)
      return send(res, 200, session)
    }
    if (sp === "/billing_portal/sessions") {
      state.stripe.portals.push(form)
      return send(res, 200, { url: `https://billing.stripe.test/session/${state.stripe.portals.length}` })
    }
    const sub = sp.match(/^\/subscriptions\/([^/]+)$/)
    if (sub) {
      const current = state.stripe.subscriptions[sub[1]]
      if (!current) return send(res, 404, { error: { message: "No such subscription" } })
      if (req.method === "POST") {
        if (form["items[0][price]"]) current.items.data[0].price.id = form["items[0][price]"]
        if (form.cancel_at_period_end !== undefined) current.cancel_at_period_end = form.cancel_at_period_end === "true"
        if (form["metadata[plan_id]"]) current.metadata.plan_id = form["metadata[plan_id]"]
      }
      return send(res, 200, current)
    }
    return send(res, 404, { error: { message: `Unrecognized request URL (${sp})` } })
  }

  // ── A stand-in for the Resend email API ──
  if (path === "/resend/emails" && req.method === "POST") {
    if (!/^Bearer \S+/.test(req.headers.authorization ?? "")) return send(res, 401, { message: "Missing API key" })
    if (state.emailStatus !== 200) return send(res, state.emailStatus, { message: "mock failure" })
    state.emails.push(await readBody(req))
    return send(res, 200, { id: `email-mock-${state.emails.length}` })
  }

  if (!req.headers["x-api-key"]) return send(res, 401, { message: "Invalid access token" })

  if (path === "/v2/documents" && req.method === "POST") {
    const body = await readBody(req)
    const doc = { document_id: `d-mock-${state.documents.length + 1}`, status: "started", ...body }
    state.documents.push(doc)
    return send(res, 200, doc)
  }
  const recrawl = path.match(/^\/v2\/documents\/([^/]+)\/recrawl$/)
  if (recrawl && req.method === "POST") {
    if (state.recrawlStatus !== 202) return send(res, state.recrawlStatus, { message: "Recrawl not allowed yet" })
    state.recrawls.push(recrawl[1])
    return send(res, 202, { document_id: recrawl[1], status: "recrawling" })
  }

  const limit = Number(url.searchParams.get("limit") ?? 10)

  if (path === "/v2/pals" && req.method === "GET") {
    const page = Number(url.searchParams.get("page") ?? 1)
    const all = state.emptyLists ? [] : state.pals
    return send(res, 200, { data: all.slice((page - 1) * limit, page * limit), total_count: all.length })
  }

  const palMatch = path.match(/^\/v2\/pals\/([^/]+)$/)
  if (palMatch) {
    const pal = state.pals.find((p) => p.pal_id === palMatch[1])
    if (!pal) return send(res, 404, { message: "PAL not found" })
    if (req.method === "GET") return send(res, 200, pal)
    if (req.method === "PATCH") {
      const ops = (await readBody(req)) ?? []
      if (state.failPatchFor.includes(pal.pal_id)) return send(res, 409, { conflict: "maker_changes", message: "PAL has unapplied Maker changes" })
      for (const op of ops) {
        const field = op.path.replace(/^\//, "")
        if (op.op === "remove") delete pal[field]
        // callback_secret is write-only in the real API.
        else if (field === "callback_secret") pal._callback_secret = op.value
        else pal[field] = op.value
      }
      state.patches.push({ pal_id: pal.pal_id, ops })
      return send(res, 200, pal)
    }
  }

  const depMatch = path.match(/^\/v2\/deployments\/([^/]+)$/)
  if (depMatch && req.method === "PATCH") {
    const dep = state.deployments.find((d) => d.deployment_id === depMatch[1])
    if (!dep) return send(res, 404, { message: "Deployment not found" })
    if (state.failDeploymentPatchFor.includes(dep.deployment_id)) return send(res, 500, { message: "mock failure" })
    const ops = await readBody(req)
    for (const op of ops) dep[op.path.replace(/^\//, "")] = op.value
    state.deploymentPatches.push({ deployment_id: dep.deployment_id, ops })
    return send(res, 200, dep)
  }

  if (path === "/v2/deployments" && req.method === "GET") {
    const page = Number(url.searchParams.get("page") ?? 0)
    const all = state.emptyLists ? [] : state.deployments
    return send(res, 200, { deployments: all.slice(page * limit, (page + 1) * limit), total: all.length, page, limit })
  }

  if (path === "/v2/conversations" && req.method === "GET") {
    const page = Number(url.searchParams.get("page") ?? 1)
    const all = state.conversations.map(({ events: _events, ...c }) => c)
    return send(res, 200, { data: all.slice((page - 1) * limit, page * limit), total_count: all.length })
  }

  const convMatch = path.match(/^\/v2\/conversations\/([^/]+)$/)
  if (convMatch && req.method === "GET") {
    const conv = state.conversations.find((c) => c.conversation_id === convMatch[1])
    if (!conv) return send(res, 404, { message: "Conversation not found" })
    const { events, ...rest } = conv
    return send(res, 200, url.searchParams.get("verbose") === "true" ? { ...rest, events } : rest)
  }

  send(res, 404, { message: "Not found" })
})

server.listen(PORT, "127.0.0.1", () => console.log(`mock Tavus on http://127.0.0.1:${PORT}/v2`))
