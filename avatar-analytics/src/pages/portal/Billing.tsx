import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Download, ExternalLink, PauseCircle, XCircle } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { StatusPill } from "@/components/StatusPill"
import { TableScroll } from "@/components/TableScroll"
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { DateRangeControl, type RangeState } from "@/components/DateRangeControl"
import { Input } from "@/components/ui/input"
import { billingAction, downloadInvoices, getBillingSummary, getTopupCustomRule, listInvoices, listPlans, type BillingSummary, type Plan, type TopupCustomRule } from "@/lib/api"
import { formatDay, formatRange, presetRange, todayIn } from "@/lib/dates"
import { count, minutes, money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { usePortalClient } from "@/pages/portal/PortalLayout"
import { COMPANY } from "@/lib/edition"

const dayOf = (iso: string | null, timeZone: string) =>
  iso ? new Intl.DateTimeFormat("en-US", { timeZone, month: "long", day: "numeric", year: "numeric" }).format(new Date(iso)) : "the end of this period"

function SubscriptionPill({ summary }: { summary: BillingSummary }) {
  if (summary.paused_for_usage) return <StatusPill tone="warn" icon={<PauseCircle />}>Paused: minutes used up</StatusPill>
  if (summary.cancel_at_period_end && summary.has_subscription) return <StatusPill tone="warn" icon={<Clock />}>Ending soon</StatusPill>
  switch (summary.status) {
    case "active": return <StatusPill tone="ok" icon={<CheckCircle2 />}>Active</StatusPill>
    case "trialing": return <StatusPill tone="info" icon={<Clock />}>Trial</StatusPill>
    case "past_due":
    case "unpaid": return <StatusPill tone="bad" icon={<AlertTriangle />}>Payment needed</StatusPill>
    case "cancelled": return <StatusPill tone="bad" icon={<XCircle />}>Ended</StatusPill>
    case "incomplete": return <StatusPill tone="info" icon={<Clock />}>Waiting for payment</StatusPill>
    default: return <StatusPill tone="neutral" icon={<Clock />}>No subscription</StatusPill>
  }
}

/** Any whole-dollar amount in the allowed range, with the minutes it buys shown as the person types. */
function CustomAmount({ rule, busy, onPay }: { rule: TopupCustomRule; busy: boolean; onPay: (amountCents: number) => void }) {
  const id = useId()
  const [value, setValue] = useState("")
  const [problem, setProblem] = useState("")
  const min = rule.min_cents / 100
  const max = rule.max_cents / 100
  const dollars = Number(value)
  const valid = value.trim() !== "" && Number.isInteger(dollars) && dollars >= min && dollars <= max
  const buys = valid ? Math.floor(dollars * rule.minutes_per_dollar) : 0
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || buys < 1) return setProblem(`Enter a whole number of dollars from ${money(rule.min_cents, rule.currency)} to ${money(rule.max_cents, rule.currency)}.`)
    setProblem("")
    onPay(dollars * 100)
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-amount`}>Or enter another amount (US dollars)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`${id}-amount`} inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value.replace(/[^0-9]/g, "")); setProblem("") }}
          className="min-h-11 w-32" autoComplete="off" placeholder={String(min)} aria-invalid={problem ? true : undefined} aria-describedby={`${id}-help${problem ? ` ${id}-problem` : ""}`}
        />
        <Button type="submit" variant="outline" className="min-h-11" disabled={busy}>Add minutes</Button>
        <p role="status" className="text-sm font-medium">{valid && buys > 0 ? `${money(dollars * 100, rule.currency)} adds ${count(buys)} minutes` : ""}</p>
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">Whole dollars, from {money(rule.min_cents, rule.currency)} to {money(rule.max_cents, rule.currency)}.</p>
      {problem && <p id={`${id}-problem`} role="alert" className="text-sm font-medium text-bad">{problem}</p>}
    </form>
  )
}

/** How much of the period's included minutes are used, in words and as a bar. */
function UsageMeter({ summary, onTopUp, busy, custom }: { summary: BillingSummary; onTopUp?: (amountCents: number) => void; busy: boolean; custom?: TopupCustomRule | null }) {
  const id = useId()
  if (!summary.plan || summary.included_seconds == null) return null
  const percent = summary.used_percent ?? 0
  const total = summary.plan.included_minutes + summary.extra_minutes
  const left = Math.max(0, summary.included_seconds - summary.used_seconds)
  const tone = percent >= 100 ? "bg-bad" : percent >= 90 ? "bg-warn" : "bg-brand"
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
      <h2 id={`${id}-title`} className="text-base font-semibold">Talk Time This Period</h2>
      <p className="text-sm text-muted-foreground">{formatDay(summary.period_start)} to {formatDay(summary.period_end, true)}</p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="tabular font-display text-4xl font-semibold">{minutes(summary.used_seconds)}</span>
        <span className="text-muted-foreground">of {count(total)} minutes used ({Math.floor(percent)}%)</span>
      </p>
      {summary.extra_minutes > 0 && (
        <p className="text-sm text-muted-foreground">{count(summary.plan.included_minutes)} minutes from your package, plus {count(summary.extra_minutes)} extra minutes you added this period.</p>
      )}
      <div
        role="progressbar" aria-labelledby={`${id}-title`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.floor(percent))}
        aria-valuetext={`${minutes(summary.used_seconds)} of ${count(total)} minutes used`}
        className="h-3 overflow-hidden rounded-full border bg-muted"
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">
        {percent >= 100
          ? "All of this period's minutes are used."
          : `${minutes(left)} minutes left. If they run out, your avatars pause until the next period starts, or until you add minutes or choose a larger package.`}
      </p>
      {onTopUp && summary.topup_options.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 id={`${id}-more`} className="text-sm font-semibold">Add Minutes to This Period</h3>
          <p className="text-sm text-muted-foreground">
            A one-time payment on Stripe's secure page, without changing your package. The minutes are added as soon as you pay{summary.paused_for_usage ? ", and your avatars turn back on" : ""}. They last until {formatDay(summary.period_end, true)}.
          </p>
          <ul aria-labelledby={`${id}-more`} className="flex flex-wrap gap-2">
            {summary.topup_options.map((option) => (
              <li key={option.amount_cents}>
                <Button variant="gold" className="min-h-12 flex-col gap-0 px-5" disabled={busy} onClick={() => onTopUp(option.amount_cents)}>
                  <span className="text-base font-semibold">{money(option.amount_cents, summary.plan!.currency)}</span>
                  <span className="text-xs font-medium"><span className="sr-only">for </span>{count(option.minutes)} minutes</span>
                </Button>
              </li>
            ))}
          </ul>
          {custom && <CustomAmount rule={custom} busy={busy} onPay={onTopUp} />}
        </div>
      )}
    </section>
  )
}

function PlanCard({ plan, current, action }: { plan: Plan; current: boolean; action?: React.ReactNode }) {
  return (
    <li className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4", current && "border-2 border-brand")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{plan.name}</h3>
        {current && <StatusPill tone="ok" icon={<CheckCircle2 />}>Your package</StatusPill>}
      </div>
      <p><span className="tabular font-display text-3xl font-semibold">{money(plan.monthly_price_cents, plan.currency)}</span> <span className="text-sm text-muted-foreground">a month</span></p>
      <ul className="flex flex-col gap-1 text-sm">
        <li><strong>{count(plan.included_minutes)}</strong> minutes of talk time each month</li>
        {plan.max_concurrent && <li>Up to <strong>{plan.max_concurrent}</strong> call{plan.max_concurrent === 1 ? "" : "s"} at the same time</li>}
      </ul>
      {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
      {action && <div className="mt-auto pt-1">{action}</div>}
    </li>
  )
}

export default function Billing() {
  const client = usePortalClient()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const canManage = can("billing.manage")
  const reasonId = useId()
  const [changing, setChanging] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("")

  const justPaid = params.get("checkout") === "done"
  const justToppedUp = params.get("topup") === "done"
  const minutesBefore = useRef<number | null>(null)
  const summary = useQuery({
    queryKey: ["billing", client.id],
    queryFn: () => getBillingSummary(client.id),
    // Stripe confirms a new subscription a few seconds after the person returns.
    refetchInterval: (query) => ((justPaid && !query.state.data?.has_subscription) || justToppedUp ? 2000 : false),
  })
  const plans = useQuery({ queryKey: ["plans"], queryFn: listPlans })
  const today = todayIn(client.timezone)
  const [period, setPeriod] = useState<RangeState>({ preset: "year", range: presetRange("year", today) })
  const invoices = useQuery({ queryKey: ["invoices", client.id, period.range.from, period.range.to], queryFn: () => listInvoices(client.id, period.range) })
  const custom = useQuery({ queryKey: ["topup-custom", client.id], queryFn: () => getTopupCustomRule(client.id) })
  const downloadAll = useMutation({
    mutationFn: () => downloadInvoices(client.id, period.range),
    onSuccess: async (file) => {
      const { saveFile } = await import("@/lib/pdf")
      saveFile(new Uint8Array(await file.blob.arrayBuffer()), file.filename, "application/zip")
      toast.success(file.missing > 0
        ? `Downloaded ${count(file.count - file.missing)} of ${count(file.count)} invoices. The summary lists the rest with links.`
        : `Downloaded ${count(file.count)} invoice${file.count === 1 ? "" : "s"} with a summary`)
    },
    onError: (err) => toast.error((err as Error).message),
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["billing", client.id] })
    void queryClient.invalidateQueries({ queryKey: ["invoices", client.id] })
    void queryClient.invalidateQueries({ queryKey: ["topup-custom", client.id] })
    void queryClient.invalidateQueries({ queryKey: ["client", client.slug] })
  }

  useEffect(() => {
    if (justPaid && summary.data?.has_subscription) {
      toast.success("Thank you. Your subscription is active.")
      setParams({}, { replace: true })
    }
  }, [justPaid, summary.data?.has_subscription, setParams])

  // Back from paying for extra minutes: Stripe confirms a moment later, so watch for the total to rise.
  useEffect(() => {
    if (!justToppedUp || !summary.data) return
    if (minutesBefore.current === null) {
      minutesBefore.current = summary.data.extra_minutes
      const giveUp = setTimeout(() => setParams({}, { replace: true }), 20_000)
      return () => clearTimeout(giveUp)
    }
    if (summary.data.extra_minutes > minutesBefore.current) {
      toast.success(`Thank you. ${count(summary.data.extra_minutes - minutesBefore.current)} minutes were added.`)
      setParams({}, { replace: true })
      void queryClient.invalidateQueries({ queryKey: ["client", client.slug] })
    }
  }, [justToppedUp, summary.data, setParams, queryClient, client.slug])

  /** Sends the person to one of Stripe's own pages. */
  const goToStripe = useMutation({
    mutationFn: (body: { action: "checkout"; plan_id: string } | { action: "portal" } | { action: "topup"; amount_cents: number }) => billingAction(client.id, body),
    onSuccess: (result) => { if (result.url) window.location.assign(result.url) },
    onError: (err) => toast.error((err as Error).message),
  })
  const change = useMutation({
    mutationFn: (plan: Plan) => billingAction(client.id, { action: "change_plan", plan_id: plan.id }),
    onSuccess: (result, plan) => {
      setChanging(false)
      toast.success(result.resumed ? `Your package is now ${plan.name}, and your avatars are back on.` : `Your package is now ${plan.name}.`)
      refresh()
    },
    onError: (err) => toast.error((err as Error).message),
  })
  const cancel = useMutation({
    mutationFn: () => billingAction(client.id, { action: "cancel", reason }),
    onSuccess: (result) => {
      setCancelling(false)
      setReason("")
      toast.success(`Your subscription will end on ${dayOf(result.ends_at ?? null, client.timezone)}.`)
      refresh()
    },
    onError: (err) => toast.error((err as Error).message),
  })
  const keep = useMutation({
    mutationFn: () => billingAction(client.id, { action: "resume" }),
    onSuccess: () => { toast.success("Your subscription continues."); refresh() },
    onError: (err) => toast.error((err as Error).message),
  })

  if (summary.isPending || plans.isPending) return <><PageHeader title="Billing" /><LoadingBlock label="Loading billing" /></>
  if (summary.isError) return <><PageHeader title="Billing" /><ErrorBlock error={summary.error} onRetry={() => void summary.refetch()} /></>
  const s = summary.data
  const offered = (plans.data ?? []).filter((p) => p.is_active)
  const busy = goToStripe.isPending || change.isPending || cancel.isPending || keep.isPending

  return (
    <>
      <PageHeader title="Billing" description="Your package, how much of it you have used, and your invoices." />

      {s.has_subscription && s.plan ? (
        <>
          <section aria-labelledby="package-title" className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="package-title" className="text-base font-semibold">Your Package</h2>
              <SubscriptionPill summary={s} />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-display text-2xl font-semibold">{s.plan.name}</p>
                <p><span className="tabular font-display text-4xl font-semibold">{money(s.plan.monthly_price_cents, s.plan.currency)}</span> <span className="text-muted-foreground">a month</span></p>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                <li><strong>{count(s.plan.included_minutes)}</strong> minutes of talk time each month</li>
                {s.plan.max_concurrent && <li>Up to <strong>{s.plan.max_concurrent}</strong> call{s.plan.max_concurrent === 1 ? "" : "s"} at the same time</li>}
              </ul>
            </div>
            <p className="text-sm">
              {s.cancel_at_period_end
                ? <>Your subscription is cancelled and <strong>ends on {dayOf(s.renews_at, client.timezone)}</strong>. Your avatars keep working until then, and you will not be charged again.</>
                : s.status === "past_due" || s.status === "unpaid"
                  ? <>Your last payment did not go through. Update your payment method to keep your avatars running.</>
                  : <>Your next payment of {money(s.plan.monthly_price_cents, s.plan.currency)} is on <strong>{dayOf(s.renews_at, client.timezone)}</strong>.</>}
            </p>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                {!s.cancel_at_period_end && <Button className="min-h-10" disabled={busy} onClick={() => setChanging(true)}>Change package</Button>}
                <Button variant="outline" className="min-h-10" disabled={busy} onClick={() => goToStripe.mutate({ action: "portal" })}>
                  <CreditCard aria-hidden="true" />Payment method<ExternalLink aria-hidden="true" /><span className="sr-only">(opens Stripe)</span>
                </Button>
                {s.cancel_at_period_end
                  ? <Button variant="outline" className="min-h-10" disabled={busy} onClick={() => keep.mutate()}>{keep.isPending ? "Saving…" : "Keep my subscription"}</Button>
                  : <Button variant="outline" className="min-h-10" disabled={busy} onClick={() => setCancelling(true)}>Cancel subscription</Button>}
              </div>
            )}
          </section>
          {justToppedUp && <p role="status" className="rounded-lg bg-info-soft p-3 text-sm">Thank you. We are confirming your payment; your extra minutes appear here in a few seconds.</p>}
          <UsageMeter summary={s} busy={busy} custom={canManage ? custom.data : null} onTopUp={canManage ? (amount_cents) => goToStripe.mutate({ action: "topup", amount_cents }) : undefined} />
        </>
      ) : (
        <section aria-labelledby="choose-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="choose-title" className="text-lg font-semibold">{s.status === "cancelled" ? "Your Subscription Has Ended" : "Choose a Package"}</h2>
            <SubscriptionPill summary={s} />
          </div>
          {justPaid && <p role="status" className="rounded-lg bg-info-soft p-3 text-sm">Thank you. We are confirming your payment; this page updates by itself in a few seconds.</p>}
          {offered.length === 0 ? (
            <EmptyState title="No Packages Are Available Yet">{COMPANY} is still setting up your packages. Check back soon.</EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {offered.map((plan) => (
                <PlanCard key={plan.id} plan={plan} current={false} action={canManage && (
                  <Button className="min-h-10 w-full" disabled={busy || !plan.stripe_price_id} onClick={() => goToStripe.mutate({ action: "checkout", plan_id: plan.id })} aria-label={`Subscribe to ${plan.name}`}>
                    {plan.stripe_price_id ? "Subscribe" : "Not available yet"}
                  </Button>
                )} />
              ))}
            </ul>
          )}
          {canManage && offered.length > 0 && <p className="text-sm text-muted-foreground">Payment is taken on Stripe's secure page. You can pay by card, Apple Pay, Google Pay or PayPal where available, and cancel at any time.</p>}
        </section>
      )}

      <section aria-labelledby="invoices-title" className="flex flex-col gap-3">
        <h2 id="invoices-title" className="text-lg font-semibold">Invoices</h2>
        <DateRangeControl value={period} onChange={setPeriod} today={today} />
        {!invoices.isPending && !invoices.isError && invoices.data.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-muted-foreground">{count(invoices.data.length)} invoice{invoices.data.length === 1 ? "" : "s"} · {formatRange(period.range)}</p>
            <Button variant="outline" className="min-h-10" disabled={downloadAll.isPending} onClick={() => downloadAll.mutate()}>
              <Download aria-hidden="true" />{downloadAll.isPending ? "Preparing…" : "Download these invoices (ZIP)"}
            </Button>
          </div>
        )}
        {invoices.isPending ? <LoadingBlock label="Loading invoices" /> : invoices.isError ? <ErrorBlock error={invoices.error} /> : invoices.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices in this period. Choose a longer period to look further back. Each invoice is also emailed to you when it is issued.</p>
        ) : (
          <TableScroll label="Invoices table" className="rounded-lg border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Invoices, newest first</caption>
              <thead>
                <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Invoice</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Date</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide">Amount</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Status</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium">{invoice.number ?? "Invoice"}</th>
                    <td className="tabular px-4 py-3">{dayOf(invoice.issued_at, client.timezone)}</td>
                    <td className="tabular px-4 py-3 text-right">{money(invoice.status === "paid" ? invoice.amount_paid_cents : invoice.amount_due_cents, invoice.currency)}</td>
                    <td className="px-4 py-3">
                      {invoice.status === "paid" ? <StatusPill tone="ok" icon={<CheckCircle2 />}>Paid</StatusPill>
                        : invoice.status === "open" ? <StatusPill tone="warn" icon={<Clock />}>Due</StatusPill>
                          : <StatusPill tone="neutral" icon={<XCircle />}>{invoice.status === "void" ? "Cancelled" : invoice.status === "uncollectible" ? "Unpaid" : invoice.status}</StatusPill>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(invoice.invoice_pdf || invoice.hosted_invoice_url) && (
                        <Button asChild variant="outline" size="sm" className="min-h-9">
                          <a href={invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? "#"} target="_blank" rel="noreferrer" aria-label={`${invoice.invoice_pdf ? "Download" : "View"} invoice ${invoice.number ?? ""} (opens in a new tab)`}>
                            {invoice.invoice_pdf ? "Download" : "View"}<ExternalLink aria-hidden="true" />
                          </a>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      <Dialog open={changing} onOpenChange={(open) => !busy && setChanging(open)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Change Package</DialogTitle>
            <DialogDescription>
              The change takes effect straight away. Your next invoice adjusts for the part of this period you have already paid for.
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offered.map((plan) => {
              const current = plan.id === s.plan?.id
              return (
                <PlanCard key={plan.id} plan={plan} current={current} action={!current && (
                  <Button className="min-h-10 w-full" disabled={busy || !plan.stripe_price_id} onClick={() => change.mutate(plan)} aria-label={`Switch to ${plan.name}`}>
                    {change.isPending && change.variables?.id === plan.id ? "Switching…" : plan.stripe_price_id ? `Switch to ${plan.name}` : "Not available yet"}
                  </Button>
                )} />
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelling} onOpenChange={(open) => !busy && setCancelling(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Your Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your avatars keep working until {dayOf(s.renews_at, client.timezone)}, then stop taking calls. You will not be charged again. Your conversations and transcripts stay available to download, and you can change your mind any time before that date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={reasonId}>Why are you cancelling? (optional)</Label>
            <textarea id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} className="min-h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-10" disabled={busy}>Keep my subscription</AlertDialogCancel>
            <Button variant="destructive" className="min-h-10" disabled={busy} onClick={() => cancel.mutate()}>{cancel.isPending ? "Cancelling…" : "Cancel subscription"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
