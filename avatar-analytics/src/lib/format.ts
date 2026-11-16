// Talk time is stored in seconds and shown in minutes, because plans are sold
// in minutes.

/** Whole minutes with thousands separators: 78,000 seconds → "1,300". */
export function minutes(seconds: number | null | undefined): string {
  return Math.round((seconds ?? 0) / 60).toLocaleString("en-US")
}

/** A single call's length: "2m 05s", or "1h 04m" for long ones. */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null) return "—"
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`
  return `${m}m ${String(s % 60).padStart(2, "0")}s`
}

export function count(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US")
}

export function percent(part: number, whole: number): string {
  if (!whole) return "0%"
  return `${Math.round((part / whole) * 100)}%`
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? "?") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase()
}

/** "northline-realty" from "Northline Realty, LLC". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
}

const SHUTDOWN_REASONS: Array<[RegExp, string]> = [
  [/max_call_duration/, "Reached the time limit"],
  [/participant_left/, "Visitor left"],
  [/participant_absent/, "Visitor never joined"],
  [/end_conversation_endpoint/, "Ended by the website"],
  [/exception|internal error|could_not_join/, "Technical problem"],
  [/room_has_been_deleted/, "Room closed"],
]

/** Tavus's shutdown reason in plain words. */
export function endedBecause(reason: string | null | undefined): string {
  if (!reason) return "—"
  return SHUTDOWN_REASONS.find(([pattern]) => pattern.test(reason))?.[1] ?? reason.replace(/_/g, " ")
}

/** "$397" or "$397.50", from an amount in cents. */
export function money(cents: number | null | undefined, currency = "usd"): string {
  const amount = (cents ?? 0) / 100
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount)
}
