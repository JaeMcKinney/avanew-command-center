import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Lock,
  Plus,
  Trash2,
  Phone,
  Mail,
  CalendarDays,
  StickyNote,
  CheckSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { QuickCreateAccountDialog } from "@/components/QuickCreateAccountDialog"
import { QuickCreateContactDialog } from "@/components/QuickCreateContactDialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  createActivity,
  createDeal,
  deleteActivity,
  listActivities,
  listCompanies,
  listContacts,
  listDeals,
  listPartners,
  listStages,
  listTeamMembers,
  updateDeal,
  type DealInput,
} from "@/lib/data"
import type {
  Activity,
  ActivityType,
  Company,
  Contact,
  Deal,
  Partner,
  PipelineStage,
  TeamMember,
} from "@/types/db"
import { cn } from "@/lib/utils"
import { useRole } from "@/hooks/useRole"
import { useAuth } from "@/contexts/AuthContext"

const NONE = "__none__"

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
  note: StickyNote,
  task: CheckSquare,
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  task: "Task",
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TYPE_OPTIONS = [
  "New Business",
  "Existing Business",
  "Existing Business — Renewal",
] as const

const LEAD_SOURCE_OPTIONS = [
  "Cold call",
  "Email",
  "Referral",
  "Web",
  "Trade show",
  "Partner",
  "Other",
] as const

const schema = z.object({
  owner_id: z.string().refine((v) => v !== NONE && v.trim().length > 0, {
    message: "Deal Owner is required",
  }),
  title: z.string().min(1, "Deal name is required"),
  company_id: z.string().min(1, "Account is required").refine((v) => v !== NONE, {
    message: "Account is required",
  }),
  partner_id: z.string().optional(),
  type: z.string().optional(),
  next_step: z.string().optional(),
  lead_source: z.string().optional(),
  contact_id: z.string().optional(),
  amount: z.string().optional(),
  expected_close_date: z.string().min(1, "Closing date is required"),
  stage_id: z.string().min(1, "Stage is required"),
  probability: z.string().optional(),
  campaign_source: z.string().optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function emptyDefaults(stages: PipelineStage[], stageId?: string): FormValues {
  const fallback = stages[0]?.id ?? ""
  const stage_id =
    stageId && stages.some((s) => s.id === stageId) ? stageId : fallback
  return {
    owner_id: NONE,
    title: "",
    company_id: NONE,
    partner_id: NONE,
    type: NONE,
    next_step: "",
    lead_source: NONE,
    contact_id: NONE,
    amount: "",
    expected_close_date: "",
    stage_id,
    probability: "10",
    campaign_source: "",
    description: "",
  }
}

function fromDeal(d: Deal): FormValues {
  return {
    owner_id: d.owner_id ?? NONE,
    title: d.title,
    company_id: d.company_id ?? NONE,
    partner_id: d.partner_id ?? NONE,
    type: d.type ?? NONE,
    next_step: d.next_step ?? "",
    lead_source: d.lead_source ?? NONE,
    contact_id: d.contact_id ?? NONE,
    amount: d.amount != null ? String(d.amount) : "",
    expected_close_date: d.expected_close_date ?? "",
    stage_id: d.stage_id,
    probability: d.probability != null ? String(d.probability) : "",
    campaign_source: d.campaign_source ?? "",
    description: d.description ?? "",
  }
}

function pickOrNull(s: string | undefined): string | null {
  if (!s || s === NONE) return null
  const t = s.trim()
  return t === "" ? null : t
}

function pickDefaultOwner(
  team: TeamMember[],
  isLimitedRole: boolean,
  currentUserId: string | undefined
): string | null {
  if (isLimitedRole && currentUserId) {
    const self = team.find((m) => m.id === currentUserId)
    if (self) return self.id
  }
  const fieldTeam = team
    .filter((m) => m.role === "bd" || m.role === "partner")
    .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email))
  if (fieldTeam.length > 0) return fieldTeam[0].id
  return currentUserId ?? null
}

function toInput(v: FormValues): DealInput {
  const amount = v.amount?.trim()
  const parsedAmount = amount ? Number(amount) : null
  const probability = v.probability?.trim()
  const parsedProb = probability ? Number(probability) : null
  return {
    title: v.title.trim(),
    amount:
      parsedAmount !== null && !Number.isNaN(parsedAmount) ? parsedAmount : null,
    stage_id: v.stage_id,
    contact_id: pickOrNull(v.contact_id),
    company_id: pickOrNull(v.company_id),
    owner_id: pickOrNull(v.owner_id),
    partner_id: pickOrNull(v.partner_id),
    expected_close_date: v.expected_close_date || null,
    type: pickOrNull(v.type),
    next_step: v.next_step?.trim() || null,
    lead_source: pickOrNull(v.lead_source),
    probability:
      parsedProb !== null && !Number.isNaN(parsedProb)
        ? Math.max(0, Math.min(100, Math.round(parsedProb)))
        : null,
    campaign_source: v.campaign_source?.trim() || null,
    description: v.description?.trim() || null,
  }
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <FormLabel className="flex items-center gap-1">
      {children}
      <span aria-hidden className="text-destructive">
        *
      </span>
    </FormLabel>
  )
}

export function DealForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const stageQuery = searchParams.get("stage") ?? undefined
  const companyQuery = searchParams.get("company") ?? undefined
  const isEdit = Boolean(id)
  const { role } = useRole()
  const { user } = useAuth()
  const isLimitedRole = role === "bd" || role === "partner"

  const [stages, setStages] = useState<PipelineStage[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [logType, setLogType] = useState<ActivityType>("call")
  const [logSubject, setLogSubject] = useState("")
  const [logBody, setLogBody] = useState("")
  const [logDate, setLogDate] = useState("")
  const [logSaving, setLogSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults([]),
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [s, c, co, t, p, deals, allActivities] = await Promise.all([
          listStages(),
          listContacts(),
          listCompanies(),
          listTeamMembers(),
          listPartners(),
          isEdit ? listDeals() : Promise.resolve([] as Deal[]),
          isEdit ? listActivities() : Promise.resolve([] as Activity[]),
        ])
        if (!alive) return
        setStages(s)
        setContacts(c)
        setCompanies(co)
        setPartners(p)
        const activeTeam = t.filter((m) => m.status === "active")
        setTeam(activeTeam)

        if (isEdit) {
          const deal = deals.find((d) => d.id === id)
          if (!deal) {
            toast.error("Deal not found")
            navigate("/deals", { replace: true })
            return
          }
          form.reset(fromDeal(deal))
          setActivities(
            allActivities
              .filter((a) => a.deal_id === id)
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )
          )
        } else {
          const defaults = emptyDefaults(s, stageQuery)
          if (companyQuery && co.some((c) => c.id === companyQuery)) {
            defaults.company_id = companyQuery
          }
          const defaultOwner = pickDefaultOwner(activeTeam, isLimitedRole, user?.id)
          if (defaultOwner) defaults.owner_id = defaultOwner
          form.reset(defaults)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const watchAmount = form.watch("amount")
  const watchProbability = form.watch("probability")

  const expectedRevenue = useMemo(() => {
    const a = Number(watchAmount)
    const p = Number(watchProbability)
    if (!Number.isFinite(a) || !Number.isFinite(p)) return null
    if (a <= 0 || p <= 0) return null
    return (a * p) / 100
  }, [watchAmount, watchProbability])

  async function handleLogActivity() {
    if (!logSubject.trim() || !id) return
    setLogSaving(true)
    try {
      const a = await createActivity({
        type: logType,
        subject: logSubject.trim(),
        body: logBody.trim() || null,
        deal_id: id,
        due_at: logDate || null,
      })
      setActivities((prev) => [a, ...prev])
      setLogSubject("")
      setLogBody("")
      setLogDate("")
      setLogOpen(false)
      toast.success("Activity logged")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log")
    } finally {
      setLogSaving(false)
    }
  }

  async function handleDeleteActivity(activityId: string) {
    try {
      await deleteActivity(activityId)
      setActivities((prev) => prev.filter((a) => a.id !== activityId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  async function save(values: FormValues): Promise<Deal> {
    const input = toInput(values)
    if (isEdit && id) {
      const d = await updateDeal(id, input)
      toast.success("Deal updated")
      return d
    }
    const d = await createDeal(input)
    toast.success("Deal created")
    return d
  }

  async function onSubmit(values: FormValues) {
    try {
      await save(values)
      navigate("/deals")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  async function onSaveAndNew() {
    const ok = await form.trigger()
    if (!ok) return
    try {
      await save(form.getValues())
      form.reset(emptyDefaults(stages, stageQuery))
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  const submitting = form.formState.isSubmitting

  return (
    <div className="-m-4 md:-m-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-6">
            <h1 className="text-lg font-semibold sm:text-xl">
              {isEdit ? "Edit Deal" : "Create Deal"}
            </h1>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/deals")}
                disabled={submitting}
              >
                Cancel
              </Button>
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSaveAndNew}
                  disabled={submitting}
                >
                  Save and New
                </Button>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div className="px-4 py-6 md:px-6">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="space-y-8">
                <FormSection title="Deal Information">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="owner_id"
                      render={({ field }) => (
                        <Row label={<RequiredLabel>Deal Owner</RequiredLabel>}>
                          <Select
                            value={field.value && field.value !== NONE ? field.value : ""}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select an owner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(isLimitedRole ? team.filter((m) => m.id === user?.id) : team).map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.full_name || m.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <Row label="Amount">
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              placeholder="$"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <Row
                          label={<RequiredLabel>Deal Name</RequiredLabel>}
                        >
                          <FormControl>
                            <Input
                              placeholder="e.g. Acme — annual contract"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expected_close_date"
                      render={({ field }) => (
                        <Row
                          label={<RequiredLabel>Closing Date</RequiredLabel>}
                        >
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="company_id"
                      render={({ field }) => (
                        <Row
                          label={<RequiredLabel>Account Name</RequiredLabel>}
                        >
                          <div className="flex gap-2">
                            <Select
                              value={field.value ?? NONE}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select an account" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NONE}>—</SelectItem>
                                {companies.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setAccountDialogOpen(true)}
                              aria-label="Create new account"
                              title="Create new account"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="stage_id"
                      render={({ field }) => (
                        <Row label={<RequiredLabel>Stage</RequiredLabel>}>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select stage" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {stages.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <Row label="Type">
                          <Select
                            value={field.value ?? NONE}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="-None-" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NONE}>-None-</SelectItem>
                              {TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="probability"
                      render={({ field }) => (
                        <Row label="Probability (%)">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              placeholder="10"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="next_step"
                      render={({ field }) => (
                        <Row label="Next Step">
                          <FormControl>
                            <Input placeholder="" {...field} />
                          </FormControl>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <Row label="Expected Revenue">
                      <div className="relative">
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={
                            expectedRevenue != null
                              ? fmtCurrency(expectedRevenue)
                              : ""
                          }
                          placeholder="$"
                          className="bg-muted/40 pr-9"
                        />
                        <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </Row>

                    <FormField
                      control={form.control}
                      name="lead_source"
                      render={({ field }) => (
                        <Row label="Lead Source">
                          <Select
                            value={field.value ?? NONE}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="-None-" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NONE}>-None-</SelectItem>
                              {LEAD_SOURCE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="campaign_source"
                      render={({ field }) => (
                        <Row label="Campaign Source">
                          <FormControl>
                            <Input placeholder="" {...field} />
                          </FormControl>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contact_id"
                      render={({ field }) => (
                        <Row label="Contact Name">
                          <div className="flex gap-2">
                            <Select
                              value={field.value ?? NONE}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NONE}>—</SelectItem>
                                {contacts.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.first_name} {c.last_name ?? ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setContactDialogOpen(true)}
                              aria-label="Create new contact"
                              title="Create new contact"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormMessage />
                        </Row>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="partner_id"
                      render={({ field }) => (
                        <Row label="Partner">
                          <Select
                            value={field.value ?? NONE}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NONE}>—</SelectItem>
                              {partners.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </Row>
                      )}
                    />
                  </div>
                </FormSection>

                <FormSection title="Description Information">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <Row label="Description">
                        <FormControl>
                          <Textarea rows={4} {...field} />
                        </FormControl>
                        <FormMessage />
                      </Row>
                    )}
                  />
                </FormSection>

                {isEdit && (
                  <FormSection title="Activity Log">
                    <div className="space-y-3">
                      {!logOpen ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setLogOpen(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Log activity
                        </Button>
                      ) : (
                        <div className="rounded-md border p-4 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Select
                              value={logType}
                              onValueChange={(v) => setLogType(v as ActivityType)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map(
                                  (k) => (
                                    <SelectItem key={k} value={k}>
                                      {ACTIVITY_LABELS[k]}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            <Input
                              type="date"
                              value={logDate}
                              onChange={(e) => setLogDate(e.target.value)}
                            />
                          </div>
                          <Input
                            placeholder="Subject"
                            value={logSubject}
                            onChange={(e) => setLogSubject(e.target.value)}
                          />
                          <Textarea
                            rows={2}
                            placeholder="Notes (optional)"
                            value={logBody}
                            onChange={(e) => setLogBody(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleLogActivity}
                              disabled={logSaving || !logSubject.trim()}
                            >
                              {logSaving ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setLogOpen(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {activities.length === 0 && !logOpen && (
                        <p className="text-sm text-muted-foreground">
                          No activities logged yet.
                        </p>
                      )}

                      {activities.length > 0 && (
                        <ul className="space-y-2">
                          {activities.map((a) => {
                            const Icon = ACTIVITY_ICONS[a.type]
                            return (
                              <li
                                key={a.id}
                                className="flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm"
                              >
                                <div className="shrink-0 mt-0.5 h-7 w-7 rounded-full bg-muted grid place-items-center text-muted-foreground">
                                  <Icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium">{a.subject}</div>
                                  {a.body && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {a.body}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {ACTIVITY_LABELS[a.type]} ·{" "}
                                    {fmtRelative(a.created_at)}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteActivity(a.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </FormSection>
                )}
              </div>
            )}
          </div>
        </form>
      </Form>

      <QuickCreateAccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        onCreated={(account) => {
          setCompanies((prev) => [account, ...prev].sort((a, b) => a.name.localeCompare(b.name)))
          // Defer setValue so the new SelectItem has rendered before the Select
          // tries to match its value against existing items.
          setTimeout(() => {
            form.setValue("company_id", account.id, { shouldValidate: true, shouldDirty: true })
          }, 0)
        }}
      />

      <QuickCreateContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        defaultCompanyId={
          (() => {
            const v = form.getValues("company_id")
            return v && v !== NONE ? v : null
          })()
        }
        onCreated={(contact) => {
          setContacts((prev) => [contact, ...prev])
          setTimeout(() => {
            form.setValue("contact_id", contact.id, { shouldValidate: true, shouldDirty: true })
          }, 0)
        }}
      />
    </div>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Row({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <FormItem className={cn("grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4", className)}>
      {typeof label === "string" ? (
        <FormLabel className="text-sm text-muted-foreground sm:text-right">
          {label}
        </FormLabel>
      ) : (
        <div className="text-sm text-muted-foreground sm:text-right">
          {label}
        </div>
      )}
      <div className="min-w-0">{children}</div>
    </FormItem>
  )
}
