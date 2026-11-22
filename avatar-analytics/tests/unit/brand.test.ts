// An agency's look is a handful of colours. Everything else is worked out, and
// has to stay readable whatever colours an agency picks.

import { describe, expect, it } from "vitest"
import { AVANEW_THEME, buildTokens, isTheme, STARTER_THEME, themeCss, themeProblems, type Theme } from "../../src/lib/brand"
import { contrast } from "../../src/lib/color"

const LOUD: Theme = {
  motion: false,
  light: { background: "#fff7ed", card: "#ffffff", text: "#431407", action: "#ea580c", action_text: "#ffffff", highlight: "#facc15", sidebar: "#fde68a" },
  dark: { background: "#1c1917", card: "#292524", text: "#fafaf9", action: "#fb923c", action_text: "#1c1917", highlight: "#fde047", sidebar: "#0c0a09" },
}

describe("the colours worked out from a look", () => {
  for (const [name, theme] of [["Avanew", AVANEW_THEME], ["the neutral starter", STARTER_THEME], ["a loud orange look", LOUD]] as const) {
    for (const mode of ["light", "dark"] as const) {
      it(`are readable for ${name}, ${mode} version`, () => {
        const t = buildTokens(theme[mode])
        for (const surface of [t["--background"], t["--card"], t["--muted"]]) {
          expect(contrast(t["--foreground"], surface)).toBeGreaterThanOrEqual(4.5)
          expect(contrast(t["--muted-foreground"], surface)).toBeGreaterThanOrEqual(4.5)
          expect(contrast(t["--primary-text"], surface)).toBeGreaterThanOrEqual(4.5)
        }
        expect(contrast(t["--accent-foreground"], t["--accent"])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(t["--sidebar-foreground"], t["--sidebar"])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(t["--sidebar-muted"], t["--sidebar"])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(t["--sidebar-foreground"], t["--sidebar-accent"])).toBeGreaterThanOrEqual(4.5)
        // Field outlines need to be seen against what they sit on.
        expect(contrast(t["--input"], t["--background"])).toBeGreaterThanOrEqual(3)
        expect(contrast(t["--input"], t["--card"])).toBeGreaterThanOrEqual(3)
      })
    }
  }

  it("puts dark words on a pale sidebar", () => {
    expect(buildTokens(LOUD.light)["--sidebar-foreground"]).toBe("#0b1f3a")
    expect(buildTokens(AVANEW_THEME.light)["--sidebar-foreground"]).toBe("#eef2f8")
  })

  it("keeps the ready-made looks free of problems", () => {
    expect(themeProblems(AVANEW_THEME)).toEqual([])
    expect(themeProblems(STARTER_THEME)).toEqual([])
    expect(themeProblems(LOUD).join(" ")).toMatch(/Action Text is too close to Action/)
  })

  it("says what is wrong with a look that cannot be read", () => {
    const pale = { ...AVANEW_THEME, light: { ...AVANEW_THEME.light, text: "#e5e7eb" } }
    expect(themeProblems(pale).join(" ")).toMatch(/light version, Text is too close/)
    const swapped = { ...AVANEW_THEME, light: AVANEW_THEME.dark, dark: AVANEW_THEME.light }
    expect(themeProblems(swapped)).toEqual(expect.arrayContaining([expect.stringMatching(/light version's Page is dark/), expect.stringMatching(/dark version's Page is pale/)]))
  })
})

describe("a stored look", () => {
  it("is colours and one switch, and nothing else", () => {
    expect(isTheme(AVANEW_THEME)).toBe(true)
    expect(isTheme(null)).toBe(false)
    expect(isTheme({ ...AVANEW_THEME, motion: "yes" })).toBe(false)
    expect(isTheme({ ...AVANEW_THEME, light: { ...AVANEW_THEME.light, extra: "#000000" } })).toBe(false)
    expect(isTheme({ ...AVANEW_THEME, dark: { ...AVANEW_THEME.dark, action: "red; } body { display: none" } })).toBe(false)
    expect(isTheme({ ...AVANEW_THEME, dark: { background: "#000000" } })).toBe(false)
  })

  it("becomes a stylesheet with a light and a dark block", () => {
    const css = themeCss(AVANEW_THEME)
    expect(css).toMatch(/^:root\{--background:#edf1f7;.*\}\.dark\{--background:#0b1828;.*\}$/)
    expect(css).not.toMatch(/[<>]|url\(|@import|expression/)
  })
})
