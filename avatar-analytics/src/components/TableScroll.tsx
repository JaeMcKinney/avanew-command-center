import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Wraps a wide table so it scrolls sideways on small screens, by touch or with the keyboard. */
export function TableScroll({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn("relative overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}>
      {children}
    </div>
  )
}
