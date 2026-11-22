// Whose name, logo and colours the app is wearing right now.
//
// Divigner's own look is the default and lives in index.css. An agency's look
// is data (see lib/look.ts) and is applied here as CSS variables.

import { useSyncExternalStore } from "react"
import divignerOnDark from "@/assets/divigner-logo-on-dark.webp"
import divignerOnLight from "@/assets/divigner-logo-on-light.webp"
import { isTheme, themeCss, type AgencyBrand } from "@/lib/look"

export * from "@/lib/look"

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
