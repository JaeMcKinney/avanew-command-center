// Runs the server functions on this machine with Deno, for local development
// and tests. In production Supabase runs each function itself.
//
//   npm run functions        (reads supabase/functions/.env)
//
// Serves http://127.0.0.1:54399/functions/v1/<name>

import { handler as avatarLink } from "../supabase/functions/avatar-link/handler.ts"
import { handler as billing } from "../supabase/functions/billing/handler.ts"
import { handler as conversationInsights } from "../supabase/functions/conversation-insights/handler.ts"
import { handler as exportShare } from "../supabase/functions/export-share/handler.ts"
import { handler as stripeWebhook } from "../supabase/functions/stripe-webhook/handler.ts"
import { handler as usageCheck } from "../supabase/functions/usage-check/handler.ts"
import { handler as invoiceExport } from "../supabase/functions/invoice-export/handler.ts"
import { handler as tavusPal } from "../supabase/functions/tavus-pal/handler.ts"
import { handler as knowledgePage } from "../supabase/functions/knowledge-page/handler.ts"
import { handler as knowledgePublish } from "../supabase/functions/knowledge-publish/handler.ts"
import { handler as tavusBackfill } from "../supabase/functions/tavus-backfill/handler.ts"
import { handler as tavusSync } from "../supabase/functions/tavus-sync/handler.ts"
import { handler as tavusWebhook } from "../supabase/functions/tavus-webhook/handler.ts"
import { handler as userInvite } from "../supabase/functions/user-invite/handler.ts"

const routes: Record<string, (req: Request) => Promise<Response>> = {
  "avatar-link": avatarLink,
  billing,
  "conversation-insights": conversationInsights,
  "stripe-webhook": stripeWebhook,
  "usage-check": usageCheck,
  "export-share": exportShare,
  "invoice-export": invoiceExport,
  "tavus-pal": tavusPal,
  "knowledge-page": knowledgePage,
  "knowledge-publish": knowledgePublish,
  "tavus-backfill": tavusBackfill,
  "tavus-sync": tavusSync,
  "tavus-webhook": tavusWebhook,
  "user-invite": userInvite,
}

const port = Number(Deno.env.get("FUNCTIONS_PORT") ?? 54399)

Deno.serve({ port, hostname: "127.0.0.1" }, (req) => {
  if (new URL(req.url).pathname === "/health") return new Response("ok")
  const name = new URL(req.url).pathname.match(/^\/functions\/v1\/([^/]+)/)?.[1]
  const handler = name ? routes[name] : undefined
  if (!handler) return new Response(JSON.stringify({ error: "No such function" }), { status: 404 })
  return handler(req)
})
