// Billing rules shared by the functions: keeping a client's subscription in
// step with Stripe, and the usage check that warns, pauses and resumes.

import { type SupabaseClient, writeAudit } from "./clients.ts"
import { notify } from "./notify.ts"
import { periodOf, type StripeSubscription } from "./stripe.ts"
import { setDeploymentStatus } from "./tavus.ts"
import { brandName } from "./brand.ts"

const appUrl = () => (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "")
const billingLink = (slug: string) => `${appUrl()}/c/${slug}/billing`
const minutes = (seconds: number) => Math.round(seconds / 60).toLocaleString("en-US")
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "the end of the period"

const STATUS: Record<string, string> = {
  incomplete: "incomplete", trialing: "trialing", active: "active", past_due: "past_due", unpaid: "unpaid",
  canceled: "cancelled", incomplete_expired: "cancelled", paused: "past_due",
}

type Deployment = { deployment_id: string }

/** Turns off every live deployment of a client's avatars and remembers which, so they can be put back. */
async function switchOffDeployments(admin: SupabaseClient, clientId: string): Promise<{ off: string[]; failed: string[] }> {
  const { data: avatars } = await admin.from("avatars").select("tavus_pal_id").eq("client_id", clientId).is("unlinked_at", null)
  const palIds = (avatars ?? []).map((a) => a.tavus_pal_id)
  if (palIds.length === 0) return { off: [], failed: [] }
  const { data: live } = await admin.from("tavus_deployments").select("deployment_id").in("pal_id", palIds).eq("status", "active").is("removed_at", null)
  const off: string[] = []
  const failed: string[] = []
  for (const d of (live ?? []) as Deployment[]) {
    try {
      await setDeploymentStatus(d.deployment_id, "inactive")
      off.push(d.deployment_id)
    } catch (err) {
      console.error("could not pause deployment", d.deployment_id, (err as Error).message)
      failed.push(d.deployment_id)
    }
  }
  if (off.length) await admin.from("tavus_deployments").update({ status: "inactive" }).in("deployment_id", off)
  return { off, failed }
}

async function switchOnDeployments(admin: SupabaseClient, ids: string[]): Promise<string[]> {
  const on: string[] = []
  for (const id of ids) {
    try {
      await setDeploymentStatus(id, "active")
      on.push(id)
    } catch (err) {
      console.error("could not resume deployment", id, (err as Error).message)
    }
  }
  if (on.length) await admin.from("tavus_deployments").update({ status: "active" }).in("deployment_id", on)
  return on
}

type Standing = {
  client_id: string; client_name: string; client_status: string; slug: string
  period_start: string; period_end: string; used_seconds: number; included_seconds: number; used_percent: number
  paused_for_usage: boolean; plan: { name: string } | null
}

export type UsageCheckResult = { checked: number; alerted: number; paused: number; resumed: number }

/** Warns at the alert level, pauses at the limit, and resumes when a new period or a bigger package makes room. */
export async function checkUsage(admin: SupabaseClient, onlyClientId?: string): Promise<UsageCheckResult> {
  const { data: settingRows } = await admin.from("settings").select("key, value").in("key", ["usage.alert_percent", "usage.pause_enabled", "usage.pause_percent"])
  const setting = (key: string, fallback: number | boolean) => (settingRows ?? []).find((s) => s.key === key)?.value ?? fallback
  const alertAt = Number(setting("usage.alert_percent", 90))
  const pauseEnabled = setting("usage.pause_enabled", true) !== false
  const pauseAt = Number(setting("usage.pause_percent", 100))

  const { data, error } = await admin.rpc("usage_standings")
  if (error) throw new Error(error.message)
  const standings = ((data ?? []) as Standing[]).filter((s) => !onlyClientId || s.client_id === onlyClientId)
  const result: UsageCheckResult = { checked: standings.length, alerted: 0, paused: 0, resumed: 0 }

  for (const s of standings) {
    const used = minutes(s.used_seconds)
    const included = minutes(s.included_seconds)
    const over = pauseEnabled && s.used_percent >= pauseAt

    if (s.paused_for_usage && !over) {
      const { data: row } = await admin.from("client_billing").select("paused_deployments").eq("client_id", s.client_id).single()
      await switchOnDeployments(admin, (row?.paused_deployments ?? []) as string[])
      await admin.from("client_billing").update({ paused_for_usage_at: null, paused_deployments: [] }).eq("client_id", s.client_id)
      await admin.from("clients").update({ status: "active" }).eq("id", s.client_id).eq("status", "paused")
      await writeAudit(admin, { actorId: null, action: "client.resumed_usage", targetType: "client", targetId: s.client_id, clientId: s.client_id })
      await notify(admin, {
        clientId: s.client_id, kind: "usage_resumed", periodStart: s.period_start,
        subject: `Your avatars are back on (${s.client_name})`,
        text: `Good news: your avatars are taking calls again.\n\nYou have used ${used} of ${included} minutes in the current period.\n\n${billingLink(s.slug)}\n\n${brandName()}`,
        staffText: `${s.client_name}'s avatars have been turned back on. They have used ${used} of ${included} minutes in the current period.`,
        sms: `${brandName()}: your avatars are taking calls again.`,
      })
      result.resumed++
    } else if (over && !s.paused_for_usage && s.client_status === "active") {
      const { off, failed } = await switchOffDeployments(admin, s.client_id)
      await admin.from("client_billing").update({ paused_for_usage_at: new Date().toISOString(), paused_deployments: off }).eq("client_id", s.client_id)
      await admin.from("clients").update({ status: "paused" }).eq("id", s.client_id)
      await writeAudit(admin, { actorId: null, action: "client.paused_usage", targetType: "client", targetId: s.client_id, clientId: s.client_id, detail: { used_percent: s.used_percent, deployments_paused: off.length, deployments_failed: failed } })
      await notify(admin, {
        clientId: s.client_id, kind: "usage_paused", periodStart: s.period_start,
        subject: `Your avatars are paused: this period's minutes are used up (${s.client_name})`,
        text: `You have used all ${included} minutes included in your ${s.plan?.name ?? ""} package for this period, so your avatars have stopped taking new calls.\n\nThey start again automatically on ${day(s.period_end)}, when your next period begins. To turn them back on now, add extra minutes or choose a larger package:\n\n${billingLink(s.slug)}\n\n${brandName()}`,
        staffText: `${s.client_name} has used ${used} of ${included} minutes (${s.used_percent}%) and their avatars have been paused.${failed.length ? ` ${failed.length} deployment(s) could not be paused in Tavus and need a look.` : ""}`,
        sms: `${brandName()}: your included minutes are used up and your avatars are paused. Add minutes or choose a larger package to turn them back on: ${billingLink(s.slug)}`,
      })
      result.paused++
    } else if (!over && !s.paused_for_usage && s.used_percent >= alertAt) {
      const tally = await notify(admin, {
        clientId: s.client_id, kind: "usage_alert", periodStart: s.period_start,
        subject: `You have used ${Math.floor(s.used_percent)}% of this period's minutes (${s.client_name})`,
        text: `You have used ${used} of the ${included} minutes included in your ${s.plan?.name ?? ""} package for this period.\n\n${pauseEnabled ? `When the included minutes are used up, your avatars pause until your next period begins on ${day(s.period_end)}. ` : ""}To get more minutes now, add extra minutes or choose a larger package:\n\n${billingLink(s.slug)}\n\nThis is the only reminder you will get this period.\n\n${brandName()}`,
        staffText: `${s.client_name} has used ${used} of ${included} minutes (${s.used_percent}%) this period.`,
        sms: `${brandName()}: you have used ${Math.floor(s.used_percent)}% of this period's minutes. Details: ${billingLink(s.slug)}`,
      })
      if (tally.sent + tally.failed + tally.skipped > 0) result.alerted++
    }
  }
  return result
}

/** Copies what Stripe says about a subscription onto the client's billing record. */
export async function syncSubscription(admin: SupabaseClient, sub: StripeSubscription): Promise<string | null> {
  let clientId: string | null = null
  const { data: bySub } = await admin.from("client_billing").select("client_id").eq("stripe_subscription_id", sub.id).maybeSingle()
  clientId = bySub?.client_id ?? null
  if (!clientId) {
    const { data: byCustomer } = await admin.from("client_billing").select("client_id").eq("stripe_customer_id", sub.customer).maybeSingle()
    clientId = byCustomer?.client_id ?? null
  }
  if (!clientId) return null

  const status = STATUS[sub.status] ?? "past_due"
  const priceId = sub.items?.data?.[0]?.price?.id
  const { data: plan } = priceId ? await admin.from("plans").select("id").eq("stripe_price_id", priceId).maybeSingle() : { data: null }
  const period = periodOf(sub)
  const { data: before } = await admin.from("client_billing").select("status").eq("client_id", clientId).single()

  await admin.from("client_billing").update({
    stripe_subscription_id: sub.id,
    status,
    ...(plan ? { plan_id: plan.id } : {}),
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    ...(sub.cancel_at_period_end ? {} : { cancel_requested_at: null, cancel_reason: null }),
    updated_at: new Date().toISOString(),
  }).eq("client_id", clientId)

  const { data: client } = await admin.from("clients").select("name, status, slug").eq("id", clientId).single()
  if (status === "cancelled" && before?.status !== "cancelled") {
    // The paid period is over: stop the avatars and mark the client as cancelled.
    const { off } = await switchOffDeployments(admin, clientId)
    await admin.from("client_billing").update({ paused_deployments: off, paused_for_usage_at: null }).eq("client_id", clientId)
    await admin.from("clients").update({ status: "cancelled" }).eq("id", clientId)
    await writeAudit(admin, { actorId: null, action: "subscription.ended", targetType: "client", targetId: clientId, clientId })
    await notify(admin, {
      clientId, kind: "subscription_ended", periodStart: new Date().toISOString().slice(0, 10),
      subject: `Your subscription has ended (${client?.name})`,
      text: `Your subscription has ended and your avatars have stopped taking calls. Your past conversations and transcripts are still available to download.\n\nTo start again, choose a package:\n\n${billingLink(client?.slug ?? "")}\n\n${brandName()}`,
      staffText: `${client?.name}'s subscription has ended. Their avatars have been turned off.`,
      sms: `${brandName()}: your subscription has ended and your avatars are off.`,
    })
  } else if ((status === "active" || status === "trialing") && client && ["onboarding", "cancelled"].includes(client.status)) {
    const { data: row } = await admin.from("client_billing").select("paused_deployments").eq("client_id", clientId).single()
    await switchOnDeployments(admin, (row?.paused_deployments ?? []) as string[])
    await admin.from("client_billing").update({ paused_deployments: [] }).eq("client_id", clientId)
    await admin.from("clients").update({ status: "active" }).eq("id", clientId)
  }
  return clientId
}
