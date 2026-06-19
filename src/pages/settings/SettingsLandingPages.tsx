import { useEffect, useState, useCallback, useRef } from "react"
import { Plus, Loader2, Trash2, Star, Save, Eye, Code2, User, Building2, Globe, MonitorPlay } from "lucide-react"
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
  setRaLandingTemplateDefaultForType,
  ensureDefaultRaTemplates,
  deleteRaLandingTemplate,
} from "@/lib/data"
import {
  MERGE_TAGS,
  STARTER_TEMPLATE,
  renderMergeTags,
  splitFormSlot,
  isFullPageTemplate,
  type MergeContext,
} from "@/lib/landingTemplate"
import type { RaLandingTemplate, RaType } from "@/types/db"
import { cn } from "@/lib/utils"

// Sample data used to render the live refer-page preview.
const PREVIEW_CTX: MergeContext = {
  ra_first_name: "Maria",
  ra_last_name:  "Lopez",
  ra_photo:      "https://i.pravatar.cc/240?img=47",
  ra_bio:        "I help founders connect with the right partners for growth.",
  ra_slug:       "maria-lopez",
  functions_url: "https://example.supabase.co/functions/v1/ra-lead-submit",
}

type ViewMode = "split" | "code" | "preview"
// Which page body is being edited.
type Body = "demo" | "refer"

const TYPE_META: Record<RaType, { label: string; icon: typeof User }> = {
  individual: { label: "Individual", icon: User },
  company:    { label: "Company",    icon: Building2 },
}

export function SettingsLandingPages() {
  const [templates, setTemplates] = useState<RaLandingTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [html, setHtml] = useState("")          // refer page body
  const [demoHtml, setDemoHtml] = useState("")  // demo page body
  const [body, setBody] = useState<Body>("demo")
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<ViewMode>("split")

  const [deleteTarget, setDeleteTarget] = useState<RaLandingTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const debounceRef = useRef<number | null>(null)
  const [previewHtml, setPreviewHtml] = useState("")

  // ── Load (and seed the two type-default templates if missing) ──
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await ensureDefaultRaTemplates().catch(() => {})
      const list = await listRaLandingTemplates()
      setTemplates(list)
      if (list.length && !selectedId) {
        select(list[0])
      } else if (selectedId) {
        const found = list.find((t) => t.id === selectedId)
        if (found && !dirty) select(found)
        if (!found) {
          setSelectedId(null); setName(""); setHtml(""); setDemoHtml(""); setDirty(false)
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
    setDemoHtml(t.demo_html ?? "")
    setDirty(false)
  }

  const activeHtml = body === "demo" ? demoHtml : html
  function setActiveHtml(next: string) {
    if (body === "demo") setDemoHtml(next)
    else setHtml(next)
    setDirty(true)
  }

  // ── Debounced preview rendering ──
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      if (body === "demo") {
        // Demo page self-hydrates via its own JS; the preview iframe runs with
        // no scripts, so it shows the static chrome + placeholder. Render raw.
        setPreviewHtml(renderMergeTags(demoHtml, PREVIEW_CTX))
        return
      }
      const rendered = renderMergeTags(html, PREVIEW_CTX)
      if (isFullPageTemplate(rendered)) {
        setPreviewHtml(rendered)
      } else {
        const { before, after } = splitFormSlot(rendered)
        const fakeForm = `
          <div style="border:1px solid #e5e7eb;border-radius:12px;padding:24px;background:#fff;max-width:480px;margin:0 auto;font-family:system-ui,sans-serif">
            <div style="display:grid;gap:12px">
              <input placeholder="Full Name" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit" />
              <input placeholder="Email" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit" />
              <input placeholder="Phone" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit" />
              <button style="padding:10px 14px;background:#0a1a2a;color:#fff;border:0;border-radius:8px;font:inherit;font-weight:600;cursor:pointer">Submit</button>
            </div>
          </div>
        `
        setPreviewHtml(before + fakeForm + after)
      }
    }, 250)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [activeHtml, body, html, demoHtml])

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
      await updateRaLandingTemplate(selectedId, { name, html, demo_html: demoHtml })
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

  async function handleSetDefaultForType(raType: RaType) {
    if (!selectedId) return
    try {
      await setRaLandingTemplateDefaultForType(selectedId, raType)
      toast.success(`Set as the default ${TYPE_META[raType].label} template`)
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
        setSelectedId(null); setName(""); setHtml(""); setDemoHtml(""); setDirty(false)
      }
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  const selected = templates.find((t) => t.id === selectedId)

  function typeBadge(t: RaLandingTemplate) {
    if (!t.default_for_type) return null
    const meta = TYPE_META[t.default_for_type]
    const Icon = meta.icon
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
        <Icon className="h-2.5 w-2.5" />
        Default · {meta.label}
      </Badge>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="RA Page Templates"
        description="Design the public Demo (/demo/:slug) and Refer (/refer/:slug) pages. New RAs use the default template for their type — RA Individual or RA Company — or override per RA."
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate flex-1">{t.name}</span>
                    {typeBadge(t)}
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
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {/* Default-for-type controls */}
                {(["individual", "company"] as const).map((rt) => {
                  const isDefault = selected.default_for_type === rt
                  const Icon = TYPE_META[rt].icon
                  return (
                    <Button
                      key={rt}
                      variant={isDefault ? "default" : "outline"}
                      size="sm"
                      className={cn("gap-1.5", isDefault && "bg-emerald-600 hover:bg-emerald-600/90")}
                      onClick={() => handleSetDefaultForType(rt)}
                      disabled={isDefault}
                      title={isDefault ? `Default ${TYPE_META[rt].label} template` : `Make the default ${TYPE_META[rt].label} template`}
                    >
                      {isDefault ? <Star className="h-3.5 w-3.5 fill-current" /> : <Icon className="h-3.5 w-3.5" />}
                      {isDefault ? `${TYPE_META[rt].label} default` : `Default for ${TYPE_META[rt].label}`}
                    </Button>
                  )
                })}

                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(selected)} title="Delete template">
                  <Trash2 className="h-4 w-4" />
                </Button>

                <Button size="sm" disabled={!dirty || saving} onClick={handleSave} className="gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </div>

            {/* Body switch (Demo / Refer) + view mode */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-md border overflow-hidden">
                <button
                  onClick={() => setBody("demo")}
                  className={cn("px-3 py-1.5 text-xs font-medium flex items-center gap-1.5", body === "demo" && "bg-muted")}
                >
                  <MonitorPlay className="h-3.5 w-3.5" /> Demo page
                </button>
                <button
                  onClick={() => setBody("refer")}
                  className={cn("px-3 py-1.5 text-xs font-medium border-l flex items-center gap-1.5", body === "refer" && "bg-muted")}
                >
                  <Globe className="h-3.5 w-3.5" /> Refer page
                </button>
              </div>
              <span className="text-xs text-muted-foreground">
                {body === "demo"
                  ? "Public marketing page at /demo/:slug"
                  : "Lead-capture page at /refer/:slug"}
              </span>

              <div className="ml-auto flex items-center rounded-md border overflow-hidden">
                <button
                  onClick={() => setView("code")}
                  className={cn("px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5", view === "code" && "bg-muted")}
                  title="Code only"
                >
                  <Code2 className="h-3.5 w-3.5" /> Code
                </button>
                <button
                  onClick={() => setView("split")}
                  className={cn("px-2.5 py-1.5 text-xs font-medium border-l", view === "split" && "bg-muted")}
                >
                  Split
                </button>
                <button
                  onClick={() => setView("preview")}
                  className={cn("px-2.5 py-1.5 text-xs font-medium border-l flex items-center gap-1.5", view === "preview" && "bg-muted")}
                  title="Preview only"
                >
                  <Eye className="h-3.5 w-3.5" /> Preview
                </button>
              </div>
            </div>

            {/* Editor + preview */}
            <div className={`grid gap-4 ${view === "split" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
              {(view === "code" || view === "split") && (
                <Textarea
                  value={activeHtml}
                  onChange={(e) => setActiveHtml(e.target.value)}
                  placeholder={body === "demo" ? "Paste the Demo page HTML here…" : "Paste the Refer page HTML here…"}
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

            {/* Merge tag legend — refer page only */}
            {body === "refer" && (
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
            )}
            {body === "demo" && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                The Demo page hydrates itself with the RA's live data (photo, name, bio, partner
                branding) from the slug, so the preview above shows the static layout with placeholders.
                Leave this blank to fall back to the built-in demo page.
              </div>
            )}
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
              Any RAs using it fall back to the default template for their type.
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
