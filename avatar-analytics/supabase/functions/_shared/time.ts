// Tavus returns timestamps in a few shapes, for example
//   "2026-10-17T11:55:10.643621+00:00Z"  (an offset and a Z)
//   "2024-08-28 15:27:40.824457"         (a space, no zone; UTC)
//   "2025-07-11T06:48:37.564961Z"
// This turns any of them into an ISO string, or null if it is not a date.

export function toIso(value: unknown): string | null {
  if (typeof value !== "string") return null
  let s = value.trim()
  if (!s) return null
  s = s.replace(" ", "T")
  const hasOffset = /[+-]\d{2}:?\d{2}Z?$/.test(s)
  if (hasOffset) {
    s = s.replace(/Z$/, "")
  } else if (!/Z$/.test(s)) {
    s += "Z"
  }
  // Date only keeps milliseconds; trim longer fractions so every engine parses it.
  s = s.replace(/(\.\d{3})\d+/, "$1")
  const ms = Date.parse(s)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}
