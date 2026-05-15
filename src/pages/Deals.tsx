import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Plus,
  Settings,
  Trophy,
  XCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  LayoutList,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"
import { StageManager } from "@/components/StageManager"
import {
  deleteDeal,
  listCompanies,
  listContacts,
  listDeals,
  listStages,
  moveDeal,
} from "@/lib/data"
import type { Company, Contact, Deal, PipelineStage } from "@/types/db"

const COLUMN_PREFIX = "column-"

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return null
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

export function Deals() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [deals, setDeals] = useState<Deal[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [stageManagerOpen, setStageManagerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Deal | null>(null)
  const [gridSearch, setGridSearch] = useState("")
  const [stageFilter, setStageFilter] = useState(() => searchParams.get("stage") ?? "all")
  const [sortBy, setSortBy] = useState("amount_desc")
  const [gridPage, setGridPage] = useState(1)
  const [gridPageSize, setGridPageSize] = useState(25)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  async function refresh() {
    setLoading(true)
    try {
      const [s, d, c, co] = await Promise.all([
        listStages(),
        listDeals(),
        listContacts(),
        listCompanies(),
      ])
      setStages(s)
      setDeals(d)
      setContacts(c)
      setCompanies(co)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load deals")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>()
    stages.forEach((s) => map.set(s.id, []))
    deals.forEach((d) => {
      if (!map.has(d.stage_id)) map.set(d.stage_id, [])
      map.get(d.stage_id)!.push(d)
    })
    map.forEach((list) => list.sort((a, b) => a.position - b.position))
    return map
  }, [deals, stages])

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

  const stageById = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages]
  )

  const gridDeals = useMemo(() => {
    const q = gridSearch.trim().toLowerCase()
    let result = deals.filter((d) => {
      if (stageFilter !== "all" && d.stage_id !== stageFilter) return false
      if (!q) return true
      const stage = stageById.get(d.stage_id)
      return (
        d.title.toLowerCase().includes(q) ||
        (companyName(d.company_id) ?? "").toLowerCase().includes(q) ||
        (contactName(d.contact_id) ?? "").toLowerCase().includes(q) ||
        (stage?.name ?? "").toLowerCase().includes(q)
      )
    })
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "amount_desc": return (b.amount ?? 0) - (a.amount ?? 0)
        case "amount_asc": return (a.amount ?? 0) - (b.amount ?? 0)
        case "title_asc": return a.title.localeCompare(b.title)
        case "title_desc": return b.title.localeCompare(a.title)
        case "close_asc":
          return (a.expected_close_date ?? "").localeCompare(b.expected_close_date ?? "")
        case "close_desc":
          return (b.expected_close_date ?? "").localeCompare(a.expected_close_date ?? "")
        default: return 0
      }
    })
    return result
  }, [deals, stageFilter, gridSearch, sortBy, stageById, companyName, contactName])

  const dealTotals = useMemo(() => {
    let pipeline = 0
    let won = 0
    let lost = 0
    for (const d of deals) {
      const s = stageById.get(d.stage_id)
      const amt = d.amount ?? 0
      if (!s) continue
      if (s.is_won) won += amt
      else if (s.is_lost) lost += amt
      else pipeline += amt
    }
    return { pipeline, won, lost, total: deals.length }
  }, [deals, stageById])

  const pagedGridDeals = useMemo(() => {
    const start = (gridPage - 1) * gridPageSize
    return gridDeals.slice(start, start + gridPageSize)
  }, [gridDeals, gridPage, gridPageSize])

  useEffect(() => { setGridPage(1) }, [gridSearch, stageFilter, sortBy])

  useEffect(() => {
    if (stageFilter === "all") {
      setSearchParams((prev) => { prev.delete("stage"); return prev }, { replace: true })
    } else {
      setSearchParams((prev) => { prev.set("stage", stageFilter); return prev }, { replace: true })
    }
  }, [stageFilter, setSearchParams])

  function openCreate(stageId?: string) {
    navigate(stageId ? `/deals/new?stage=${stageId}` : "/deals/new")
  }

  function openEdit(d: Deal) {
    navigate(`/deals/${d.id}/edit`)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteDeal(confirmDelete.id)
      toast.success("Deal deleted")
      setConfirmDelete(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  function onDragStart(e: DragStartEvent) {
    const d = deals.find((x) => x.id === String(e.active.id))
    if (d) setActiveDeal(d)
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveDeal(null)
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const dragged = deals.find((d) => d.id === activeId)
    if (!dragged) return

    let destStageId: string
    let overDealId: string | null = null
    if (overId.startsWith(COLUMN_PREFIX)) {
      destStageId = overId.slice(COLUMN_PREFIX.length)
    } else {
      const overDeal = deals.find((d) => d.id === overId)
      if (!overDeal) return
      destStageId = overDeal.stage_id
      overDealId = overDeal.id
    }

    const without = deals.filter((d) => d.id !== activeId)
    const destList = without
      .filter((d) => d.stage_id === destStageId)
      .sort((a, b) => a.position - b.position)

    const insertIdx =
      overDealId === null
        ? destList.length
        : Math.max(
            0,
            destList.findIndex((d) => d.id === overDealId)
          )

    const moved: Deal = { ...dragged, stage_id: destStageId, position: 0 }
    destList.splice(insertIdx, 0, moved)
    destList.forEach((d, i) => (d.position = i))

    const others = without.filter((d) => d.stage_id !== destStageId)
    setDeals([...others, ...destList])

    void (async () => {
      try {
        await moveDeal(
          activeId,
          destStageId,
          destList.map((d) => d.id)
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to move deal")
        void refresh()
      }
    })()
  }

  return (
    <div>
      <PageHeader
        title="Deals"
        description="Drag deals between stages as they progress."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setStageManagerOpen(true)}
            >
              <Settings className="h-4 w-4" />
              Manage stages
            </Button>
            <Button onClick={() => openCreate()}>
              <Plus className="h-4 w-4" />
              New deal
            </Button>
          </>
        }
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Loading...
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          {/* Mobile list view — visible only on <md */}
          <div className="md:hidden space-y-3">
            {stages.map((stage) => {
              const stageDeals = dealsByStage.get(stage.id) ?? []
              return (
                <div key={stage.id} className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
                    <div className="flex items-center gap-2">
                      {stage.is_won && <Trophy className="h-3.5 w-3.5 text-primary" />}
                      {stage.is_lost && <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-sm font-medium">{stage.name}</span>
                      <Badge variant="secondary">{stageDeals.length}</Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreate(stage.id)}
                      className="text-xs text-primary underline underline-offset-2"
                    >
                      + Add
                    </button>
                  </div>
                  {stageDeals.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No deals</p>
                  ) : (
                    <div className="divide-y">
                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          className="flex items-center justify-between px-4 py-3 gap-3"
                        >
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openEdit(deal)}
                              className="text-sm font-medium text-left hover:text-primary hover:underline underline-offset-2 truncate block w-full"
                            >
                              {deal.title}
                            </button>
                            {(companyName(deal.company_id) || contactName(deal.contact_id)) && (
                              <p className="text-xs text-muted-foreground truncate">
                                {companyName(deal.company_id) ?? contactName(deal.contact_id)}
                              </p>
                            )}
                          </div>
                          {deal.amount != null && (
                            <span className="text-sm font-semibold shrink-0 text-primary">
                              {fmtCurrency(deal.amount)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="hidden md:grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage.get(stage.id) ?? []}
                contactName={contactName}
                companyName={companyName}
                onAdd={() => openCreate(stage.id)}
                onEdit={openEdit}
                onDelete={setConfirmDelete}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDeal && (
              <DealCardSurface
                deal={activeDeal}
                contactName={contactName}
                companyName={companyName}
                dragging
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Deal totals summary */}
      {!loading && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total deals", value: String(dealTotals.total) },
            { label: "Pipeline value", value: fmtCurrency(dealTotals.pipeline) ?? "$0" },
            { label: "Won value", value: fmtCurrency(dealTotals.won) ?? "$0" },
            { label: "Lost value", value: fmtCurrency(dealTotals.lost) ?? "$0" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Grid view */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <LayoutList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            All deals
            {!loading && (
              <span className="ml-2 text-muted-foreground font-normal text-xs">
                {gridDeals.length} record{gridDeals.length !== 1 ? "s" : ""}
              </span>
            )}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search deals..."
              value={gridSearch}
              onChange={(e) => setGridSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount_desc">Amount: High → Low</SelectItem>
              <SelectItem value="amount_asc">Amount: Low → High</SelectItem>
              <SelectItem value="title_asc">Title: A → Z</SelectItem>
              <SelectItem value="title_desc">Title: Z → A</SelectItem>
              <SelectItem value="close_asc">Close date: Earliest</SelectItem>
              <SelectItem value="close_desc">Close date: Latest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loading ? null : gridDeals.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No deals match the current filters.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead className="hidden md:table-cell">Stage</TableHead>
                  <TableHead className="hidden md:table-cell">Account</TableHead>
                  <TableHead className="hidden lg:table-cell">Contact</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden lg:table-cell">Close Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedGridDeals.map((d) => {
                  const stage = stageById.get(d.stage_id)
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => navigate(`/deals/${d.id}/edit`)}
                          className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors"
                        >
                          {d.title}
                        </button>
                        <div className="text-xs text-muted-foreground md:hidden mt-0.5">
                          {stage?.name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {stage ? (
                          <span className="flex items-center gap-1">
                            {stage.is_won && <Trophy className="h-3 w-3 text-primary" />}
                            {stage.is_lost && <XCircle className="h-3 w-3" />}
                            {stage.name}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {companyName(d.company_id) ?? "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {contactName(d.contact_id) ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {d.amount != null ? fmtCurrency(d.amount) : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {d.expected_close_date
                          ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d.expected_close_date + "T00:00:00"))
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Deal actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/deals/${d.id}/edit`)}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setConfirmDelete(d)}
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
                total={gridDeals.length}
                page={gridPage}
                pageSize={gridPageSize}
                onPageChange={setGridPage}
                onPageSizeChange={setGridPageSize}
              />
            </div>
          </Card>
        )}
      </div>

      <StageManager
        open={stageManagerOpen}
        onOpenChange={setStageManagerOpen}
        onChanged={refresh}
      />

      <AlertDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" will be permanently removed. This can't
              be undone.
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

function KanbanColumn({
  stage,
  deals,
  contactName,
  companyName,
  onAdd,
  onEdit,
  onDelete,
}: {
  stage: PipelineStage
  deals: Deal[]
  contactName: (id: string | null) => string | null
  companyName: (id: string | null) => string | null
  onAdd: () => void
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${COLUMN_PREFIX}${stage.id}`,
  })
  const total = deals.reduce((s, d) => s + (d.amount ?? 0), 0)

  return (
    <Card
      className={cn(
        "min-h-[400px] bg-muted/40 flex flex-col gap-0 p-0 transition-colors",
        isOver && "ring-2 ring-primary"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between p-3 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {stage.is_won && <Trophy className="h-3.5 w-3.5 text-primary" />}
          {stage.is_lost && (
            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {stage.name}
        </CardTitle>
        <Badge variant="secondary">{deals.length}</Badge>
      </CardHeader>
      <div className="px-3 pb-2 text-xs text-muted-foreground">
        {total > 0 ? fmtCurrency(total) : "—"}
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 px-3 pb-3 space-y-2 min-h-[80px]"
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((d) => (
            <SortableDealCard
              key={d.id}
              deal={d}
              contactName={contactName}
              companyName={companyName}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Drag here or{" "}
            <button
              onClick={onAdd}
              className="text-primary underline underline-offset-2"
            >
              add a deal
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}

function SortableDealCard({
  deal,
  contactName,
  companyName,
  onEdit,
  onDelete,
}: {
  deal: Deal
  contactName: (id: string | null) => string | null
  companyName: (id: string | null) => string | null
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn("touch-none", isDragging && "opacity-30")}
    >
      <DealCardSurface
        deal={deal}
        contactName={contactName}
        companyName={companyName}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}

function DealCardSurface({
  deal,
  contactName,
  companyName,
  onEdit,
  onDelete,
  dragging,
}: {
  deal: Deal
  contactName: (id: string | null) => string | null
  companyName: (id: string | null) => string | null
  onEdit?: (deal: Deal) => void
  onDelete?: (deal: Deal) => void
  dragging?: boolean
}) {
  const company = companyName(deal.company_id)
  const contact = contactName(deal.contact_id)
  return (
    <div
      className={cn(
        "rounded-md bg-card border p-3 shadow-sm cursor-grab active:cursor-grabbing",
        dragging && "shadow-xl ring-2 ring-primary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onEdit?.(deal)}
          className={cn(
            "font-medium text-sm leading-snug flex-1 text-left transition-colors",
            !dragging && onEdit && "hover:text-primary hover:underline underline-offset-2"
          )}
        >
          {deal.title}
        </button>
        {!dragging && onEdit && onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-1 -mt-1 shrink-0"
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Deal actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={() => onEdit(deal)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(deal)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {deal.amount != null && (
        <div className="text-sm font-semibold mt-1">
          {fmtCurrency(deal.amount)}
        </div>
      )}
      {(company || contact) && (
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {company}
          {company && contact ? " · " : ""}
          {contact}
        </div>
      )}
    </div>
  )
}
