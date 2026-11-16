import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

/** An identifier (a Tavus PAL, face or conversation ID) shown in full, with one click to copy it. */
export function CopyId({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className={cn("text-xs text-muted-foreground", className)}>{label}: none</span>
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* the ID is on screen to select by hand */ }
  }
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="shrink-0">{label}</span>
      <code className="min-w-0 truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground select-all">{value}</code>
      <button type="button" onClick={() => void copy()} className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm hover:bg-muted" aria-label={copied ? `${label} copied` : `Copy ${label} ${value}`}>
        {copied ? <Check className="size-3.5 text-ok" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      </button>
      <span role="status" className="sr-only">{copied ? `${label} copied` : ""}</span>
    </span>
  )
}
