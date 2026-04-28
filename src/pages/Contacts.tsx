import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Users, Search, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react"
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
import { ImportDialog } from "@/components/ImportDialog"
import { Pagination } from "@/components/Pagination"
import { deleteContact, listCompanies, listContacts } from "@/lib/data"
import type { Company, Contact } from "@/types/db"

export function Contacts() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [companyFilter, setCompanyFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name_asc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [c, co] = await Promise.all([listContacts(), listCompanies()])
      setContacts(c)
      setCompanies(co)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load contacts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const companyName = useMemo(() => {
    const map = new Map(companies.map((c) => [c.id, c.name]))
    return (id: string | null) => (id ? map.get(id) ?? null : null)
  }, [companies])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = contacts.filter((c) => {
      if (companyFilter !== "all" && c.company_id !== companyFilter) return false
      if (!q) return true
      const name = `${c.first_name} ${c.last_name ?? ""}`.toLowerCase()
      return (
        name.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q) ||
        (companyName(c.company_id) ?? "").toLowerCase().includes(q)
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
  }, [contacts, search, companyFilter, sortBy, companyName])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [search, companyFilter, sortBy])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteContact(confirmDelete.id)
      toast.success("Contact deleted")
      setConfirmDelete(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="People you sell to."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button onClick={() => navigate("/contacts/new")}>
              <Plus className="h-4 w-4" />
              New contact
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, email, title, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Name: A → Z</SelectItem>
            <SelectItem value="name_desc">Name: Z → A</SelectItem>
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
          icon={Users}
          title={contacts.length === 0 ? "No contacts yet" : "No matches"}
          description={
            contacts.length === 0
              ? "Add your first contact to start tracking outreach."
              : "Try a different search term."
          }
          action={
            contacts.length === 0 ? (
              <Button onClick={() => navigate("/contacts/new")}>
                <Plus className="h-4 w-4" />
                New contact
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
                <TableHead className="hidden md:table-cell">Title</TableHead>
                <TableHead className="hidden lg:table-cell">Company</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => navigate(`/contacts/${c.id}/edit`)}
                      className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors"
                    >
                      {c.first_name} {c.last_name}
                    </button>
                    <div className="text-xs text-muted-foreground md:hidden">
                      {c.title}
                      {c.title && companyName(c.company_id) ? " · " : ""}
                      {companyName(c.company_id)}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {c.title ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {companyName(c.company_id) ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="hover:text-primary">
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {c.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Row actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/contacts/${c.id}/edit`)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setConfirmDelete(c)}
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
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
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

      <ImportDialog
        entity="contacts"
        open={importOpen}
        onOpenChange={setImportOpen}
        onComplete={refresh}
      />
    </div>
  )
}
