import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useId, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { saveAvanewLook } from "@/components/BrandForm"
import { DateRangeControl, type RangeState } from "@/components/DateRangeControl"
import { PageHeader } from "@/components/PageHeader"
import { Stat } from "@/components/Stat"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { StatusPill } from "@/components/StatusPill"
import { TableScroll } from "@/components/TableScroll"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createAgency, listAgencyUsage, type AgencyUsage } from "@/lib/api"
import { STARTER_THEME } from "@/lib/brand"
import { browserToday, formatRange, presetRange, timeAgo } from "@/lib/dates"
import { count, money, slugify } from "@/lib/format"

const selectClass = "min-h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-60"

// eslint-disable-next-line react-refresh/only-export-components
export function paymentLabel(agency: Pick<AgencyUsage, "payment_model" | "fee_cents">): string {
  if (!agency.payment_model) return "Not set"
  const amount = agency.fee_cents == null ? "" : `${money(agency.fee_cents)} `
  return agency.payment_model === "subscription" ? `${amount}a month`.trim() : `${amount}one time`.trim()
}

/** Dollars typed into a form, as cents. Null when the field is empty or not an amount. */
// eslint-disable-next-line react-refresh/only-export-components
export function toCents(text: string): number | null {
  const value = Number(text.replace(/[$,\s]/g, ""))
  return text.trim() && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null
}

function NewAgency({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [domain, setDomain] = useState("")
  const [look, setLook] = useState<"avanew" | "neutral" | "none">("neutral")
  const [model, setModel] = useState<"" | "one_time" | "subscription">("")
  const [fee, setFee] = useState("")
  const shortName = slug || slugify(name)

  const create = useMutation({
    mutationFn: async () => {
      const agency = await createAgency({ name, slug: shortName, domain: domain.trim().toLowerCase(), theme: look === "neutral" ? STARTER_THEME : null, payment_model: model, fee_cents: toCents(fee) })
      // Avanew's look comes with its logos, which are saved once the agency exists.
      if (look === "avanew") await saveAvanewLook(agency.id)
      return agency
    },
    onSuccess: async (agency) => {
      await queryClient.invalidateQueries({ queryKey: ["agencies"] })
      toast.success(`${agency.name} created.`)
      onOpenChange(false)
      navigate(`/admin/agencies/${agency.slug}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Agency</DialogTitle>
          <DialogDescription>An agency runs Avalytics for its own clients, under its own name and look. You invite its first Owner next.</DialogDescription>
        </DialogHeader>
        <form
          id={`${id}-form`} className="flex flex-col gap-4" noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim() && shortName) create.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>Agency Name</Label>
            <Input id={`${id}-name`} required value={name} onChange={(e) => setName(e.target.value)} className="min-h-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-slug`}>Short Name</Label>
            <Input id={`${id}-slug`} value={shortName} onChange={(e) => setSlug(e.target.value.toLowerCase())} aria-describedby={`${id}-slug-help`} className="min-h-10" />
            <p id={`${id}-slug-help`} className="text-xs text-muted-foreground">Lowercase letters, numbers and hyphens. Used in web addresses.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-domain`}>Sign-In Address (Optional)</Label>
            <Input id={`${id}-domain`} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="avalytics.example.com" aria-describedby={`${id}-domain-help`} className="min-h-10" />
            <p id={`${id}-domain-help`} className="text-xs text-muted-foreground">The address the agency's people will sign in at. Its sign-in page then wears the agency's look.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-look`}>Starting Look</Label>
            <select id={`${id}-look`} className={selectClass} value={look} onChange={(e) => setLook(e.target.value as typeof look)}>
              <option value="neutral">A neutral look, to adjust later</option>
              <option value="avanew">Avanew's look and logos</option>
              <option value="none">None yet (looks like Divigner until one is set)</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-model`}>How the Agency Pays</Label>
              <select id={`${id}-model`} className={selectClass} value={model} onChange={(e) => setModel(e.target.value as typeof model)}>
                <option value="">Not set</option>
                <option value="subscription">Subscription</option>
                <option value="one_time">One-time fee</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-fee`}>{model === "subscription" ? "Amount a Month" : "Amount"}</Label>
              <Input id={`${id}-fee`} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} disabled={!model} className="min-h-10" />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" className="min-h-10" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={`${id}-form`} className="min-h-10" disabled={!name.trim() || !shortName || create.isPending}>{create.isPending ? "Creating…" : "Create agency"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Agencies() {
  const today = browserToday()
  const [range, setRange] = useState<RangeState>({ preset: "month", range: presetRange("month", today) })
  const [creating, setCreating] = useState(false)
  const agencies = useQuery({ queryKey: ["agencies", range.range], queryFn: () => listAgencyUsage(range.range) })
  const rows = agencies.data ?? []
  const sum = (pick: (a: AgencyUsage) => number) => rows.reduce((total, a) => total + pick(a), 0)

  return (
    <>
      <PageHeader
        title="Agencies"
        description="Companies that run Avalytics for their own clients, under their own name and look. You see what each agency uses. Its clients, avatars and conversations are for the agency alone."
        actions={<Button className="min-h-11" onClick={() => setCreating(true)}><Plus aria-hidden="true" />New agency</Button>}
      />
      <NewAgency open={creating} onOpenChange={setCreating} />
      <DateRangeControl value={range} onChange={setRange} today={today} />

      {agencies.isPending ? <LoadingBlock label="Loading agencies" />
        : agencies.isError ? <ErrorBlock error={agencies.error} onRetry={() => void agencies.refetch()} />
        : rows.length === 0 ? (
          <EmptyState title="No Agencies Yet" action={<Button className="min-h-11" onClick={() => setCreating(true)}><Plus aria-hidden="true" />New agency</Button>}>
            Create one for each company that will sell Avalytics under its own brand.
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Agencies" value={count(rows.length)} note={`${count(rows.filter((a) => a.status === "active").length)} active`} />
              <Stat label="Their Clients" value={count(sum((a) => a.clients))} note={`${count(sum((a) => a.active_clients))} active`} />
              <Stat label="Avatars Linked" value={count(sum((a) => a.avatars))} />
              <Stat label="Talk Time" value={count(Math.round(sum((a) => a.minutes)))} unit="min" note={formatRange(range.range)} />
            </div>
            <TableScroll label="Table of agencies" className="rounded-lg border bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">Agencies and what each used, {formatRange(range.range)}</caption>
                <thead>
                  <tr className="border-b bg-muted/60 text-left text-xs tracking-wide uppercase">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Agency</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Pays</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Staff</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Clients</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Avatars</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Minutes</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Conversations</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Glass Questions</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Last Call</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <Link to={`/admin/agencies/${a.slug}`} className="font-medium text-primary-text hover:underline">{a.name}</Link>
                        <span className="block text-xs text-muted-foreground">{a.domain ?? "No sign-in address yet"}</span>
                      </th>
                      <td className="px-4 py-3">{a.status === "active" ? <StatusPill tone="ok">Active</StatusPill> : <StatusPill tone="warn">Paused</StatusPill>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{paymentLabel(a)}</td>
                      <td className="tabular px-4 py-3 text-right">{count(a.staff)}</td>
                      <td className="tabular px-4 py-3 text-right">{count(a.clients)}</td>
                      <td className="tabular px-4 py-3 text-right">{count(a.avatars)}</td>
                      <td className="tabular px-4 py-3 text-right font-medium">{count(Math.round(a.minutes))}</td>
                      <td className="tabular px-4 py-3 text-right">{count(a.conversations)}</td>
                      <td className="tabular px-4 py-3 text-right">{count(a.glass_questions)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.last_call_at ? timeAgo(a.last_call_at) : "None yet"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </>
        )}
    </>
  )
}
