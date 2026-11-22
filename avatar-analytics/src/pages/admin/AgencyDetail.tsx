import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserPlus } from "lucide-react"
import { useId, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { BrandForm } from "@/components/BrandForm"
import { ChartCard, Columns, DataTable } from "@/components/Charts"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { agencyUsageByDay, getAgency, inviteUser, listAgencyStaff, listAgencyUsage, listRoles, updateAgency, type Agency, type AgencyDetails } from "@/lib/api"
import { bucketColumns } from "@/lib/buckets"
import { seriesColor } from "@/lib/chartColors"
import { browserToday, formatDay, formatRange, presetRange, timeAgo } from "@/lib/dates"
import { count } from "@/lib/format"
import { paymentLabel, toCents } from "@/pages/admin/Agencies"

const selectClass = "min-h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-60"

/** What the agency used. Totals only: its clients' names never reach Divigner. */
function Usage({ agency }: { agency: Agency }) {
  const today = browserToday()
  const [range, setRange] = useState<RangeState>({ preset: "month", range: presetRange("month", today) })
  const totals = useQuery({ queryKey: ["agencies", range.range], queryFn: () => listAgencyUsage(range.range) })
  const days = useQuery({ queryKey: ["agency", agency.id, "days", range.range], queryFn: () => agencyUsageByDay(agency.id, range.range) })
  const row = totals.data?.find((a) => a.id === agency.id)

  if (totals.isPending || days.isPending) return <LoadingBlock label="Loading usage" />
  if (totals.isError) return <ErrorBlock error={totals.error} onRetry={() => void totals.refetch()} />
  if (days.isError) return <ErrorBlock error={days.error} onRetry={() => void days.refetch()} />
  const columns = bucketColumns(range.range, new Map(days.data.map((d) => [d.usage_date, d.minutes])), 1)

  return (
    <div className="flex flex-col gap-4">
      <DateRangeControl value={range} onChange={setRange} today={today} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Talk Time" value={count(Math.round(row?.minutes ?? 0))} unit="min" note={formatRange(range.range)} highlight />
        <Stat label="Conversations" value={count(row?.conversations ?? 0)} note={row?.last_call_at ? `Last call ${timeAgo(row.last_call_at)}` : "No calls yet"} />
        <Stat label="Clients" value={count(row?.clients ?? 0)} note={`${count(row?.active_clients ?? 0)} active · ${count(row?.avatars ?? 0)} avatars`} />
        <Stat label="Glass Questions" value={count(row?.glass_questions ?? 0)} note="Answered for its clinical avatars" />
      </div>
      <ChartCard
        title="Talk Time Over Time"
        subtitle={`Minutes across all of ${agency.name}'s clients · ${formatRange(range.range)}`}
        chart={<Columns columns={columns} unit="min" color={seriesColor(0)} />}
        table={<DataTable caption={`${agency.name}: minutes by day`} head={["Day", "Minutes", "Conversations"]} rows={days.data.map((d) => [formatDay(d.usage_date, true), d.minutes, d.conversations])} />}
      />
      <p className="text-sm text-muted-foreground">You see totals for this agency. Its clients, their avatars and their conversations are visible to the agency alone.</p>
    </div>
  )
}

function Details({ agency }: { agency: Agency }) {
  const id = useId()
  const queryClient = useQueryClient()
  const [values, setValues] = useState<AgencyDetails>({
    name: agency.name, domain: agency.domain ?? "", status: agency.status as AgencyDetails["status"],
    payment_model: (agency.payment_model ?? "") as AgencyDetails["payment_model"], fee_cents: agency.fee_cents,
  })
  const [fee, setFee] = useState(agency.fee_cents == null ? "" : (agency.fee_cents / 100).toFixed(2))
  const save = useMutation({
    mutationFn: () => updateAgency(agency.id, { ...values, domain: values.domain.trim().toLowerCase(), fee_cents: values.payment_model ? toCents(fee) : null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agency"] })
      await queryClient.invalidateQueries({ queryKey: ["agencies"] })
      toast.success("Agency saved.")
    },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <form
      className="flex max-w-2xl flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5" noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (values.name.trim()) save.mutate()
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Agency Name</Label>
        <Input id={`${id}-name`} required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className="min-h-10" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-domain`}>Sign-In Address</Label>
        <Input id={`${id}-domain`} value={values.domain} onChange={(e) => setValues({ ...values, domain: e.target.value })} placeholder="avalytics.example.com" aria-describedby={`${id}-domain-help`} className="min-h-10" />
        <p id={`${id}-domain-help`} className="text-xs text-muted-foreground">
          The address the agency's people sign in at. Opened there, the sign-in page wears the agency's look. Anywhere else, add <code>?agency={agency.slug}</code> to the sign-in address to see it.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-status`}>Status</Label>
          <select id={`${id}-status`} className={selectClass} value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value as AgencyDetails["status"] })}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-model`}>How the Agency Pays</Label>
          <select id={`${id}-model`} className={selectClass} value={values.payment_model} onChange={(e) => setValues({ ...values, payment_model: e.target.value as AgencyDetails["payment_model"] })}>
            <option value="">Not set</option>
            <option value="subscription">Subscription</option>
            <option value="one_time">One-time fee</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-fee`}>{values.payment_model === "subscription" ? "Amount a Month" : "Amount"}</Label>
          <Input id={`${id}-fee`} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} disabled={!values.payment_model} className="min-h-10" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">The amount is a record of what was agreed. Avalytics does not charge the agency yet.</p>
      <div>
        <Button type="submit" className="min-h-10" disabled={!values.name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save agency"}</Button>
      </div>
    </form>
  )
}

/** The agency's own staff. Divigner invites the first Owner; after that the agency runs its own team. */
function People({ agency }: { agency: Agency }) {
  const id = useId()
  const queryClient = useQueryClient()
  const staff = useQuery({ queryKey: ["agency", agency.id, "staff"], queryFn: () => listAgencyStaff(agency.id) })
  const roles = useQuery({ queryKey: ["roles"], queryFn: listRoles })
  const staffRoles = (roles.data ?? []).filter((r) => r.side === "divigner")
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [roleId, setRoleId] = useState("")
  const chosen = roleId || staffRoles.find((r) => r.key === "owner")?.id || ""

  const invite = useMutation({
    mutationFn: () => inviteUser({ email, full_name: fullName, role_id: chosen, agency_id: agency.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agency", agency.id, "staff"] })
      await queryClient.invalidateQueries({ queryKey: ["agencies"] })
      toast.success(`Invitation sent to ${email}.`)
      setOpen(false)
      setEmail("")
      setFullName("")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (staff.isPending) return <LoadingBlock label="Loading people" />
  if (staff.isError) return <ErrorBlock error={staff.error} onRetry={() => void staff.refetch()} />
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">
          {agency.name}'s own team. An Owner there can do for {agency.name}'s clients what your Owners do for yours, and invites the rest of the team.
        </p>
        <Button className="min-h-10" onClick={() => setOpen(true)}><UserPlus aria-hidden="true" />Invite someone at {agency.name}</Button>
      </div>
      {staff.data.length === 0 ? (
        <EmptyState title="Nobody at This Agency Can Sign In Yet">Invite its first Owner to get it started.</EmptyState>
      ) : (
        <TableScroll label={`Table of people at ${agency.name}`} className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">People at {agency.name}</caption>
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs tracking-wide uppercase">
                <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Email</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Role</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.data.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">{p.full_name || "No name yet"}</th>
                  <td className="px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3">{p.role_name}</td>
                  <td className="px-4 py-3">{p.is_active ? <StatusPill tone="ok">Active</StatusPill> : <StatusPill tone="neutral">Deactivated</StatusPill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Someone at {agency.name}</DialogTitle>
            <DialogDescription>They get an email with a link to set a password, and join {agency.name}'s team.</DialogDescription>
          </DialogHeader>
          <form
            id={`${id}-invite`} className="flex flex-col gap-4" noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (email.trim() && fullName.trim() && chosen) invite.mutate()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-full`}>Full Name</Label>
              <Input id={`${id}-full`} required value={fullName} onChange={(e) => setFullName(e.target.value)} className="min-h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-email`}>Email</Label>
              <Input id={`${id}-email`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-role`}>Role</Label>
              <select id={`${id}-role`} className={selectClass} value={chosen} onChange={(e) => setRoleId(e.target.value)}>
                {staffRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" className="min-h-10" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form={`${id}-invite`} className="min-h-10" disabled={!email.trim() || !fullName.trim() || !chosen || invite.isPending}>{invite.isPending ? "Sending…" : "Send invitation"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AgencyDetail() {
  const { slug = "" } = useParams()
  const agency = useQuery({ queryKey: ["agency", slug], queryFn: () => getAgency(slug) })

  if (agency.isPending) return <LoadingBlock label="Loading agency" />
  if (agency.isError) return <ErrorBlock error={agency.error} onRetry={() => void agency.refetch()} />
  if (!agency.data) return <EmptyState title="That Agency Could Not Be Found">It may have been renamed.</EmptyState>
  const a = agency.data
  return (
    <>
      <PageHeader
        title={a.name}
        back={{ to: "/admin/agencies", label: "Agencies" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {a.status === "active" ? <StatusPill tone="ok">Active</StatusPill> : <StatusPill tone="warn">Paused</StatusPill>}
            <span>{a.domain ?? "No sign-in address yet"}</span>
            <span aria-hidden="true">·</span>
            <span>Pays: {paymentLabel({ payment_model: a.payment_model as "one_time" | "subscription" | null, fee_cents: a.fee_cents })}</span>
          </span>
        }
      />
      <Tabs defaultValue="usage">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="usage" className="min-h-10 px-4">Usage</TabsTrigger>
          <TabsTrigger value="brand" className="min-h-10 px-4">Brand</TabsTrigger>
          <TabsTrigger value="people" className="min-h-10 px-4">People</TabsTrigger>
          <TabsTrigger value="details" className="min-h-10 px-4">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="usage" className="pt-4"><Usage agency={a} /></TabsContent>
        <TabsContent value="brand" className="pt-4"><BrandForm key={a.updated_at} agency={a} /></TabsContent>
        <TabsContent value="people" className="pt-4"><People agency={a} /></TabsContent>
        <TabsContent value="details" className="pt-4"><Details key={a.updated_at} agency={a} /></TabsContent>
      </Tabs>
    </>
  )
}
