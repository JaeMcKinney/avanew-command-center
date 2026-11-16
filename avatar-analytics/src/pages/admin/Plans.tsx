import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Circle, Plus } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { StatusPill } from "@/components/StatusPill"
import { TableScroll } from "@/components/TableScroll"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { getUsageRules, listPlans, savePlan, saveUsageRules, type Plan, type UsageRules } from "@/lib/api"
import { count, money } from "@/lib/format"

type Draft = { name: string; description: string; price: string; minutes: string; concurrent: string; stripe: string; active: boolean; sort: string }
const emptyDraft: Draft = { name: "", description: "", price: "", minutes: "", concurrent: "", stripe: "", active: true, sort: "0" }
const draftOf = (plan: Plan): Draft => ({
  name: plan.name, description: plan.description, price: (plan.monthly_price_cents / 100).toString(), minutes: String(plan.included_minutes),
  concurrent: plan.max_concurrent ? String(plan.max_concurrent) : "", stripe: plan.stripe_price_id ?? "", active: plan.is_active, sort: String(plan.sort),
})

function PlanDialog({ plan, onClose }: { plan: Plan | "new"; onClose: (saved: boolean) => void }) {
  const id = useId()
  const [draft, setDraft] = useState<Draft>(plan === "new" ? emptyDraft : draftOf(plan))
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const save = useMutation({
    mutationFn: () => savePlan(plan === "new" ? null : plan.id, {
      name: draft.name.trim(), description: draft.description.trim(), monthly_price_cents: Math.round(Number(draft.price) * 100),
      included_minutes: Number(draft.minutes), max_concurrent: draft.concurrent ? Number(draft.concurrent) : null,
      stripe_price_id: draft.stripe.trim() || null, is_active: draft.active, sort: Number(draft.sort) || 0,
    }),
    onSuccess: () => { toast.success(plan === "new" ? "Package added" : "Package saved"); onClose(true) },
    onError: (err) => toast.error((err as Error).message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    if (!draft.name.trim()) found.name = "Give the package a name"
    if (draft.price === "" || !(Number(draft.price) >= 0)) found.price = "Enter the monthly price, for example 397"
    if (!(Number.isInteger(Number(draft.minutes)) && Number(draft.minutes) > 0)) found.minutes = "Enter the minutes included each month, as a whole number"
    if (draft.concurrent && !(Number.isInteger(Number(draft.concurrent)) && Number(draft.concurrent) > 0)) found.concurrent = "Enter a whole number, or leave it empty"
    if (draft.stripe.trim() && !/^price_[A-Za-z0-9]+$/.test(draft.stripe.trim())) found.stripe = "A Stripe price ID starts with price_"
    setErrors(found)
    if (Object.keys(found).length === 0) save.mutate()
  }
  const field = (key: keyof Draft, label: string, help: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Input
        id={`${id}-${key}`} value={draft[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)} className="min-h-11" autoComplete="off"
        aria-invalid={errors[key] ? true : undefined} aria-describedby={`${id}-${key}-help${errors[key] ? ` ${id}-${key}-error` : ""}`} {...props}
      />
      <p id={`${id}-${key}-help`} className="text-xs text-muted-foreground">{help}</p>
      {errors[key] && <p id={`${id}-${key}-error`} role="alert" className="text-sm font-medium text-bad">{errors[key]}</p>}
    </div>
  )

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose(false)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{plan === "new" ? "Add a Package" : `Edit ${plan.name}`}</DialogTitle>
          <DialogDescription>What clients see on their Billing page. The price charged is the one on the Stripe price; keep the two the same.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {field("name", "Name", "For example Growth.")}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("price", "Monthly price (US dollars)", "Shown to clients.", { inputMode: "decimal" })}
            {field("minutes", "Minutes included each month", "Talk time before avatars pause.", { inputMode: "numeric" })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("concurrent", "Calls at the same time (optional)", "Shown to clients. Not yet enforced in Tavus.", { inputMode: "numeric" })}
            {field("sort", "Order", "Lower numbers show first.", { inputMode: "numeric" })}
          </div>
          {field("stripe", "Stripe price ID", "From the recurring price in your Stripe dashboard. Clients cannot subscribe until this is set.", { placeholder: "price_…" })}
          {field("description", "Short description (optional)", "One line under the package.")}
          <div className="flex items-start gap-3">
            <Checkbox id={`${id}-active`} className="mt-0.5 size-5" checked={draft.active} onCheckedChange={(on) => set({ active: on === true })} />
            <div>
              <Label htmlFor={`${id}-active`}>Offer this package to clients</Label>
              <p className="text-xs text-muted-foreground">Untick to retire it. Clients already on it stay on it.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-10" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save package"}</Button>
            <Button type="button" variant="outline" className="min-h-10" disabled={save.isPending} onClick={() => onClose(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const amountsOf = (text: string) => text.split(",").map((part) => part.trim().replace(/^\$/, "")).filter(Boolean).map(Number)

function UsageRulesForm({ initial }: { initial: UsageRules }) {
  const id = useId()
  const [rules, setRules] = useState({
    alert: String(initial.alertPercent), pause: String(initial.pausePercent), enabled: initial.pauseEnabled,
    amounts: initial.topupAmountsCents.map((c) => c / 100).join(", "), rate: String(initial.topupRatePercent),
    customMin: String(initial.customMinCents / 100), customMax: String(initial.customMaxCents / 100),
  })
  const [problem, setProblem] = useState("")
  const save = useMutation({
    mutationFn: () => saveUsageRules({
      alertPercent: Number(rules.alert), pauseEnabled: rules.enabled, pausePercent: Number(rules.pause),
      topupAmountsCents: amountsOf(rules.amounts).map((dollars) => Math.round(dollars * 100)), topupRatePercent: Number(rules.rate),
      customMinCents: Math.round(Number(rules.customMin) * 100), customMaxCents: Math.round(Number(rules.customMax) * 100),
    }),
    onSuccess: () => toast.success("Usage rules saved"),
    onError: (err) => toast.error((err as Error).message),
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const alert = Number(rules.alert), pause = Number(rules.pause)
    if (!(alert >= 1 && alert <= 100) || !(pause >= 1 && pause <= 500)) return setProblem("Enter percentages as whole numbers, for example 90 and 100.")
    if (rules.enabled && alert >= pause) return setProblem("The warning must come before the pause.")
    const amounts = amountsOf(rules.amounts)
    if (amounts.some((a) => !(a >= 1 && a <= 1000)) || amounts.length > 6) return setProblem("Enter up to six extra-minute amounts in dollars, separated by commas, for example 10, 20, 50. Leave it empty to turn extra minutes off.")
    if (!(Number(rules.rate) >= 1 && Number(rules.rate) <= 1000)) return setProblem("Enter the extra-minute price as a percentage, for example 100.")
    const min = Number(rules.customMin), max = Number(rules.customMax)
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || (min > 0 && max < min)) return setProblem("Enter the smallest and largest custom amounts in whole dollars. Use 0 as the smallest to turn custom amounts off.")
    setProblem("")
    save.mutate()
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-alert`}>Send one warning email at (% of minutes used)</Label>
          <Input id={`${id}-alert`} inputMode="numeric" value={rules.alert} onChange={(e) => setRules({ ...rules, alert: e.target.value })} className="min-h-11 max-w-32" aria-describedby={problem ? `${id}-problem` : undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-pause`}>Pause avatars at (% of minutes used)</Label>
          <Input id={`${id}-pause`} inputMode="numeric" value={rules.pause} onChange={(e) => setRules({ ...rules, pause: e.target.value })} className="min-h-11 max-w-32" disabled={!rules.enabled} aria-describedby={problem ? `${id}-problem` : undefined} />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id={`${id}-enabled`} className="mt-0.5 size-5" checked={rules.enabled} onCheckedChange={(on) => setRules({ ...rules, enabled: on === true })} />
        <div>
          <Label htmlFor={`${id}-enabled`}>Pause a client's avatars when their minutes are used up</Label>
          <p className="text-xs text-muted-foreground">They turn back on when the next period starts, or when the client moves to a larger package. The client and the Owner are emailed.</p>
        </div>
      </div>
      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-amounts`}>Extra-minute amounts clients can pay (US dollars)</Label>
          <Input id={`${id}-amounts`} value={rules.amounts} onChange={(e) => setRules({ ...rules, amounts: e.target.value })} className="min-h-11" aria-describedby={`${id}-amounts-help${problem ? ` ${id}-problem` : ""}`} />
          <p id={`${id}-amounts-help`} className="text-xs text-muted-foreground">Separated by commas. Clients pay one of these on Stripe to add minutes for the current period, without changing package.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-rate`}>Price of an extra minute (% of the package's price per minute)</Label>
          <Input id={`${id}-rate`} inputMode="numeric" value={rules.rate} onChange={(e) => setRules({ ...rules, rate: e.target.value })} className="min-h-11 max-w-32" aria-describedby={`${id}-rate-help${problem ? ` ${id}-problem` : ""}`} />
          <p id={`${id}-rate-help`} className="text-xs text-muted-foreground">100 charges the same per minute as their package. 125 charges a quarter more.</p>
        </div>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Custom Amount (US Dollars)</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-cmin`}>Smallest amount a client can enter</Label>
          <Input id={`${id}-cmin`} inputMode="numeric" value={rules.customMin} onChange={(e) => setRules({ ...rules, customMin: e.target.value })} className="min-h-11 max-w-32" aria-describedby={`${id}-cmin-help`} />
          <p id={`${id}-cmin-help`} className="text-xs text-muted-foreground">Use 0 to offer only the fixed amounts above.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-cmax`}>Largest amount a client can enter</Label>
          <Input id={`${id}-cmax`} inputMode="numeric" value={rules.customMax} onChange={(e) => setRules({ ...rules, customMax: e.target.value })} className="min-h-11 max-w-32" />
        </div>
      </fieldset>
      {problem && <p id={`${id}-problem`} role="alert" className="text-sm font-medium text-bad">{problem}</p>}
      <div><Button type="submit" className="min-h-10" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save usage rules"}</Button></div>
    </form>
  )
}

export default function Plans() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const plans = useQuery({ queryKey: ["plans"], queryFn: listPlans })
  const rules = useQuery({ queryKey: ["usage-rules"], queryFn: getUsageRules })
  const [editing, setEditing] = useState<Plan | "new" | null>(null)

  return (
    <>
      <PageHeader
        title="Packages"
        description="The packages clients can subscribe to, and what happens when a client uses up their minutes."
        actions={<Button className="min-h-10" onClick={() => setEditing("new")}><Plus aria-hidden="true" />Add a package</Button>}
      />
      {plans.isPending ? <LoadingBlock label="Loading packages" /> : plans.isError ? <ErrorBlock error={plans.error} onRetry={() => void plans.refetch()} /> : plans.data.length === 0 ? (
        <EmptyState title="No Packages Yet" action={<Button className="min-h-10" onClick={() => setEditing("new")}>Add a package</Button>}>
          Add the packages you sell. Each one needs a matching recurring price in Stripe.
        </EmptyState>
      ) : (
        <TableScroll label="Packages table" className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Packages</caption>
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Package</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide">Price a Month</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide">Minutes</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide">Calls at Once</th>
                <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Status</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {plans.data.map((plan) => (
                <tr key={plan.id} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">{plan.name}</th>
                  <td className="tabular px-4 py-3 text-right">{money(plan.monthly_price_cents, plan.currency)}</td>
                  <td className="tabular px-4 py-3 text-right">{count(plan.included_minutes)}</td>
                  <td className="tabular px-4 py-3 text-right">{plan.max_concurrent ?? "—"}</td>
                  <td className="px-4 py-3">
                    {!plan.is_active ? <StatusPill tone="neutral" icon={<Circle />}>Retired</StatusPill>
                      : plan.stripe_price_id ? <StatusPill tone="ok" icon={<CheckCircle2 />}>On offer</StatusPill>
                        : <StatusPill tone="warn" icon={<Circle />}>Needs a Stripe price</StatusPill>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" className="min-h-9" onClick={() => setEditing(plan)} aria-label={`Edit ${plan.name}`}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      <section aria-labelledby="rules-title" className="flex flex-col gap-3">
        <h2 id="rules-title" className="text-lg font-semibold">When Minutes Run Low</h2>
        {rules.isPending ? <LoadingBlock label="Loading rules" /> : rules.isError ? <ErrorBlock error={rules.error} /> : can("settings.manage") ? (
          <UsageRulesForm initial={rules.data} />
        ) : (
          <p className="text-sm text-muted-foreground">
            One warning email at {rules.data.alertPercent}% of the included minutes. {rules.data.pauseEnabled ? `Avatars pause at ${rules.data.pausePercent}%.` : "Avatars are not paused."} Only people who can change settings can edit these.
          </p>
        )}
      </section>

      {editing && <PlanDialog plan={editing} onClose={(saved) => { setEditing(null); if (saved) void queryClient.invalidateQueries({ queryKey: ["plans"] }) }} />}
    </>
  )
}
