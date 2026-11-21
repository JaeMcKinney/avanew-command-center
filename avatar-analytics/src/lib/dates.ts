// Date ranges for reports. Days are plain "YYYY-MM-DD" strings, and "today"
// is today in the client's own time zone, so a client in Los Angeles and a
// client in New York each see their own day.

export type DateRange = { from: string; to: string }
export type RangePreset = "today" | "7d" | "month" | "quarter" | "year" | "custom"

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "7 days",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
  custom: "Custom",
}

export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

/** Today on the device being used. For staff screens that span clients. */
export function browserToday(): string {
  return todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone)
}

function parts(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return { y, m, d }
}

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
}

export function addDays(day: string, n: number): string {
  const { y, m, d } = parts(day)
  return iso(y, m, d + n)
}

export function startOfMonth(day: string): string {
  const { y, m } = parts(day)
  return iso(y, m, 1)
}

export function startOfQuarter(day: string): string {
  const { y, m } = parts(day)
  return iso(y, Math.floor((m - 1) / 3) * 3 + 1, 1)
}

export function startOfYear(day: string): string {
  return iso(parts(day).y, 1, 1)
}

export function presetRange(preset: Exclude<RangePreset, "custom">, today: string): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "7d":
      return { from: addDays(today, -6), to: today }
    case "month":
      return { from: startOfMonth(today), to: today }
    case "quarter":
      return { from: startOfQuarter(today), to: today }
    case "year":
      return { from: startOfYear(today), to: today }
  }
}

export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const { y, m, d } = parts(value)
  return iso(y, m, d) === value
}

/** Every day from `from` to `to`, inclusive. */
export function eachDay(range: DateRange): string[] {
  const days: string[] = []
  for (let day = range.from; day <= range.to && days.length < 800; day = addDays(day, 1)) days.push(day)
  return days
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Nov 12" or, with the year, "Nov 12, 2026". */
export function formatDay(day: string, withYear = false): string {
  const { y, m, d } = parts(day)
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ""}`
}

export function formatRange(range: DateRange): string {
  if (range.from === range.to) return formatDay(range.from, true)
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4)
  return `${formatDay(range.from, !sameYear)} – ${formatDay(range.to, true)}`
}

export function formatDateTime(isoString: string | null, timeZone: string): string {
  if (!isoString) return "—"
  return new Intl.DateTimeFormat("en-US", {
    timeZone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(isoString))
}

export function timeAgo(isoString: string | null, now: Date = new Date()): string {
  if (!isoString) return "never"
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(isoString).getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} hr ago`
  return `${Math.round(hours / 24)} days ago`
}
