import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, CheckSquare, Search, MoreHorizontal, Pencil, Trash2, CheckCheck, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/EmptyState"
import { ImportDialog } from "@/components/ImportDialog"
import { Pagination } from "@/components/Pagination"
import { deleteTask, listContacts, listTasks, updateTask } from "@/lib/data"
import type { Contact, Task } from "@/types/db"

function fmtDate(s: string | null): string {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  } catch {
    return s
  }
}

type StatusVariant = "default" | "secondary" | "outline" | "destructive"

function statusBadge(status: string): { label: string; variant: StatusVariant; className?: string } {
  switch (status) {
    case "Completed":
      return { label: status, variant: "default", className: "bg-green-500/15 text-green-700 border-green-200" }
    case "In Progress":
      return { label: status, variant: "default", className: "bg-blue-500/15 text-blue-700 border-blue-200" }
    case "Waiting for Input":
      return { label: status, variant: "default", className: "bg-yellow-500/15 text-yellow-700 border-yellow-200" }
    case "Deferred":
      return { label: status, variant: "secondary" }
    default:
      return { label: status, variant: "outline" }
  }
}

function priorityBadge(priority: string): { label: string; variant: StatusVariant; className?: string } {
  switch (priority) {
    case "Highest":
    case "High":
      return { label: priority, variant: "default", className: "bg-red-500/15 text-red-700 border-red-200" }
    default:
      return { label: priority, variant: "secondary" }
  }
}

export function Tasks() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [sortBy, setSortBy] = useState("due_asc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [t, c] = await Promise.all([listTasks(), listContacts()])
      setTasks(t)
      setContacts(c)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const contactName = useMemo(() => {
    const map = new Map(contacts.map((c) => [c.id, `${c.first_name} ${c.last_name ?? ""}`.trim()]))
    return (id: string | null) => (id ? (map.get(id) ?? null) : null)
  }, [contacts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false
      if (!q) return true
      return (
        t.subject.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        t.priority.toLowerCase().includes(q) ||
        (contactName(t.contact_id) ?? "").toLowerCase().includes(q)
      )
    })
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "due_asc":
          return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
        case "due_desc":
          return (b.due_date ?? "").localeCompare(a.due_date ?? "")
        case "priority": {
          const order = ["Highest", "High", "Normal", "Low", "Lowest"]
          return order.indexOf(a.priority) - order.indexOf(b.priority)
        }
        case "newest": return a.created_at < b.created_at ? 1 : -1
        case "oldest": return a.created_at > b.created_at ? 1 : -1
        default: return 0
      }
    })
    return result
  }, [tasks, search, statusFilter, priorityFilter, sortBy, contactName])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [search, statusFilter, priorityFilter, sortBy])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  async function handleMarkComplete(task: Task) {
    try {
      await updateTask(task.id, {
        subject: task.subject,
        status: "Completed",
        priority: task.priority,
        owner_id: task.owner_id,
        contact_id: task.contact_id,
        company_id: task.company_id,
        deal_id: task.deal_id,
        lead_id: task.lead_id,
        due_date: task.due_date,
        description: task.description,
        completed_at: new Date().toISOString(),
      })
      toast.success("Task marked as complete")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task")
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteTask(confirmDelete.id)
      toast.success("Task deleted")
      setConfirmDelete(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Track follow-ups and action items."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button onClick={() => navigate("/tasks/new")}>
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by subject, status, priority..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Not Started", "In Progress", "Waiting for Input", "Completed", "Deferred"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {["Highest", "High", "Normal", "Low", "Lowest"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due_asc">Due date: Earliest</SelectItem>
            <SelectItem value="due_desc">Due date: Latest</SelectItem>
            <SelectItem value="priority">Priority: High → Low</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Loading...
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={tasks.length === 0 ? "No tasks yet" : "No matches"}
          description={
            tasks.length === 0
              ? "Create your first task to start tracking follow-ups."
              : "Try a different search term."
          }
          action={
            tasks.length === 0 ? (
              <Button onClick={() => navigate("/tasks/new")}>
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </p>
          <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Priority</TableHead>
                <TableHead className="hidden lg:table-cell">Due Date</TableHead>
                <TableHead className="hidden lg:table-cell">Contact</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((task) => {
                const sb = statusBadge(task.status)
                const pb = priorityBadge(task.priority)
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        onClick={() => navigate(`/tasks/${task.id}/edit`)}
                        className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors"
                      >
                        {task.subject}
                      </button>
                      <div className="text-xs text-muted-foreground md:hidden mt-0.5">
                        {task.status}
                        {task.status && task.priority ? " · " : ""}
                        {task.priority}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={sb.variant} className={sb.className}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={pb.variant} className={pb.className}>{pb.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {fmtDate(task.due_date)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {contactName(task.contact_id) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Row actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/tasks/${task.id}/edit`)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {task.status !== "Completed" && (
                            <DropdownMenuItem onClick={() => handleMarkComplete(task)}>
                              <CheckCheck className="h-4 w-4" />
                              Mark Complete
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setConfirmDelete(task)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="border-t">
            <Pagination
              total={filtered.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </Card>
        </>
      )}

      <AlertDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.subject}" will be removed permanently. This can't be undone.
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

      <ImportDialog
        entity="tasks"
        open={importOpen}
        onOpenChange={setImportOpen}
        onComplete={refresh}
      />
    </div>
  )
}
