// Groups daily usage into columns for the chart: by day for short ranges, by
// week for a quarter, by month for a year, so the bars never get too thin.

import { addDays, eachDay, formatDay, type DateRange } from "@/lib/dates"

export type Column = { key: string; label: string; longLabel: string; value: number }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export type Grain = "day" | "week" | "month"

export function grainFor(range: DateRange): Grain {
  const days = eachDay(range).length
  if (days <= 35) return "day"
  if (days <= 125) return "week"
  return "month"
}

export const GRAIN_LABEL: Record<Grain, string> = { day: "By day", week: "By week", month: "By month" }

/**
 * `secondsByDay` maps "YYYY-MM-DD" to seconds. Values come back in minutes.
 * Pass `per = 1` to add up plain counts instead.
 */
export function bucketColumns(range: DateRange, secondsByDay: Map<string, number>, per = 60): Column[] {
  const grain = grainFor(range)
  const days = eachDay(range)
  const columns: Column[] = []
  const byKey = new Map<string, Column>()

  for (const day of days) {
    let key = day
    let label = formatDay(day)
    let longLabel = formatDay(day, true)
    if (grain === "week") {
      // Weeks are counted from the first day of the range.
      const index = Math.floor(days.indexOf(day) / 7)
      const start = addDays(range.from, index * 7)
      const end = addDays(start, 6) > range.to ? range.to : addDays(start, 6)
      key = start
      label = formatDay(start)
      longLabel = `${formatDay(start)} – ${formatDay(end, true)}`
    } else if (grain === "month") {
      key = day.slice(0, 7)
      const month = MONTHS[Number(day.slice(5, 7)) - 1]
      label = month
      longLabel = `${month} ${day.slice(0, 4)}`
    }
    let column = byKey.get(key)
    if (!column) {
      column = { key, label, longLabel, value: 0 }
      byKey.set(key, column)
      columns.push(column)
    }
    column.value += (secondsByDay.get(day) ?? 0) / per
  }
  return columns
}
