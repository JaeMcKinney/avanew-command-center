import { createContext, useContext } from "react"

export type Theme = "light" | "dark"

export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme")
    if (stored === "dark" || stored === "light") return stored
  } catch { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
