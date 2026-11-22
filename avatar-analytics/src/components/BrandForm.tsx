// An agency's look: its logos, its colours for the light and the dark version,
// and whether pages move. Used by Divigner in the agency's file and by the
// agency's own staff on their Brand page.

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useId, useState, type CSSProperties } from "react"
import { toast } from "sonner"
import avanewIcon from "@/assets/avanew-icon.svg"
import avanewOnDark from "@/assets/avanew-logo-on-dark.svg"
import avanewOnLight from "@/assets/avanew-logo-on-light.svg"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { saveAgencyBrand, uploadAgencyImage, type Agency } from "@/lib/api"
import { AVANEW_THEME, buildTokens, isTheme, STARTER_THEME, THEME_KEYS, THEME_LABELS, themeProblems, type Theme, type ThemeKey, type ThemeMode } from "@/lib/brand"
import { isHexColor } from "@/lib/color"
import { toPng } from "@/lib/image"

type Slot = "logo_light_url" | "logo_dark_url" | "icon_url"
/** A picture chosen in this form and not saved yet. */
type Pending = { blob: Blob; preview: string }

const SLOTS: Array<{ key: Slot; label: string; help: string; ground: string; box: [number, number] }> = [
  { key: "logo_light_url", label: "Logo for Light Backgrounds", help: "Shown on the light version.", ground: "#ffffff", box: [900, 300] },
  { key: "logo_dark_url", label: "Logo for Dark Backgrounds", help: "Shown on the dark version, the sidebar and the sign-in page.", ground: "#0b1828", box: [900, 300] },
  { key: "icon_url", label: "Tab Icon", help: "The small square picture in the browser tab.", ground: "#ffffff", box: [128, 128] },
]

/** Saves an agency's pictures and look. Shared with the New Agency form, which starts an agency from Avanew's look. */
// eslint-disable-next-line react-refresh/only-export-components
export async function saveAvanewLook(agencyId: string): Promise<Agency> {
  const [light, dark, icon] = await Promise.all([toPng(avanewOnLight, 900, 300), toPng(avanewOnDark, 900, 300), toPng(avanewIcon, 128, 128)])
  const [logo_light_url, logo_dark_url, icon_url] = await Promise.all([light, dark, icon].map((png) => uploadAgencyImage(agencyId, png)))
  return saveAgencyBrand(agencyId, { theme: AVANEW_THEME, logo_light_url, logo_dark_url, icon_url })
}

/** A small mock of the app in one version of a look, drawn with the same colour arithmetic the app uses. */
function Preview({ mode, name, logo }: { mode: ThemeMode; name: string; logo: string | null }) {
  const style = { ...buildTokens(mode), background: "var(--backdrop)" } as CSSProperties
  return (
    <div aria-hidden="true" className="grid min-h-44 grid-cols-[5.5rem_minmax(0,1fr)] overflow-hidden rounded-md border text-[11px]" style={style}>
      <div className="flex flex-col gap-2 p-2" style={{ background: "var(--sidebar-surface)", color: "var(--sidebar-foreground)" }}>
        {logo ? <img src={logo} alt="" className="h-6 w-full object-contain object-left" /> : <span className="truncate font-display text-xs font-semibold">{name}</span>}
        <span className="rounded-sm px-1.5 py-1" style={{ background: "var(--sidebar-accent)", boxShadow: "inset 2px 0 0 var(--gold)" }}>Overview</span>
        <span className="px-1.5" style={{ color: "var(--sidebar-muted)" }}>Clients</span>
        <span className="px-1.5" style={{ color: "var(--sidebar-muted)" }}>Avatars</span>
      </div>
      <div className="flex min-w-0 flex-col gap-2 p-3" style={{ color: "var(--foreground)" }}>
        <p className="font-display text-sm font-semibold">Overview</p>
        <div className="flex flex-col gap-1 rounded-md border p-2" style={{ background: "var(--card)", borderColor: "var(--card-edge)", backgroundImage: "var(--edge-line)", backgroundSize: "100% 2px", backgroundRepeat: "no-repeat" }}>
          <span className="font-semibold tracking-wide uppercase" style={{ color: "var(--muted-foreground)", fontSize: 9 }}>This Month</span>
          <span className="font-display text-lg leading-none font-semibold">533 <span className="font-sans text-[10px]" style={{ color: "var(--muted-foreground)" }}>min</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-sm px-2 py-1 font-semibold" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>New client</span>
          <span className="font-semibold" style={{ color: "var(--primary-text)" }}>Show as table</span>
        </div>
      </div>
    </div>
  )
}

function ColorField({ id, label, help, value, onChange }: { id: string; label: string; help: string; value: string; onChange: (next: string) => void }) {
  const valid = isHexColor(value)
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color" aria-label={`${label}, colour picker`} value={valid ? value : "#000000"} onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
        />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value.trim())} aria-invalid={!valid} aria-describedby={`${id}-help`} className="min-h-10 font-mono" maxLength={7} />
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">{valid ? help : "Use a colour like #1D3A66."}</p>
    </div>
  )
}

export function BrandForm({ agency }: { agency: Agency }) {
  const id = useId()
  const queryClient = useQueryClient()
  const { refresh } = useAuth()
  const saved = isTheme(agency.theme) ? agency.theme : null
  const [theme, setTheme] = useState<Theme>(saved ?? STARTER_THEME)
  const [urls, setUrls] = useState<Record<Slot, string | null>>({ logo_light_url: agency.logo_light_url, logo_dark_url: agency.logo_dark_url, icon_url: agency.icon_url })
  const [pending, setPending] = useState<Partial<Record<Slot, Pending>>>({})
  const [busy, setBusy] = useState<Slot | "preset" | null>(null)
  // A web address typed for a picture, as the other way to give one.
  const [typed, setTyped] = useState<Partial<Record<Slot, string>>>({})
  const badAddress = (slot: Slot) => Boolean(typed[slot]) && !/^https:\/\/\S+$/.test(typed[slot] ?? "")
  const addressesOk = SLOTS.every((slot) => !badAddress(slot.key))

  function typeAddress(slot: Slot, value: string) {
    setTyped((t) => ({ ...t, [slot]: value }))
    if (/^https:\/\/\S+$/.test(value)) {
      // A typed address replaces a file chosen for the same picture.
      setPending((p) => Object.fromEntries(Object.entries(p).filter(([key]) => key !== slot)))
      setUrls((u) => ({ ...u, [slot]: value }))
    }
  }

  const valid = (["light", "dark"] as const).every((m) => THEME_KEYS.every((k) => isHexColor(theme[m][k])))
  const problems = valid ? themeProblems(theme) : []
  const shown = (slot: Slot) => pending[slot]?.preview ?? urls[slot]

  const setColor = (mode: "light" | "dark", key: ThemeKey, value: string) => setTheme((t) => ({ ...t, [mode]: { ...t[mode], [key]: value } }))

  async function choose(slot: Slot, file: File | undefined, box: [number, number]) {
    if (!file) return
    setBusy(slot)
    try {
      const blob = await toPng(file, ...box)
      if (blob.size > 1_000_000) throw new Error("That picture is too large once prepared. Use a simpler or smaller one.")
      setPending((p) => ({ ...p, [slot]: { blob, preview: URL.createObjectURL(blob) } }))
      setTyped((t) => ({ ...t, [slot]: "" }))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  /** Loads Avanew's colours and logos into the form. Nothing is saved until Save. */
  async function loadAvanew() {
    setBusy("preset")
    try {
      const [light, dark, icon] = await Promise.all([toPng(avanewOnLight, 900, 300), toPng(avanewOnDark, 900, 300), toPng(avanewIcon, 128, 128)])
      setTheme(AVANEW_THEME)
      setPending({
        logo_light_url: { blob: light, preview: URL.createObjectURL(light) },
        logo_dark_url: { blob: dark, preview: URL.createObjectURL(dark) },
        icon_url: { blob: icon, preview: URL.createObjectURL(icon) },
      })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const next = { ...urls }
      for (const slot of Object.keys(pending) as Slot[]) next[slot] = await uploadAgencyImage(agency.id, pending[slot]!.blob)
      return saveAgencyBrand(agency.id, { theme, ...next })
    },
    onSuccess: async (row) => {
      setUrls({ logo_light_url: row.logo_light_url, logo_dark_url: row.logo_dark_url, icon_url: row.icon_url })
      setPending({})
      setTyped({})
      toast.success("Brand saved.")
      await queryClient.invalidateQueries({ queryKey: ["agency"] })
      // Anyone wearing this brand, this person included, sees it at once.
      await refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && addressesOk && !problems.length) save.mutate()
      }}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4">
        <p className="mr-auto text-sm text-muted-foreground">Start from a ready-made look, then adjust anything below.</p>
        <Button type="button" variant="outline" className="min-h-10" disabled={busy !== null} onClick={() => void loadAvanew()}>{busy === "preset" ? "Loading…" : "Use Avanew's look"}</Button>
        <Button type="button" variant="outline" className="min-h-10" onClick={() => setTheme(STARTER_THEME)}>Use a neutral look</Button>
      </div>

      <section aria-labelledby={`${id}-logos`} className="flex flex-col gap-3">
        <h3 id={`${id}-logos`} className="font-sans text-base font-semibold">Logos</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {SLOTS.map((slot) => (
            <div key={slot.key} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
              <Label htmlFor={`${id}-${slot.key}`}>{slot.label}</Label>
              <div className="flex h-20 items-center justify-center overflow-hidden rounded-md border p-2" style={{ background: slot.ground }}>
                {shown(slot.key)
                  ? <img src={shown(slot.key)!} alt={`${slot.label}, as it is now`} className="h-full w-full object-contain" />
                  : <span className="text-xs" style={{ color: slot.ground === "#ffffff" ? "#44546b" : "#a9b6ca" }}>None yet</span>}
              </div>
              <input
                id={`${id}-${slot.key}`} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-describedby={`${id}-${slot.key}-help`}
                disabled={busy !== null} onChange={(e) => void choose(slot.key, e.target.files?.[0], slot.box)}
                className="text-sm file:mr-3 file:min-h-9 file:rounded-sm file:border file:border-input file:bg-transparent file:px-3 file:text-sm file:font-medium"
              />
              <p id={`${id}-${slot.key}-help`} className="text-xs text-muted-foreground">{slot.help} Upload a PNG, JPG, WebP or SVG.</p>
              <Label htmlFor={`${id}-${slot.key}-address`} className="mt-1">Or a Web Address</Label>
              <Input
                id={`${id}-${slot.key}-address`} type="url" value={typed[slot.key] ?? ""} onChange={(e) => typeAddress(slot.key, e.target.value.trim())}
                placeholder="https://example.com/logo.png" autoComplete="off" className="min-h-10"
                aria-invalid={badAddress(slot.key)} aria-describedby={`${id}-${slot.key}-address-help`}
              />
              <p id={`${id}-${slot.key}-address-help`} className={badAddress(slot.key) ? "text-xs text-bad" : "text-xs text-muted-foreground"}>
                {badAddress(slot.key) ? "The address must start with https://" : "For a picture that is already online."}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby={`${id}-colours`} className="flex flex-col gap-3">
        <h3 id={`${id}-colours`} className="font-sans text-base font-semibold">Colors</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["light", "dark"] as const).map((mode) => (
            <fieldset key={mode} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
              <legend className="px-1 text-sm font-semibold">{mode === "light" ? "Light Version" : "Dark Version"}</legend>
              {valid && <Preview mode={theme[mode]} name={agency.name} logo={shown("logo_dark_url") ?? shown("logo_light_url")} />}
              <div className="grid gap-4 sm:grid-cols-2">
                {THEME_KEYS.map((key) => (
                  <ColorField key={key} id={`${id}-${mode}-${key}`} label={THEME_LABELS[key].label} help={THEME_LABELS[key].help} value={theme[mode][key]} onChange={(v) => setColor(mode, key, v)} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Borders, muted text, hovers and shadows are worked out from these, and kept readable.</p>
      </section>

      <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
        <Checkbox id={`${id}-motion`} className="mt-0.5 size-5" checked={theme.motion} onCheckedChange={(on) => setTheme((t) => ({ ...t, motion: on === true }))} />
        <div>
          <Label htmlFor={`${id}-motion`}>Gentle motion</Label>
          <p className="text-sm text-muted-foreground">Slow drifting glows behind pages, a soft fade as a page opens, and voice lines on the sign-in page. Anyone whose device asks for less motion never sees it.</p>
        </div>
      </div>

      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-lg border border-bad bg-bad-soft p-4 text-sm">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      <div>
        <Button type="submit" className="min-h-11" disabled={!valid || !addressesOk || problems.length > 0 || save.isPending || busy !== null}>{save.isPending ? "Saving…" : "Save brand"}</Button>
      </div>
    </form>
  )
}
