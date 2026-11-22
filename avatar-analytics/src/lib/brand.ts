// Whose name, logo and colours the app is wearing right now.
//
// Divigner's own look is the default and lives in index.css. An agency's look
// is data: seven colours for the light version, seven for the dark, and whether
// pages move. Everything else (borders, muted text, shadows, the sidebar's
// gradient) is worked out from those here, with readable contrast kept by
// construction. A stored look holds colours only, so it cannot carry anything
// else into the page.

import { useSyncExternalStore } from "react"
import divignerOnDark from "@/assets/divigner-logo-on-dark.webp"
import divignerOnLight from "@/assets/divigner-logo-on-light.webp"
import { contrast, isHexColor, luminance } from "@/lib/color"

export const THEME_KEYS = ["background", "card", "text", "action", "action_text", "highlight", "sidebar"] as const
export type ThemeKey = (typeof THEME_KEYS)[number]
export type ThemeMode = Record<ThemeKey, string>
export type Theme = { motion: boolean; light: ThemeMode; dark: ThemeMode }

export type AgencyBrand = {
  id: string
  name: string
  slug: string
  domain: string | null
  logo_light_url: string | null
  logo_dark_url: string | null
  icon_url: string | null
  theme: Theme | null
}

export const THEME_LABELS: Record<ThemeKey, { label: string; help: string }> = {
  background: { label: "Page", help: "Behind everything" },
  card: { label: "Panel", help: "Cards, tables and forms" },
  text: { label: "Text", help: "Headings and body text" },
  action: { label: "Action", help: "Main buttons and links" },
  action_text: { label: "Action Text", help: "Words on a main button" },
  highlight: { label: "Highlight", help: "Thin lines, glows and markers" },
  sidebar: { label: "Sidebar", help: "The staff menu" },
}

/** Avanew's look, from avanew.ai, with the gold softened for long sessions. */
export const AVANEW_THEME: Theme = {
  motion: true,
  light: { background: "#edf1f7", card: "#f8fafd", text: "#0b1f3a", action: "#1d3a66", action_text: "#ffffff", highlight: "#d4af4c", sidebar: "#0a1a30" },
  dark: { background: "#0b1828", card: "#10223a", text: "#e6ecf5", action: "#d9b95c", action_text: "#0b1f3a", highlight: "#d9b95c", sidebar: "#07111f" },
}

/** A calm, neutral place to start for an agency with no look yet. */
export const STARTER_THEME: Theme = {
  motion: false,
  light: { background: "#f1f3f6", card: "#fbfcfd", text: "#18212f", action: "#2b4c7e", action_text: "#ffffff", highlight: "#5b8def", sidebar: "#141c28" },
  dark: { background: "#111822", card: "#18212f", text: "#e7ecf3", action: "#8fb4f5", action_text: "#0f1722", highlight: "#8fb4f5", sidebar: "#0b1119" },
}

// ── Colour arithmetic ────────────────────────────────────────────────────────

const parts = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`

/** `amount` of `b` blended into `a`: 0 is all `a`, 1 is all `b`. */
export function mix(a: string, b: string, amount: number): string {
  const [x, y] = [parts(a), parts(b)]
  return hex(x.map((v, i) => v + (y[i] - v) * amount))
}
const alpha = (color: string, opacity: number) => `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`

/** Moves `color` toward `toward` until it reads at `ratio` or better on every surface given. */
function readable(color: string, toward: string, surfaces: string[], ratio: number): string {
  let out = color
  for (let step = 0; step < 20 && surfaces.some((s) => contrast(out, s) < ratio); step++) out = mix(out, toward, 0.12)
  return out
}

/** Every CSS variable the app uses, worked out from one version's seven colours. */
export function buildTokens(m: ThemeMode): Record<string, string> {
  const dark = luminance(m.background) < 0.2
  const muted = mix(m.background, m.text, 0.05)
  const secondary = mix(m.background, m.text, 0.08)
  const surfaces = [m.background, m.card, muted]
  const mutedForeground = readable(mix(m.text, m.background, 0.32), m.text, surfaces, 4.6)
  const primaryText = readable(m.action, m.text, surfaces, 4.6)
  const accent = mix(m.background, m.highlight, dark ? 0.2 : 0.24)
  const sidebarFg = contrast(m.sidebar, "#eef2f8") >= contrast(m.sidebar, "#0b1f3a") ? "#eef2f8" : "#0b1f3a"
  return {
    "--background": m.background,
    "--foreground": m.text,
    "--card": m.card,
    "--card-foreground": m.text,
    "--popover": m.card,
    "--popover-foreground": m.text,
    "--primary": m.action,
    "--primary-foreground": m.action_text,
    "--primary-text": primaryText,
    "--secondary": secondary,
    "--secondary-foreground": m.text,
    "--muted": muted,
    "--muted-foreground": mutedForeground,
    "--accent": accent,
    "--accent-foreground": readable(m.text, dark ? "#ffffff" : "#000000", [accent], 4.6),
    "--border": mix(m.background, m.text, 0.17),
    "--input": readable(mix(m.background, m.text, 0.45), m.text, [m.background, m.card], 3.1),
    "--ring": primaryText,
    "--info-soft": mix(m.background, m.action, dark ? 0.2 : 0.14),
    "--sidebar": m.sidebar,
    "--sidebar-foreground": sidebarFg,
    "--sidebar-muted": readable(mix(sidebarFg, m.sidebar, 0.3), sidebarFg, [m.sidebar], 4.6),
    "--sidebar-accent": mix(m.sidebar, sidebarFg, 0.13),
    "--sidebar-border": alpha(sidebarFg, 0.14),
    "--sidebar-surface": `linear-gradient(180deg, ${mix(m.sidebar, "#000000", 0.25)} 0%, ${m.sidebar} 55%, ${mix(m.sidebar, sidebarFg, 0.07)} 100%)`,
    "--chart-grid": mix(m.background, m.text, 0.11),
    "--chart-surface": m.card,
    "--brand": m.action,
    "--brand-foreground": m.action_text,
    "--gold": m.highlight,
    "--gold-glow": alpha(m.highlight, 0.48),
    "--edge-line": `linear-gradient(90deg, ${m.highlight}, ${mix(m.highlight, m.text, 0.45)} 50%, ${alpha(m.text, dark ? 0.3 : 0.85)})`,
    "--edge-opacity": dark ? "0.85" : "0.7",
    "--glow-a": alpha(m.highlight, dark ? 0.18 : 0.22),
    "--glow-b": alpha(dark ? mix(m.action, m.text, 0.3) : m.action, 0.14),
    "--header-bg": `linear-gradient(180deg, ${alpha(mix(m.card, dark ? m.background : "#ffffff", 0.5), 0.96)} 0%, ${alpha(mix(m.card, m.background, 0.5), 0.95)} 100%)`,
    "--panel-shadow": dark ? "0 24px 60px -36px #000000e6" : `0 24px 60px -44px ${alpha(m.text, 0.45)}, 0 2px 10px -6px ${alpha(m.text, 0.12)}`,
    "--card-edge": alpha(m.highlight, dark ? 0.22 : 0.32),
    "--backdrop": `linear-gradient(180deg, ${mix(m.background, m.card, 0.6)} 0%, ${m.background} 60%, ${mix(m.background, m.text, 0.035)} 100%)`,
  }
}

export function isTheme(value: unknown): value is Theme {
  if (!value || typeof value !== "object") return false
  const t = value as Partial<Theme>
  const mode = (m: unknown) =>
    !!m && typeof m === "object" && Object.keys(m).length === THEME_KEYS.length && THEME_KEYS.every((k) => isHexColor((m as Record<string, string>)[k] ?? ""))
  return typeof t.motion === "boolean" && mode(t.light) && mode(t.dark)
}

/** What would be hard to read in a look, in plain words. Empty when it is fine. */
export function themeProblems(theme: Theme): string[] {
  const found: string[] = []
  for (const [name, m] of [["light", theme.light], ["dark", theme.dark]] as const) {
    if (contrast(m.text, m.background) < 4.5 || contrast(m.text, m.card) < 4.5) found.push(`In the ${name} version, Text is too close to Page or Panel to read.`)
    if (contrast(m.action_text, m.action) < 4.5) found.push(`In the ${name} version, Action Text is too close to Action to read.`)
    if (contrast(m.action, m.card) < 1.6) found.push(`In the ${name} version, Action is nearly the same as Panel, so buttons would disappear.`)
  }
  if (luminance(theme.light.background) < 0.5) found.push("The light version's Page is dark. Use a pale colour there.")
  if (luminance(theme.dark.background) > 0.2) found.push("The dark version's Page is pale. Use a deep colour there.")
  return found
}

const declarations = (tokens: Record<string, string>) => Object.entries(tokens).map(([k, v]) => `${k}:${v}`).join(";")

/** The stylesheet for a look. `.dark` covers both the whole page and the sign-in card, which is always dark. */
export function themeCss(theme: Theme): string {
  return `:root{${declarations(buildTokens(theme.light))}}.dark{${declarations(buildTokens(theme.dark))}}`
}

// ── The brand in force ───────────────────────────────────────────────────────

export type Brand = {
  /** Null for Divigner's own. */
  agency: AgencyBrand | null
  /** The company as it is named in a sentence: "Ask Divigner to turn it on." */
  company: string
  companyFull: string
  logo: { onDark: string; onLight: string }
  motion: boolean
}

const DIVIGNER: Brand = { agency: null, company: "Divigner", companyFull: "Divigner Group", logo: { onDark: divignerOnDark, onLight: divignerOnLight }, motion: false }

function brandOf(agency: AgencyBrand | null): Brand {
  if (!agency) return DIVIGNER
  const theme = isTheme(agency.theme) ? agency.theme : null
  // One logo serves both versions when only one was uploaded.
  const onDark = agency.logo_dark_url ?? agency.logo_light_url ?? ""
  const onLight = agency.logo_light_url ?? agency.logo_dark_url ?? ""
  return { agency: { ...agency, theme }, company: agency.name, companyFull: agency.name, logo: { onDark, onLight }, motion: Boolean(theme?.motion) }
}

// The address the page was opened at can name an agency (its sign-in page);
// the person who signs in settles it.
let fromHost: AgencyBrand | null = null
let fromUser: AgencyBrand | null | undefined
let current: Brand = DIVIGNER
let fingerprint = "null"
const listeners = new Set<() => void>()

function apply() {
  const agency = fromUser !== undefined ? fromUser : fromHost
  const next = JSON.stringify(agency)
  if (next === fingerprint) return
  fingerprint = next
  current = brandOf(agency)
  if (typeof document !== "undefined") {
    const root = document.documentElement
    let style = document.getElementById("brand-theme")
    const theme = current.agency?.theme
    if (theme) {
      if (!style) {
        style = document.createElement("style")
        style.id = "brand-theme"
        document.head.appendChild(style)
      }
      style.textContent = themeCss(theme)
      root.dataset.brand = "agency"
    } else {
      style?.remove()
      delete root.dataset.brand
    }
    root.dataset.motion = current.motion ? "on" : "off"
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (icon) {
      icon.dataset.default ??= icon.getAttribute("href") ?? ""
      const href = current.agency?.icon_url ?? icon.dataset.default
      icon.setAttribute("href", href)
      icon.setAttribute("type", href.endsWith(".svg") ? "image/svg+xml" : "image/png")
    }
  }
  listeners.forEach((listener) => listener())
}

/** The agency named by the address the page was opened at, before anyone signs in. */
export function setHostBrand(agency: AgencyBrand | null) {
  fromHost = agency
  apply()
}

/** The signed-in person's agency (null for Divigner's own people). `undefined` when signed out. */
export function setUserBrand(agency: AgencyBrand | null | undefined) {
  fromUser = agency
  apply()
}

export const brand = () => current
export const company = () => current.company

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The brand in force, re-read whenever it changes. */
export function useBrand(): Brand {
  return useSyncExternalStore(subscribe, brand)
}
