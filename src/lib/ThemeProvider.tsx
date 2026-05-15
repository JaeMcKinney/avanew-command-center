import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { ThemeContext, getInitialTheme } from "@/lib/theme"
import type { Theme } from "@/lib/theme"

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  const setTheme = (t: Theme) => setThemeState(t)
  const toggle = () => setThemeState((t) => (t === "dark" ? "light" : "dark"))

  // Sync class + localStorage whenever theme changes — one place, one source of truth
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try { localStorage.setItem("theme", theme) } catch { /* ignore */ }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
