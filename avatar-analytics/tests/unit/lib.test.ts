import { describe, expect, it } from "vitest"
import { contrast, readableOn } from "@/lib/color"
import { addDays, eachDay, formatRange, isValidDay, presetRange, todayIn } from "@/lib/dates"
import { embedFor } from "@/lib/embed"
import { duration, endedBecause, initials, minutes, percent, slugify } from "@/lib/format"

describe("dates", () => {
  it("knows what day it is in the client's time zone", () => {
    const instant = new Date("2026-11-11T03:30:00Z")
    expect(todayIn("America/New_York", instant)).toBe("2026-11-10")
    expect(todayIn("Asia/Kolkata", instant)).toBe("2026-11-11")
  })

  it("builds the preset ranges", () => {
    expect(presetRange("today", "2026-11-12")).toEqual({ from: "2026-11-12", to: "2026-11-12" })
    expect(presetRange("7d", "2026-11-03")).toEqual({ from: "2026-10-28", to: "2026-11-03" })
    expect(presetRange("month", "2026-11-12")).toEqual({ from: "2026-11-01", to: "2026-11-12" })
    expect(presetRange("quarter", "2026-11-12")).toEqual({ from: "2026-10-01", to: "2026-11-12" })
    expect(presetRange("quarter", "2026-03-31")).toEqual({ from: "2026-01-01", to: "2026-03-31" })
    expect(presetRange("year", "2026-11-12")).toEqual({ from: "2026-01-01", to: "2026-11-12" })
  })

  it("steps across month and leap-year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29")
    expect(eachDay({ from: "2026-02-27", to: "2026-03-02" })).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"])
  })

  it("validates and formats", () => {
    expect(isValidDay("2026-02-30")).toBe(false)
    expect(isValidDay("2026-02-28")).toBe(true)
    expect(isValidDay("11/12/2026")).toBe(false)
    expect(formatRange({ from: "2026-11-01", to: "2026-11-12" })).toBe("Nov 1 – Nov 12, 2026")
    expect(formatRange({ from: "2025-12-20", to: "2026-01-05" })).toBe("Dec 20, 2025 – Jan 5, 2026")
    expect(formatRange({ from: "2026-11-12", to: "2026-11-12" })).toBe("Nov 12, 2026")
  })
})

describe("format", () => {
  it("shows talk time in minutes", () => {
    expect(minutes(78_000)).toBe("1,300")
    expect(minutes(89)).toBe("1")
    expect(minutes(null)).toBe("0")
  })

  it("shows one call's length", () => {
    expect(duration(125)).toBe("2m 05s")
    expect(duration(3840)).toBe("1h 04m")
    expect(duration(null)).toBe("—")
  })

  it("handles shares, initials and slugs", () => {
    expect(percent(301, 468)).toBe("64%")
    expect(percent(1, 0)).toBe("0%")
    expect(initials("Maya · Northline Leasing Concierge")).toBe("MC")
    expect(initials("Zoey")).toBe("Z")
    expect(slugify("Northline Realty, LLC")).toBe("northline-realty-llc")
    expect(slugify("  Café & Crème  ")).toBe("cafe-and-creme")
  })

  it("explains why a call ended", () => {
    expect(endedBecause("max_call_duration reached")).toBe("Reached the time limit")
    expect(endedBecause("participant_left_timeout")).toBe("Visitor left")
    expect(endedBecause("exception_encountered_during_conversation_startup")).toBe("Technical problem")
    expect(endedBecause(null)).toBe("—")
  })
})

describe("brand colour", () => {
  it("picks readable text for any background", () => {
    expect(readableOn("#0f766e")).toBe("#ffffff")
    expect(readableOn("#ffd400")).toBe("#0b1c2b")
    expect(contrast("#2f5bff", "#ffffff")).toBeGreaterThan(4.5)
  })
})

describe("embed code", () => {
  it("matches Tavus's snippet for each kind of deployment", () => {
    const embed = embedFor({ deployment_id: "abc-123", channel: "embed", page_url: null })
    expect(embed).toMatchObject({ kind: "code" })
    expect(embed.kind === "code" && embed.code).toContain('<tavus-embed deployment-id="abc-123"></tavus-embed>')
    const widget = embedFor({ deployment_id: "abc-123", channel: "widget", page_url: null })
    expect(widget.kind === "code" && widget.code).toContain('<tavus-widget deployment-id="abc-123"></tavus-widget>')
    expect(embedFor({ deployment_id: "x", channel: "landing-page", page_url: "https://x.maker.tavus.io" })).toEqual({
      kind: "link", label: "Landing Page", url: "https://x.maker.tavus.io",
    })
  })
})

describe("chart scale and buckets", () => {
  it("picks round gridlines", async () => {
    const { niceScale } = await import("@/lib/scale")
    expect(niceScale(0)).toEqual({ top: 4, step: 1 })
    expect(niceScale(44)).toEqual({ top: 60, step: 20 })
    expect(niceScale(212)).toEqual({ top: 300, step: 100 })
    expect(niceScale(9)).toEqual({ top: 10, step: 2.5 })
  })

  it("groups by day, week or month depending on the length of the range", async () => {
    const { bucketColumns, grainFor } = await import("@/lib/buckets")
    expect(grainFor({ from: "2026-11-01", to: "2026-11-12" })).toBe("day")
    expect(grainFor({ from: "2026-10-01", to: "2026-11-12" })).toBe("week")
    expect(grainFor({ from: "2026-01-01", to: "2026-11-12" })).toBe("month")

    const seconds = new Map([["2026-11-01", 600], ["2026-11-03", 120], ["2026-10-31", 6000]])
    const days = bucketColumns({ from: "2026-11-01", to: "2026-11-03" }, seconds)
    expect(days.map((c) => [c.label, c.value])).toEqual([["Nov 1", 10], ["Nov 2", 0], ["Nov 3", 2]])

    const months = bucketColumns({ from: "2026-01-01", to: "2026-11-12" }, seconds)
    expect(months).toHaveLength(11)
    expect(months.at(-1)).toMatchObject({ label: "Nov", longLabel: "Nov 2026", value: 12 })
    expect(months.at(-2)).toMatchObject({ label: "Oct", value: 100 })

    const weeks = bucketColumns({ from: "2026-10-01", to: "2026-11-12" }, seconds)
    expect(weeks).toHaveLength(7)
    expect(weeks.at(-1)).toMatchObject({ longLabel: "Nov 12 – Nov 12, 2026" })
    expect(weeks.reduce((sum, w) => sum + w.value, 0)).toBe(112)
  })
})
