import { Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  count: number
  label?: string // singular noun, e.g. "lead"
  onDelete: () => void
  onClear: () => void
  disabled?: boolean
}

/**
 * Sticky bar that appears when ≥1 row is selected on a list page.
 * Shows a count, a Delete button, and a Clear button.
 */
export function BulkActionBar({ count, label = "record", onDelete, onClear, disabled }: Props) {
  if (count === 0) return null
  const noun = count === 1 ? label : `${label}s`
  return (
    <div className="sticky bottom-4 z-20 mb-2 flex items-center justify-between gap-3 rounded-lg border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
          {count}
        </span>
        <span className="text-muted-foreground">{noun} selected</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={disabled}
          className="gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={disabled}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  )
}
