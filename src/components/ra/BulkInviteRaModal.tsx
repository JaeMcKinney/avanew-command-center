import { useEffect, useMemo, useRef, useState } from "react"
import {
  Upload, Loader2, CheckCircle2, AlertCircle, Trash2, Plus, FileText, Send, User, Building2,
} from "lucide-react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { inviteRa, listRaAssociates } from "@/lib/data"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { RaType } from "@/types/db"

type Props = {
  open: boolean
  onClose: () => void
  onInvited: () => void
}

type Row = {
  id: string
  first_name: string
  last_name: string
  email: string
  slug: string
  ra_type: RaType
  status: "valid" | "duplicate-email" | "duplicate-slug" | "invalid-email" | "invalid-slug" | "missing-name"
  message?: string
}

/** Normalize a free-form type cell ("individual" / "company" / "ind" / "co" / "") to a RaType. */
function parseRaType(raw: string | undefined): RaType {
  const s = (raw ?? "").trim().toLowerCase()
  if (s === "company" || s === "co" || s === "org" || s === "business") return "company"
  return "individual"
}

/** Compact two-button Individual/Company toggle, used inline per-row and in the validation preview. */
function RaTypeToggle({
  value, onChange, disabled, size = "sm",
}: { value: RaType; onChange: (v: RaType) => void; disabled?: boolean; size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "h-7 px-1.5 text-[10px]" : "h-9 px-2 text-xs"
  return (
    <div className={cn("inline-flex items-center rounded-md border overflow-hidden shrink-0", disabled && "opacity-60")}>
      {([
        { value: "individual" as const, label: "Indiv", icon: User },
        { value: "company" as const, label: "Co", icon: Building2 },
      ]).map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1 font-medium transition-colors",
              cls,
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
            title={opt.value === "company" ? "Company / partner brand" : "Individual partner"}
          >
            <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const MAX_ROWS = 100

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function emailValid(e: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }
function slugValidShape(s: string): boolean { return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s) && s.length >= 2 && s.length <= 60 }

type ManualRow = Partial<Row> & { ra_type?: RaType }

export function BulkInviteRaModal({ open, onClose, onInvited }: Props) {
  const [activeTab, setActiveTab] = useState<"csv" | "paste" | "manual">("csv")
  const [pasted, setPasted] = useState("")
  const [manualRows, setManualRows] = useState<ManualRow[]>([
    { ra_type: "individual" }, { ra_type: "individual" }, { ra_type: "individual" },
  ])
  const [rows, setRows] = useState<Row[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set())
  const [existingSlugs, setExistingSlugs] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    void listRaAssociates().then((list) => {
      setExistingEmails(new Set(list.map((r) => r.email.toLowerCase())))
      setExistingSlugs(new Set(list.map((r) => r.slug)))
    })
  }, [open])

  function reset() {
    setActiveTab("csv"); setPasted("")
    setManualRows([{ ra_type: "individual" }, { ra_type: "individual" }, { ra_type: "individual" }])
    setRows([]); setSubmitting(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  function validate(raw: Array<{ first_name?: string; last_name?: string; email?: string; slug?: string; ra_type?: RaType | string }>): Row[] {
    const seenEmail = new Set<string>()
    const seenSlug = new Set<string>()
    const out: Row[] = []
    for (const r of raw.slice(0, MAX_ROWS)) {
      const first = (r.first_name ?? "").trim()
      const last = (r.last_name ?? "").trim()
      const email = (r.email ?? "").trim().toLowerCase()
      const slug = r.slug?.trim() ? slugify(r.slug.trim()) : slugify(`${first} ${last}`)
      const ra_type: RaType = r.ra_type === "company" || r.ra_type === "individual"
        ? r.ra_type
        : parseRaType(typeof r.ra_type === "string" ? r.ra_type : undefined)
      const row: Row = {
        id: crypto.randomUUID(),
        first_name: first, last_name: last, email, slug, ra_type,
        status: "valid",
      }
      if (!first || !last) { row.status = "missing-name"; row.message = "Missing first/last name" }
      else if (!emailValid(email)) { row.status = "invalid-email"; row.message = "Email is invalid" }
      else if (existingEmails.has(email) || seenEmail.has(email)) {
        row.status = "duplicate-email"; row.message = "Email already invited"
      } else if (!slugValidShape(slug)) { row.status = "invalid-slug"; row.message = "Slug is invalid" }
      else if (existingSlugs.has(slug) || seenSlug.has(slug)) {
        row.status = "duplicate-slug"; row.message = "Slug already in use"
      }
      if (row.status === "valid") { seenEmail.add(email); seenSlug.add(slug) }
      out.push(row)
    }
    return out
  }

  function handleCsvFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        const raw = result.data.map((r) => ({
          first_name: r.first_name ?? r.first ?? r.firstname,
          last_name:  r.last_name  ?? r.last  ?? r.lastname  ?? r.surname,
          email:      r.email,
          slug:       r.slug ?? r.url ?? r.referral_url,
          ra_type:    parseRaType(r.ra_type ?? r.type),
        }))
        setRows(validate(raw))
        if (!raw.length) toast.error("No rows found in CSV. Expected headers: first_name, last_name, email, slug, ra_type (optional)")
      },
      error: (err) => toast.error(`CSV error: ${err.message}`),
    })
  }

  function parsePastedTable() {
    const lines = pasted.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!lines.length) { setRows([]); return }
    const splitCols = (line: string) =>
      line.includes("\t") ? line.split("\t") : line.includes(",") ? line.split(",") : line.split(/\s+/)
    const raw = lines.map((line) => {
      const [first, last, email, slug, type] = splitCols(line).map((c) => c.trim())
      return { first_name: first, last_name: last, email, slug, ra_type: parseRaType(type) }
    })
    setRows(validate(raw))
  }

  function applyManual() {
    setRows(validate(manualRows.filter((r) => r.first_name || r.last_name || r.email)))
  }

  function updateManual(i: number, patch: Partial<ManualRow>) {
    setManualRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function addManualRow() {
    if (manualRows.length >= MAX_ROWS) { toast.error(`Max ${MAX_ROWS} rows`); return }
    setManualRows((prev) => [...prev, { ra_type: "individual" }])
  }

  function removeManualRow(i: number) {
    setManualRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  const validRows = useMemo(() => rows.filter((r) => r.status === "valid"), [rows])
  const errorRows = useMemo(() => rows.filter((r) => r.status !== "valid"), [rows])

  async function sendAll() {
    if (!validRows.length) return
    setSubmitting(true)
    let success = 0
    const failures: { row: Row; message: string }[] = []
    for (const r of validRows) {
      try {
        await inviteRa({ first_name: r.first_name, last_name: r.last_name, email: r.email, slug: r.slug, ra_type: r.ra_type })
        success++
      } catch (err) {
        failures.push({ row: r, message: err instanceof Error ? err.message : "Unknown error" })
      }
    }
    setSubmitting(false)
    if (success) toast.success(`Sent ${success} invite${success === 1 ? "" : "s"}`)
    if (failures.length) {
      toast.error(`${failures.length} invite${failures.length === 1 ? "" : "s"} failed`)
    }
    onInvited()
    if (!failures.length) handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk invite Referral Associates</DialogTitle>
          <DialogDescription>
            Upload a CSV, paste a list, or enter rows by hand. Each invite triggers a sign-in email and starts
            the 6-step onboarding. Max {MAX_ROWS} per batch.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="csv">CSV upload</TabsTrigger>
            <TabsTrigger value="paste">Paste list</TabsTrigger>
            <TabsTrigger value="manual">Manual entry</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pt-4 space-y-4">
            <TabsContent value="csv" className="space-y-3 mt-0">
              <div
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer p-8 text-center"
              >
                <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload a CSV</p>
                <p className="text-xs text-muted-foreground">
                  Headers: <code>first_name, last_name, email, slug, ra_type</code> (slug and ra_type optional)
                </p>
              </div>
              <input
                ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f) }}
              />
              <div className="text-xs text-muted-foreground border rounded-md p-3 bg-muted/40">
                <p className="font-mono">first_name,last_name,email,slug,ra_type</p>
                <p className="font-mono">Jordan,Lee,jordan@example.com,jordan-lee,individual</p>
                <p className="font-mono">Acme,Partners,team@acme.com,acme,company</p>
                <p className="font-mono">Avery,Smith,avery@example.com,,</p>
                <p className="mt-2 italic">ra_type defaults to individual. Accepted values: individual, company.</p>
              </div>
            </TabsContent>

            <TabsContent value="paste" className="space-y-3 mt-0">
              <Label className="text-xs">Paste rows (tab or comma separated). One per line: <span className="font-mono">first last email slug ra_type</span> (ra_type optional)</Label>
              <Textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder="Jordan&#9;Lee&#9;jordan@example.com&#9;jordan-lee&#9;individual&#10;Acme&#9;Partners&#9;team@acme.com&#9;acme&#9;company"
                className="font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={parsePastedTable} disabled={!pasted.trim()}>
                <FileText className="h-3.5 w-3.5" /> Parse pasted rows
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="space-y-3 mt-0">
              <div className="space-y-2">
                {manualRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_1fr_auto_auto] gap-2 items-center">
                    <Input placeholder="First" value={r.first_name ?? ""} onChange={(e) => updateManual(i, { first_name: e.target.value })} />
                    <Input placeholder="Last" value={r.last_name ?? ""} onChange={(e) => updateManual(i, { last_name: e.target.value })} />
                    <Input placeholder="email@example.com" value={r.email ?? ""} onChange={(e) => updateManual(i, { email: e.target.value })} />
                    <Input placeholder="slug (auto)" value={r.slug ?? ""} onChange={(e) => updateManual(i, { slug: e.target.value })} className="font-mono" />
                    <RaTypeToggle value={r.ra_type ?? "individual"} onChange={(v) => updateManual(i, { ra_type: v })} />
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => removeManualRow(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Each row chooses its own type — Individual for a single named partner, Company for a partner brand or org.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addManualRow}>
                  <Plus className="h-3.5 w-3.5" /> Add row
                </Button>
                <Button size="sm" onClick={applyManual}>
                  <FileText className="h-3.5 w-3.5" /> Validate
                </Button>
              </div>
            </TabsContent>

            {/* Validation preview */}
            {rows.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between text-xs">
                  <span>
                    <span className="text-primary font-medium">{validRows.length} valid</span>
                    {errorRows.length > 0 && (
                      <> · <span className="text-destructive font-medium">{errorRows.length} with errors</span></>
                    )}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setRows([])}>Clear</Button>
                </div>
                <div className="max-h-[260px] overflow-y-auto">
                  {rows.map((r) => (
                    <div key={r.id} className="flex items-start gap-2 px-3 py-2 border-b last:border-0 text-xs">
                      {r.status === "valid"
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        : <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {r.first_name || r.last_name ? `${r.first_name} ${r.last_name}`.trim() : "—"}
                          <span className="ml-2 text-muted-foreground font-normal">{r.email || "no email"}</span>
                        </p>
                        <p className="text-muted-foreground font-mono truncate">/demo/{r.slug || "—"}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] gap-1 shrink-0 capitalize">
                        {r.ra_type === "company"
                          ? <><Building2 className="h-2.5 w-2.5" /> Company</>
                          : <><User className="h-2.5 w-2.5" /> Individual</>}
                      </Badge>
                      {r.status !== "valid" && (
                        <Badge variant="destructive" className="text-[10px] shrink-0">{r.message}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-4 sm:items-center">
          {validRows.length > 0 && (
            <div className="mr-auto text-xs text-muted-foreground">
              {validRows.filter((r) => r.ra_type === "individual").length} individual ·{" "}
              {validRows.filter((r) => r.ra_type === "company").length} company
            </div>
          )}
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={sendAll} disabled={!validRows.length || submitting}>
            {submitting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending {validRows.length}…</>
              : <><Send className="h-3.5 w-3.5" /> Send {validRows.length} invite{validRows.length === 1 ? "" : "s"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
