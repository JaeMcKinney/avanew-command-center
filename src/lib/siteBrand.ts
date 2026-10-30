// Which company's front door is this? Decided by hostname:
//   *.avanew.ai            → Avanew (Avanew branding, Avanew workspace)
//   everything else        → Divigner (ai-automation.divigner.com)
// On localhost / *.vercel.app you can preview the other brand with ?brand=avanew
// (sticky via localStorage; ?brand=divigner switches back).

export type SiteBrand = "avanew" | "divigner"

const OVERRIDE_KEY = "site-brand-override"

function isBrand(v: unknown): v is SiteBrand {
  return v === "avanew" || v === "divigner"
}

function detect(): SiteBrand {
  const host = window.location.hostname
  if (host === "avanew.ai" || host.endsWith(".avanew.ai")) return "avanew"

  const previewHost = host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")
  if (previewHost) {
    try {
      const q = new URLSearchParams(window.location.search).get("brand")
      if (isBrand(q)) {
        localStorage.setItem(OVERRIDE_KEY, q)
        return q
      }
      const saved = localStorage.getItem(OVERRIDE_KEY)
      if (isBrand(saved)) return saved
    } catch { /* storage blocked */ }
  }
  return "divigner"
}

export const SITE_BRAND: SiteBrand = detect()

type SiteConfig = {
  appName: string
  title: string
  favicon: string
  /** Wordmark for light / dark backgrounds. */
  logoLight: string
  logoDark: string
  /** The company's workspace. Members always land here. */
  homeOrgSlug: string
  /** Demo workspace for separate demo logins (users who aren't in the home org). */
  demoOrgSlug: string
}

const CONFIG: Record<SiteBrand, SiteConfig> = {
  avanew: {
    appName: "Avanew",
    title: "Avanew Command Center",
    favicon: "/brands/avanew/favicon.svg",
    logoLight: "/brands/avanew/avanew-logo-light.svg",
    logoDark: "/brands/avanew/avanew-logo-dark.svg",
    homeOrgSlug: "avanew",
    demoOrgSlug: "democo",
  },
  divigner: {
    appName: "Divigner",
    title: "Divigner AI Automations",
    favicon: "/favicon.png",
    logoLight: "/logos/divigner-logo-light.png",
    logoDark: "/logos/divigner-logo-dark.png",
    homeOrgSlug: "divigner",
    demoOrgSlug: "divigner-demo",
  },
}

export const SITE = CONFIG[SITE_BRAND]

/** Tag <html> with the brand so CSS can theme it, and set the tab title + icon. */
export function applySiteBrand() {
  const root = document.documentElement
  root.dataset.brand = SITE_BRAND
  document.title = SITE.title
  if (SITE_BRAND === "avanew") {
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((l) => l.remove())
    const icon = document.createElement("link")
    icon.rel = "icon"
    icon.type = "image/svg+xml"
    icon.href = SITE.favicon
    document.head.appendChild(icon)
  }
}
