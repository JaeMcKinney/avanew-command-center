import { useEffect, useState, useCallback, useRef } from "react"
import { Plus, Loader2, Trash2, Star, StarOff, Save, Eye, Code2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import {
  listRaLandingTemplates,
  createRaLandingTemplate,
  updateRaLandingTemplate,
  setRaLandingTemplateDefault,
  deleteRaLandingTemplate,
} from "@/lib/data"
import {
  MERGE_TAGS,
  STARTER_TEMPLATE,
  renderMergeTags,
  splitFormSlot,
  type MergeContext,
} from "@/lib/landingTemplate"
import type { RaLandingTemplate } from "@/types/db"

// Sample data used to render the live preview.
const PREVIEW_CTX: MergeContext = {
  ra_first_name: "Maria",
  ra_last_name:  "Lopez",
  ra_photo:      "https://i.pravatar.cc/240?img=47",
  ra_bio:        "I help founders connect with the right partners for growth.",
  ra_slug:       "maria-lopez",
}

type ViewMode = "split" | "code" | "preview"

export function SettingsLandingPages() {
  const [templates, setTemplates] = useState<RaLandingTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [html, setHtml] = useState("")
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<ViewMode>("split")

  const [deleteTarget, setDeleteTarget] = useState<RaLandingTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const debounceRef = useRef<number | null>(null)
  const [previewHtml, setPreviewHtml] = useState("")

  // ── Load ──
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listRaLandingTemplates()
      setTemplates(list)
      if (list.length && !selectedId) {
        select(list[0])
      } else if (selectedId) {
        // refresh selection in case name/default changed
        const found = list.find((t) => t.id === selectedId)
        if (found && !dirty) select(found)
        if (!found) {
          setSelectedId(null); setName(""); setHtml(""); setDirty(false)
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load templates")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, dirty])

  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function select(t: RaLandingTemplate) {
    setSelectedId(t.id)
    setName(t.name)
    setHtml(t.html)
    setDirty(false)
  }

  // ── Debounced preview rendering ──
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const rendered = renderMergeTags(html, PREVIEW_CTX)
      const { before, after } = splitFormSlot(rendered)
      // In the preview pane we render a fake static form so layout is faithful.
      const fakeForm = `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:24px;background:#fff;max-width:480px;margin:0 auto;font-family:system-ui,sans-serif">
          <div style="display:grid;gap:12px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <input placeholder="First name" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit" />
              <input placeholder="Last name" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit" />
            </div>
            <input placeholder="Email" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit" />
            <input placeholder="Phone" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit" />
            <textarea placeholder="How can we help?" rows="3" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit;resize:vertical"></textarea>
            <button style="padding:10px 14px;background:#0a1a2a;color:#fff;border:0;border-radius:8px;font:inherit;font-weight:600;cursor:pointer">Submit</button>
          </div>
        </div>
      `
      setPreviewHtml(before + fakeForm + after)
    }, 250)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [html])

  // ── Actions ──
  async function handleNew() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return
    try {
      const created = await createRaLandingTemplate("Untitled template", STARTER_TEMPLATE)
      toast.success("Template created")
      const list = await listRaLandingTemplates()
      setTemplates(list)
      select(created)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template")
    }
  }

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    try {
      await updateRaLandingTemplate(selectedId, { name, html })
      toast.success("Saved")
      setDirty(false)
      const list = await listRaLandingTemplates()
      setTemplates(list)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleSetDefault() {
    if (!selectedId) return
    try {
      await setRaLandingTemplateDefault(selectedId)
      toast.success("Set as default")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set default")
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRaLandingTemplate(deleteTarget.id)
      toast.success(`Deleted "${deleteTarget.name}"`)
      const wasSelected = selectedId === deleteTarget.id
      setDeleteTarget(null)
      if (wasSelected) {
        setSelectedId(null); setName(""); setHtml(""); setDirty(false)
      }
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  const selected = templates.find((t) => t.id === selectedId)

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Landing Pages"
        description="Design the public referral page templates used at /refer/:slug. Set one as the default for your organization, or override per RA."
      />

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-start">

        {/* ── Left: template list ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
              Templates
            </p>
            <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={handleNew}>
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>

          <div className="rounded-md border divide-y bg-card">
            {loading ? (
              <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : templates.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No templates yet.<br />
                Click <span className="font-medium">New</span> to create one.
              </div>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (dirty && t.id !== selectedId && !window.confirm("Discard unsaved changes?")) return
                    select(t)
                  }}
                  className={`w-full text-left p-3 text-sm hover:bg-muted/50 transition-colors ${
                    t.id === selectedId ? "bg-muted/70" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate flex-1">{t.name}</span>
                    {t.is_default && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Default
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right: editor ── */}
        {selected ? (
          <div className="space-y-4 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setDirty(true) }}
                placeholder="Template name"
                className="max-w-xs"
              />
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center rounded-md border overflow-hidden">
                  <button
                    onClick={() => setView("code")}
                    className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 ${view === "code" ? "bg-muted" : ""}`}
                    title="Code only"
                  >
                    <Code2 className="h-3.5 w-3.5" /> Code
                  </button>
                  <button
                    onClick={() => setView("split")}
                    className={`px-2.5 py-1.5 text-xs font-medium border-l ${view === "split" ? "bg-muted" : ""}`}
                  >
                    Split
                  </button>
                  <button
                    onClick={() => setView("preview")}
                    className={`px-2.5 py-1.5 text-xs font-medium border-l flex items-center gap-1.5 ${view === "preview" ? "bg-muted" : ""}`}
                    title="Preview only"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                </div>

                {!selected.is_default && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSetDefault}>
                    <Star className="h-3.5 w-3.5" />
                    Set default
                  </Button>
                )}
                {selected.is_default && (
                  <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                    <StarOff className="h-3 w-3" /> Org default
                  </Badge>
                )}

                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(selected)} title="Delete template">
                  <Trash2 className="h-4 w-4" />
                </Button>

                <Button size="sm" disabled={!dirty || saving} onClick={handleSave} className="gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </div>

            {/* Editor + preview */}
            <div className={`grid gap-4 ${view === "split" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
              {(view === "code" || view === "split") && (
                <Textarea
                  value={html}
                  onChange={(e) => { setHtml(e.target.value); setDirty(true) }}
                  placeholder="Paste HTML here…"
                  spellCheck={false}
                  className="font-mono text-xs leading-relaxed h-[560px] resize-none"
                />
              )}
              {(view === "preview" || view === "split") && (
                <div className="rounded-md border bg-white overflow-hidden h-[560px]">
                  <iframe
                    title="Preview"
                    srcDoc={previewHtml}
                    sandbox=""
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>

            {/* Merge tag legend */}
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Available merge tags
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {MERGE_TAGS.map(({ tag, description }) => (
                  <div key={tag} className="flex items-baseline gap-2">
                    <code className="font-mono text-[11px] bg-background px-1.5 py-0.5 rounded border">{tag}</code>
                    <span className="text-muted-foreground">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-12 text-center text-sm text-muted-foreground">
            Select a template on the left to edit, or click <span className="font-medium">New</span> to create one.
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be permanently deleted.
              Any RAs assigned to this template will fall back to the organization default.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleConfirmDelete}
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
