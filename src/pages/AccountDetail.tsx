import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Building2,
  Pencil,
  ArrowLeft,
  Plus,
  ExternalLink,
  Mail,
  Phone,
  Globe,
  MapPin,
  Briefcase,
  Users,
  Activity as ActivityIcon,
  StickyNote,
  CalendarDays,
  CheckSquare,
  FileText,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/EmptyState"
import { QuickCreateContactDialog } from "@/components/QuickCreateContactDialog"
import { DocumentsSection } from "@/components/DocumentsSection"
import {
  listActivities,
  listCompanies,
  listContacts,
  listDeals,
  listStages,
} from "@/lib/data"
import type {
  Activity,
  ActivityType,
  Company,
  Contact,
  Deal,
  PipelineStage,
} from "@/types/db"

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
  note: StickyNote,
  task: CheckSquare,
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
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

export function AccountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [company, setCompany] = useState<Company | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)

  async function refresh() {
    if (!id) return
    setLoading(true)
    try {
      const [cs, cts, ds, acts, sts] = await Promise.all([
        listCompanies(),
        listContacts(),
        listDeals(),
        listActivities(),
        listStages(),
      ])
      const found = cs.find((c) => c.id === id)
      if (!found) {
        toast.error("Account not found")
        navigate("/accounts", { replace: true })
        return
      }
      setCompany(found)
      setContacts(cts.filter((c) => c.company_id === id))
      setDeals(ds.filter((d) => d.company_id === id))
      setActivities(acts.filter((a) => a.company_id === id))
      setStages(sts)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const stageById = useMemo(() => {
    const m = new Map<string, PipelineStage>()
    for (const s of stages) m.set(s.id, s)
    return m
  }, [stages])

  const totalDealValue = useMemo(
    () => deals.reduce((sum, d) => sum + (d.amount ?? 0), 0),
    [deals]
  )

  if (loading || !company) {
    return (
      <div className="text-sm text-muted-foreground p-4">Loading…</div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/accounts")}
          className="-ml-2 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Accounts
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold sm:text-2xl truncate">
                {company.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {company.industry && (
                  <Badge variant="outline" className="gap-1">
                    <Briefcase className="h-3 w-3" />
                    {company.industry}
                  </Badge>
                )}
                {company.account_type && (
                  <Badge variant="outline">{company.account_type}</Badge>
                )}
                {company.rating && <Badge variant="outline">{company.rating}</Badge>}
              </div>
            </div>
          </div>
          <Button onClick={() => navigate(`/accounts/${company.id}/edit`)}>
            <Pencil className="h-4 w-4" />
            Edit account
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Contacts</p>
            <p className="text-2xl font-semibold mt-1">{contacts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Open deals</p>
            <p className="text-2xl font-semibold mt-1">
              {deals.filter((d) => {
                const s = stageById.get(d.stage_id)
                return s && !s.is_won && !s.is_lost
              }).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total deal value</p>
            <p className="text-2xl font-semibold mt-1">
              {fmtCurrency(totalDealValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Account info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {company.website && (
              <div className="flex items-start gap-2">
                <Globe className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary inline-flex items-center gap-1 break-all"
                >
                  {company.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {company.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                <a href={`tel:${company.phone}`} className="hover:text-primary">
                  {company.phone}
                </a>
              </div>
            )}
            {(company.billing_street || company.billing_city) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                <div className="text-muted-foreground">
                  {company.billing_street && <div>{company.billing_street}</div>}
                  <div>
                    {[company.billing_city, company.billing_state, company.billing_zip]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  {company.billing_country && <div>{company.billing_country}</div>}
                </div>
              </div>
            )}
            {company.annual_revenue != null && (
              <div className="text-muted-foreground">
                Annual revenue:{" "}
                <span className="text-foreground">
                  {fmtCurrency(company.annual_revenue)}
                </span>
              </div>
            )}
            {company.employees != null && (
              <div className="text-muted-foreground">
                Employees:{" "}
                <span className="text-foreground">{company.employees}</span>
              </div>
            )}
            {company.description && (
              <div className="pt-2 border-t text-muted-foreground">
                {company.description}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="contacts">
            <TabsList>
              <TabsTrigger value="contacts">
                <Users className="h-3.5 w-3.5" />
                Contacts ({contacts.length})
              </TabsTrigger>
              <TabsTrigger value="deals">
                <Briefcase className="h-3.5 w-3.5" />
                Deals ({deals.length})
              </TabsTrigger>
              <TabsTrigger value="activities">
                <ActivityIcon className="h-3.5 w-3.5" />
                Activities ({activities.length})
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText className="h-3.5 w-3.5" />
                Documents
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contacts" className="mt-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Contacts at {company.name}</CardTitle>
                  <Button size="sm" onClick={() => setContactDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Add contact
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {contacts.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon={Users}
                        title="No contacts yet"
                        description="Add a contact to start tracking the people at this account."
                      />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden md:table-cell">Title</TableHead>
                          <TableHead className="hidden md:table-cell">Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">
                              <button
                                type="button"
                                onClick={() => navigate(`/contacts/${c.id}/edit`)}
                                className="text-left hover:text-primary hover:underline underline-offset-2"
                              >
                                {c.first_name} {c.last_name ?? ""}
                              </button>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {c.title ?? "—"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {c.email ? (
                                <a href={`mailto:${c.email}`} className="hover:text-primary">
                                  {c.email}
                                </a>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deals" className="mt-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Deals with {company.name}</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/deals/new?company=${company.id}`)}
                  >
                    <Plus className="h-4 w-4" />
                    Add deal
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {deals.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon={Briefcase}
                        title="No deals yet"
                        description="Open an opportunity for this account to start tracking it."
                      />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Deal</TableHead>
                          <TableHead className="hidden md:table-cell">Stage</TableHead>
                          <TableHead className="hidden md:table-cell">Close</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deals.map((d) => {
                          const stage = stageById.get(d.stage_id)
                          return (
                            <TableRow key={d.id}>
                              <TableCell className="font-medium">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/deals/${d.id}/edit`)}
                                  className="text-left hover:text-primary hover:underline underline-offset-2"
                                >
                                  {d.title}
                                </button>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground">
                                {stage?.name ?? "—"}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground">
                                {d.expected_close_date ?? "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {d.amount != null ? fmtCurrency(d.amount) : "—"}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-3">
              <DocumentsSection entityType="account" entityId={company.id} />
            </TabsContent>

            <TabsContent value="activities" className="mt-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <EmptyState
                      icon={ActivityIcon}
                      title="No activity yet"
                      description="Calls, emails, meetings, and notes for this account will appear here."
                    />
                  ) : (
                    <ul className="space-y-2">
                      {activities
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime()
                        )
                        .map((a) => {
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
                                  {a.type} · {fmtRelative(a.created_at)}
                                </div>
                              </div>
                            </li>
                          )
                        })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <QuickCreateContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        defaultCompanyId={company.id}
        onCreated={() => {
          void refresh()
        }}
      />
    </div>
  )
}
