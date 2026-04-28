import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Plus,
  ClipboardList,
  Phone,
  Mail,
  StickyNote,
  CalendarDays,
  CheckSquare,
  CircleCheckBig,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/EmptyState"
import { ActivityDialog } from "@/components/ActivityDialog"
import {
  deleteActivity,
  listActivities,
  listCompanies,
  listContacts,
  listDeals,
  updateActivity,
} from "@/lib/data"
import type {
  Activity,
  ActivityType,
  Company,
  Contact,
  Deal,
} from "@/types/db"

const TYPE_META: Record<
  ActivityType,
  { label: string; icon: LucideIcon }
> = {
  call: { label: "Call", icon: Phone },
  email: { label: "Email", icon: Mail },
  meeting: { label: "Meeting", icon: CalendarDays },
  note: { label: "Note", icon: StickyNote },
  task: { label: "Task", icon: CheckSquare },
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "call", label: "Calls" },
  { value: "email", label: "Emails" },
  { value: "meeting", label: "Meetings" },
  { value: "note", label: "Notes" },
  { value: "task", label: "Tasks" },
] as const

type FilterValue = (typeof FILTERS)[number]["value"]

function fmtRelative(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

function fmtDue(iso: string) {
  const d = new Date(iso)
  const diff = d.getTime() - Date.now()
  const isPast = diff < 0
  const abs = Math.abs(diff)
  const days = Math.round(abs / 86_400_000)
  if (days === 0) return isPast ? "today (overdue)" : "today"
  if (days === 1) return isPast ? "yesterday (overdue)" : "tomorrow"
  return isPast ? `${days}d overdue` : `in ${days}d`
}

export function Activities() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterValue>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const [a, c, co, d] = await Promise.all([
        listActivities(),
        listContacts(),
        listCompanies(),
        listDeals(),
      ])
      setActivities(a)
      setContacts(c)
      setCompanies(co)
      setDeals(d)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const contactName = useMemo(() => {
    const m = new Map(
      contacts.map((c) => [
        c.id,
        `${c.first_name}${c.last_name ? " " + c.last_name : ""}`,
      ])
    )
    return (id: string | null) => (id ? (m.get(id) ?? null) : null)
  }, [contacts])

  const companyName = useMemo(() => {
    const m = new Map(companies.map((c) => [c.id, c.name]))
    return (id: string | null) => (id ? (m.get(id) ?? null) : null)
  }, [companies])

  const dealTitle = useMemo(() => {
    const m = new Map(deals.map((d) => [d.id, d.title]))
    return (id: string | null) => (id ? (m.get(id) ?? null) : null)
  }, [deals])

  const filtered = useMemo(() => {
    if (filter === "all") return activities
    return activities.filter((a) => a.type === filter)
  }, [activities, filter])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(a: Activity) {
    setEditing(a)
    setDialogOpen(true)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteActivity(confirmDelete.id)
      toast.success("Activity deleted")
      setConfirmDelete(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  async function toggleComplete(a: Activity) {
    try {
      await updateActivity(a.id, {
        completed_at: a.completed_at ? null : new Date().toISOString(),
      })
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    }
  }

  return (
    <div>
      <PageHeader
        title="Activities"
        description="Calls, emails, notes, meetings, and tasks across your contacts."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Log activity
          </Button>
        }
      />

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterValue)}
        className="mb-4"
      >
        <TabsList className="flex flex-wrap h-auto">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Loading...
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            activities.length === 0
              ? "No activities yet"
              : "No activities of this type"
          }
          description={
            activities.length === 0
              ? "Log your first call, email, note, meeting, or task."
              : "Try a different filter."
          }
          action={
            activities.length === 0 ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Log activity
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y">
            {filtered.map((a) => {
              const meta = TYPE_META[a.type]
              const Icon = meta.icon
              const entityLinks = [
                a.company_id && companyName(a.company_id)
                  ? { label: companyName(a.company_id)!, href: `/accounts/${a.company_id}/edit` }
                  : null,
                a.contact_id && contactName(a.contact_id)
                  ? { label: contactName(a.contact_id)!, href: `/contacts/${a.contact_id}/edit` }
                  : null,
                a.deal_id && dealTitle(a.deal_id)
                  ? { label: dealTitle(a.deal_id)!, href: `/deals/${a.deal_id}/edit` }
                  : null,
              ].filter(Boolean) as { label: string; href: string }[]
              const isTaskish = a.type === "task" || a.type === "meeting"
              const completed = Boolean(a.completed_at)
              return (
                <li
                  key={a.id}
                  className="p-4 flex items-start gap-3 hover:bg-muted/40"
                >
                  <div
                    className={cn(
                      "shrink-0 mt-0.5 h-9 w-9 rounded-full grid place-items-center",
                      completed
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {meta.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmtRelative(a.created_at)}
                      </span>
                      {isTaskish && a.due_at && !completed && (
                        <span className="text-xs text-primary font-medium">
                          due {fmtDue(a.due_at)}
                        </span>
                      )}
                      {isTaskish && completed && (
                        <span className="text-xs text-primary font-medium">
                          completed
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "font-medium mt-0.5",
                        completed && "line-through text-muted-foreground"
                      )}
                    >
                      {a.subject}
                    </div>
                    {a.body && (
                      <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                        {a.body}
                      </div>
                    )}
                    {entityLinks.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-1">
                        {entityLinks.map((lnk, i) => (
                          <span key={lnk.href} className="flex items-center gap-1">
                            {i > 0 && <span className="opacity-40">·</span>}
                            <Link
                              to={lnk.href}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-primary hover:underline underline-offset-2"
                            >
                              {lnk.label}
                            </Link>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isTaskish && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void toggleComplete(a)}
                        aria-label={
                          completed ? "Mark incomplete" : "Mark complete"
                        }
                        className={completed ? "text-primary" : ""}
                      >
                        <CircleCheckBig className="h-4 w-4" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Activity actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setConfirmDelete(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        activity={editing}
        contacts={contacts}
        companies={companies}
        deals={deals}
        onSaved={refresh}
      />

      <AlertDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.subject}" will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
