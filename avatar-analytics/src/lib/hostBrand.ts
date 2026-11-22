// Before anyone signs in, the address the page was opened at says whose
// sign-in page this is. An agency's own address shows the agency's look;
// `?agency=<short name>` does the same on any address, for previews.

import { brandForHost } from "@/lib/api"
import { isTheme, setHostBrand, type AgencyBrand } from "@/lib/brand"

const CACHE = "avalytics-host-brand"
const PICKED = "avalytics-agency"

function read<T>(storage: Storage, key: string): T | null {
  try {
    return JSON.parse(storage.getItem(key) ?? "null") as T | null
  } catch {
    return null
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    if (value == null) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    // Private windows can refuse storage. The brand is then fetched on every visit.
  }
}

export function loadHostBrand() {
  const param = new URLSearchParams(window.location.search).get("agency")
  if (param !== null) write(window.sessionStorage, PICKED, param || null)
  const slug = read<string>(window.sessionStorage, PICKED)
  const host = window.location.host

  // Show the look from the last visit at once, then check it is still right.
  const cached = read<{ host: string; slug: string | null; brand: AgencyBrand }>(window.localStorage, CACHE)
  if (cached && cached.host === host && cached.slug === slug && cached.brand?.id && (cached.brand.theme === null || isTheme(cached.brand.theme))) setHostBrand(cached.brand)

  brandForHost(host, slug)
    .then((found) => {
      setHostBrand(found)
      write(window.localStorage, CACHE, found ? { host, slug, brand: found } : null)
    })
    .catch(() => undefined)
}
