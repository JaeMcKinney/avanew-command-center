import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isValidDay, presetRange, RANGE_LABELS, type DateRange, type RangePreset } from "@/lib/dates"
import { cn } from "@/lib/utils"

const PRESETS: RangePreset[] = ["today", "7d", "month", "quarter", "year", "custom"]

export type RangeState = { preset: RangePreset; range: DateRange }

/** Quick ranges plus a custom from/to. `today` is today in the client's time zone. */
export function DateRangeControl({ value, onChange, today }: { value: RangeState; onChange: (next: RangeState) => void; today: string }) {
  const [from, setFrom] = useState(value.range.from)
  const [to, setTo] = useState(value.range.to)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  function choose(preset: RangePreset) {
    setError(null)
    if (preset === "custom") {
      setFrom(value.range.from)
      setTo(value.range.to)
      onChange({ preset, range: value.range })
    } else {
      onChange({ preset, range: presetRange(preset, today) })
    }
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidDay(from) || !isValidDay(to)) return setError("Enter both dates.")
    if (from > to) return setError("The start date must be on or before the end date.")
    if (to > today) return setError("The end date cannot be in the future.")
    setError(null)
    onChange({ preset: "custom", range: { from, to } })
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Date range" className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={value.preset === preset}
            onClick={() => choose(preset)}
            className={cn(
              "min-h-10 flex-1 rounded-md px-3 text-sm font-medium whitespace-nowrap sm:flex-none",
              value.preset === preset ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {RANGE_LABELS[preset]}
          </button>
        ))}
      </div>

      {value.preset === "custom" && (
        <form onSubmit={applyCustom} className="flex flex-wrap items-end gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-from`}>From</Label>
            <Input id={`${id}-from`} type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="min-h-10 w-44" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-to`}>To</Label>
            <Input id={`${id}-to`} type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="min-h-10 w-44" />
          </div>
          <Button type="submit" className="min-h-10">Show</Button>
          {error && <p id={`${id}-error`} role="alert" className="w-full text-sm text-bad">{error}</p>}
        </form>
      )}
    </div>
  )
}
