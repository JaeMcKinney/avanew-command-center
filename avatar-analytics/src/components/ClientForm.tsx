import { useId, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isHexColor } from "@/lib/color"
import { slugify } from "@/lib/format"

export type ClientFormValues = { name: string; slug: string; timezone: string; brand_color: string; logo_url: string; status?: string }

const COMMON_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"]

function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone")
  } catch {
    return COMMON_ZONES
  }
}

/** Create or edit a client. In edit mode the web address (slug) is fixed. */
export function ClientForm({
  initial,
  mode,
  submitLabel,
  busy,
  error,
  onSubmit,
}: {
  initial: ClientFormValues
  mode: "create" | "edit"
  submitLabel: string
  busy: boolean
  error: string | null
  onSubmit: (values: ClientFormValues) => void
}) {
  const id = useId()
  const [values, setValues] = useState(initial)
  const [slugTouched, setSlugTouched] = useState(mode === "edit")
  const [problems, setProblems] = useState<Partial<Record<keyof ClientFormValues, string>>>({})
  const zones = useMemo(() => timeZones(), [])
  const set = (patch: Partial<ClientFormValues>) => setValues((v) => ({ ...v, ...patch }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const found: typeof problems = {}
    if (!values.name.trim()) found.name = "Enter the client's name."
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(values.slug)) found.slug = "Use lowercase letters, numbers and hyphens, for example northline-realty."
    if (values.brand_color && !isHexColor(values.brand_color)) found.brand_color = "Use a colour like #0F766E."
    if (values.logo_url && !/^https:\/\/\S+$/.test(values.logo_url)) found.logo_url = "The logo address must start with https://"
    setProblems(found)
    if (Object.keys(found).length === 0) onSubmit({ ...values, name: values.name.trim() })
    else document.getElementById(`${id}-${Object.keys(found)[0]}`)?.focus()
  }

  const describe = (field: keyof ClientFormValues, help?: string) => ({
    "aria-invalid": Boolean(problems[field]),
    "aria-describedby": [problems[field] ? `${id}-${field}-error` : null, help ? `${id}-${field}-help` : null].filter(Boolean).join(" ") || undefined,
  })
  const problem = (field: keyof ClientFormValues) =>
    problems[field] ? <p id={`${id}-${field}-error`} className="text-sm text-bad">{problems[field]}</p> : null

  return (
    <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Client name</Label>
        <Input
          id={`${id}-name`}
          value={values.name}
          onChange={(e) => set({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
          className="min-h-11"
          autoComplete="off"
          {...describe("name")}
        />
        {problem("name")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-slug`}>Portal address</Label>
        <Input
          id={`${id}-slug`}
          value={values.slug}
          disabled={mode === "edit"}
          onChange={(e) => { setSlugTouched(true); set({ slug: e.target.value.toLowerCase() }) }}
          className="min-h-11 font-mono"
          autoComplete="off"
          {...describe("slug", "help")}
        />
        <p id={`${id}-slug-help`} className="text-xs break-all text-muted-foreground">
          {mode === "edit" ? "The address cannot be changed after the client is created." : "The client signs in and sees their dashboard at"}{" "}
          <span className="font-mono">{window.location.origin}/c/{values.slug || "…"}</span>
        </p>
        {problem("slug")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-timezone`}>Time zone</Label>
        <select id={`${id}-timezone`} value={values.timezone} onChange={(e) => set({ timezone: e.target.value })} className="min-h-11 rounded-md border border-input bg-transparent px-3 text-sm" aria-describedby={`${id}-timezone-help`}>
          <optgroup label="United States">
            {COMMON_ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </optgroup>
          <optgroup label="All time zones">
            {zones.filter((z) => !COMMON_ZONES.includes(z)).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </optgroup>
        </select>
        <p id={`${id}-timezone-help`} className="text-xs text-muted-foreground">Decides which day a late-night call counts toward in their reports.</p>
      </div>

      {mode === "edit" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-status`}>Status</Label>
          <select id={`${id}-status`} value={values.status} onChange={(e) => set({ status: e.target.value })} className="min-h-11 rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="onboarding">Setting up</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      )}

      <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Branding (Optional)</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-brand_color`}>Brand colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick a brand colour"
              value={isHexColor(values.brand_color) ? values.brand_color : "#2f5bff"}
              onChange={(e) => set({ brand_color: e.target.value })}
              className="size-11 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
            />
            <Input id={`${id}-brand_color`} value={values.brand_color} onChange={(e) => set({ brand_color: e.target.value.trim() })} placeholder="#0F766E" className="min-h-11 max-w-40 font-mono" autoComplete="off" {...describe("brand_color")} />
          </div>
          {problem("brand_color")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-logo_url`}>Logo web address</Label>
          <Input id={`${id}-logo_url`} type="url" value={values.logo_url} onChange={(e) => set({ logo_url: e.target.value.trim() })} placeholder="https://example.com/logo.png" className="min-h-11" autoComplete="off" {...describe("logo_url", "help")} />
          <p id={`${id}-logo_url-help`} className="text-xs text-muted-foreground">A link to their logo image. Shown at the top of their portal.</p>
          {problem("logo_url")}
        </div>
      </fieldset>

      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div><Button type="submit" className="min-h-11" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button></div>
    </form>
  )
}
