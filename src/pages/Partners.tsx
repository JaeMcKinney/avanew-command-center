import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Users, Search, MoreHorizontal, Pencil, Trash2, ExternalLink } from "lucide-react"
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
import { Pagination } from "@/components/Pagination"
import { deletePartner, listPartners, PARTNER_TYPES } from "@/lib/data"
import type { Partner } from "@/types/db"

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-green-500/15 text-green-700 border-green-200",
  Inactive: "bg-muted text-muted-foreground",
  Pending: "bg-yellow-500/15 text-yellow-700 border-yellow-200",
}

export function Partners() {
  const navigate = useNavigate()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name_asc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [confirmDelete, setConfirmDelete] = useState<Partner | null>(null)

  async function refresh() {
    setLoading(true)
    try { setPartners(await listPartners()) }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load") }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = partners.filter((p) => {
      if (typeFilter !== "all" && (p.type ?? "") !== typeFilter) return false
      if (statusFilter !== "all" && p.status !== statusFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.type ?? "").toLowerCase().includes(q)
      )
    })
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name_asc": return a.name.localeCompare(b.name)
        case "name_desc": return b.name.localeCompare(a.name)
        case "newest": return a.created_at < b.created_at ? 1 : -1
        case "oldest": return a.created_at > b.created_at ? 1 : -1
        default: return 0
      }
    })
    return result
  }, [partners, typeFilter, statusFilter, search, sortBy])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [search, typeFilter, statusFilter, sortBy])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deletePartner(confirmDelete.id)
      toast.success("Partner deleted")
      setConfirmDelete(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <div>
      <PageHeader
        title="Partners"
        description="Strategic, financial, and reseller partnerships."
        actions={
          <Button onClick={() => navigate("/partners/new")}>
            <Plus className="h-4 w-4" />
            New Partner
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search by name, email, type…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {PARTNER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Active", "Inactive", "Pending"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Name: A → Z</SelectItem>
            <SelectItem value="name_desc">Name: Z → A</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading...</Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={partners.length === 0 ? "No partners yet" : "No matches"}
          description={partners.length === 0 ? "Add your first strategic or financial partner." : "Try a different search term."}
          action={partners.length === 0 ? <Button onClick={() => navigate("/partners/new")}><Plus className="h-4 w-4" />New Partner</Button> : undefined}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Agreement Start</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <button type="button" onClick={() => navigate(`/partners/${p.id}/edit`)} className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors">
                        {p.name}
                      </button>
                      <div className="text-xs text-muted-foreground md:hidden mt-0.5">
                        {p.type}{p.type && p.status ? " · " : ""}{p.status}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{p.type ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={STATUS_STYLES[p.status] ?? ""}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {p.email ? <a href={`mailto:${p.email}`} className="hover:text-primary">{p.email}</a> : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {p.agreement_start_date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(p.agreement_start_date + "T00:00:00")) : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Row actions"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/partners/${p.id}/edit`)}><Pencil className="h-4 w-4" />Edit</DropdownMenuItem>
                          {p.website && (
                            <DropdownMenuItem onClick={() => window.open(`https://${p.website}`, "_blank")}><ExternalLink className="h-4 w-4" />Visit website</DropdownMenuItem>
                          )}
                          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(p)}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t">
              <Pagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          </Card>
        </>
      )}

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this partner?</AlertDialogTitle>
            <AlertDialogDescription>{confirmDelete?.name} will be removed permanently. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
