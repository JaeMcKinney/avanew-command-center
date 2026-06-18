import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import type { RaLead } from "@/lib/data"
import { updateLeadStage } from "@/lib/data"
import { formatMoney } from "@/lib/commissions"

type BoardStage = Exclude<RaLead["stage"], "closed_lost">

const COLUMNS: { id: BoardStage; label: string }[] = [
  { id: "new",            label: "New" },
  { id: "qualified",      label: "Qualified" },
  { id: "proposal_sent",  label: "Proposal Sent" },
  { id: "call_booked",    label: "Call Booked" },
  { id: "closed_won",     label: "Closed Won" },
]

type Variant = "light" | "dark"

interface Props {
  leads: RaLead[]
  variant?: Variant
  onLeadsChange?: (next: RaLead[]) => void
}

export function PipelineBoard({ leads, variant = "light", onLeadsChange }: Props) {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const visible = leads.filter((l) => l.stage !== "closed_lost")
  const byStage: Record<BoardStage, RaLead[]> = {
    new: [], qualified: [], proposal_sent: [], call_booked: [], closed_won: [],
  }
  for (const l of visible) byStage[l.stage as BoardStage]?.push(l)

  const active = activeId ? visible.find((l) => l.id === activeId) ?? null : null

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const leadId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    if (!overId) return
    const newStage = overId as BoardStage
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.stage === newStage) return
    const next = leads.map((l) =>
      l.id === leadId ? { ...l, stage: newStage, updated_at: new Date().toISOString() } : l
    )
    onLeadsChange?.(next)
    try { await updateLeadStage(leadId, newStage) }
    catch { onLeadsChange?.(leads) }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            label={col.label}
            leads={byStage[col.id]}
            variant={variant}
            onCardClick={(id) => navigate(`/leads/${id}`)}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? <CardBody lead={active} variant={variant} dragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  id, label, leads, variant, onCardClick,
}: {
  id: BoardStage
  label: string
  leads: RaLead[]
  variant: Variant
  onCardClick: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const isDark = variant === "dark"

  return (
    <div
      ref={setNodeRef}
      className={[
        "rounded-xl border flex flex-col min-h-[160px]",
        isDark ? "border-white/10 bg-white/[.03]" : "border-border bg-muted/30",
        isOver ? (isDark ? "ring-1 ring-[#34D6C2]/60" : "ring-1 ring-primary/50") : "",
      ].join(" ")}
    >
      <div
        className={[
          "px-3 py-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider border-b",
          isDark ? "border-white/[.06] text-white/60" : "border-border text-muted-foreground",
        ].join(" ")}
        style={isDark ? { fontFamily: "Manrope, sans-serif" } : undefined}
      >
        <span>{label}</span>
        <span className={isDark ? "text-white/40" : "text-muted-foreground"}>{leads.length}</span>
      </div>
      <div className="p-2 space-y-2 flex-1">
        {leads.length === 0 ? (
          <p
            className={["text-xs text-center py-6", isDark ? "text-white/25" : "text-muted-foreground/60"].join(" ")}
            style={isDark ? { fontFamily: "Manrope, sans-serif" } : undefined}
          >
            —
          </p>
        ) : (
          leads.map((l) => (
            <DraggableCard key={l.id} lead={l} variant={variant} onClick={() => onCardClick(l.id)} />
          ))
        )}
      </div>
    </div>
  )
}

function DraggableCard({ lead, variant, onClick }: { lead: RaLead; variant: Variant; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return
        e.stopPropagation()
        onClick()
      }}
      className={isDragging ? "opacity-30" : ""}
    >
      <CardBody lead={lead} variant={variant} />
    </div>
  )
}

function CardBody({ lead, variant, dragging }: { lead: RaLead; variant: Variant; dragging?: boolean }) {
  const isDark = variant === "dark"
  return (
    <div
      className={[
        "rounded-lg border p-3 cursor-grab active:cursor-grabbing select-none",
        isDark ? "border-white/10 bg-[#0B1422]" : "border-border bg-card",
        dragging ? "shadow-lg" : "",
      ].join(" ")}
      style={isDark ? { fontFamily: "Manrope, sans-serif" } : undefined}
    >
      <p className={["text-sm font-medium truncate", isDark ? "text-white/90" : ""].join(" ")}>
        {lead.name}
      </p>
      {lead.company && (
        <p className={["text-xs truncate mt-0.5", isDark ? "text-white/50" : "text-muted-foreground"].join(" ")}>
          {lead.company}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className={["text-[11px]", isDark ? "text-white/40" : "text-muted-foreground"].join(" ")}>
          {new Date(lead.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
        {lead.value ? (
          <span className={["text-[11px] font-medium", isDark ? "text-[#34D6C2]" : ""].join(" ")}>
            {formatMoney(lead.value)}
          </span>
        ) : null}
      </div>
    </div>
  )
}
