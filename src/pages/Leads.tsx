import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, UserPlus, Search, MoreHorizontal, Pencil, Trash2, ArrowRightLeft, CheckCircle2, MailX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
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
import { Pagination } from "@/components/Pagination"
import { ConvertLeadDialog } from "@/components/ConvertLeadDialog"
import { Badge } from "@/components/ui/badge"
import { deleteLead, listLeads } from "@/lib/data"
import type { Lead } from "@/types/db"

export function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [ratingFilter, setRatingFilter] = useState("all")
  const [sortBy, setSortBy] = useState("newest")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const data = await listLeads()
      setLeads(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leads")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = leads.filter((l) => {
      if (statusFilter !== "all" && (l.lead_status ?? "") !== statusFilter) return false
      if (ratingFilter !== "all" && (l.rating ?? "") !== ratingFilter) return false
      if (!q) return true
      const name = `${l.first_name} ${l.last_name ?? ""}`.toLowerCase()
      return (
        name.includes(q) ||
        (l.company ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.lead_status ?? "").toLowerCase().includes(q)
      )
    })
    result = [...result].sort((a, b) => {
      const aName = `${a.first_name} ${a.last_name ?? ""}`.trim()
      const bName = `${b.first_name} ${b.last_name ?? ""}`.trim()
      switch (sortBy) {
        case "name_asc": return aName.localeCompare(bName)
        case "name_desc": return bName.localeCompare(aName)
        case "newest": return a.created_at < b.created_at ? 1 : -1
        case "oldest": return a.created_at > b.created_at ? 1 : -1
        default: return 0
      }
    })
    return result
  }, [leads, search, statusFilter, ratingFilter, sortBy])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [search, statusFilter, ratingFilter, sortBy])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteLead(confirmDelete.id)
      toast.success("Lead deleted")
      setConfirmDelete(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Potential customers not yet in the pipeline."
        actions={
          <>
            <Button onClick={() => navigate("/leads/new")}>
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, company, email, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["New", "Contacted", "Working", "Unqualified", "Qualified", "Converted"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All ratings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {["Hot", "Warm", "Cold"].map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name_asc">Name: A → Z</SelectItem>
            <SelectItem value="name_desc">Name: Z → A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Loading...
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={leads.length === 0 ? "No leads yet" : "No matches"}
          description={
            leads.length === 0
              ? "Add your first lead to start tracking prospects."
              : "Try a different search term."
          }
          action={
            leads.length === 0 ? (
              <Button onClick={() => navigate("/leads/new")}>
                <Plus className="h-4 w-4" />
                New Lead
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
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Lead Status</TableHead>
                <TableHead className="hidden lg:table-cell">Rating</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/leads/${lead.id}/edit`)}
                        className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors"
                      >
                        {lead.first_name} {lead.last_name ?? ""}
                      </button>
                      {lead.converted && (
                        <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Converted
                        </Badge>
                      )}
                      {lead.email_opt_out && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-rose-600 border-rose-300"
                          title="This lead opted out of marketing communications"
                        >
                          <MailX className="h-3 w-3" />
                          Do Not Email
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground md:hidden">
                      {lead.company}
                      {lead.company && lead.lead_status ? " · " : ""}
                      {lead.lead_status}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {lead.company ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="hover:text-primary">
                        {lead.email}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {lead.phone ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {lead.lead_status ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {lead.rating ?? "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Row actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}/edit`)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {!lead.converted && (
                          <DropdownMenuItem onClick={() => setConvertLead(lead)}>
                            <ArrowRightLeft className="h-4 w-4" />
                            Convert
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setConfirmDelete(lead)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
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
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete &&
                `${confirmDelete.first_name} ${confirmDelete.last_name ?? ""}`.trim()}{" "}
              will be removed permanently. This can't be undone.
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


      <ConvertLeadDialog
        lead={convertLead}
        open={Boolean(convertLead)}
        onOpenChange={(open) => !open && setConvertLead(null)}
        onConverted={refresh}
      />
    </div>
  )
}
