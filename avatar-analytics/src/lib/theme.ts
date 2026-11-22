// Light or dark. The app follows the device until someone picks one with the
// switch; the choice is then kept in this browser.

const KEY = "avalytics-theme"
export type Theme = "light" | "dark"

function stored(): Theme | null {
  try {
    const value = window.localStorage.getItem(KEY)
    return value === "light" || value === "dark" ? value : null
  } catch {
    return null
  }
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  try {
    window.localStorage.setItem(KEY, theme)
  } catch {
    // Private windows can refuse storage. The choice then lasts for this visit.
  }
  window.dispatchEvent(new CustomEvent("avalytics:theme", { detail: theme }))
}

/** Keeps following the device's setting for as long as nobody has chosen. */
export function followDevice() {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (stored()) return
    document.documentElement.classList.toggle("dark", e.matches)
    window.dispatchEvent(new CustomEvent("avalytics:theme", { detail: e.matches ? "dark" : "light" }))
  })
}
