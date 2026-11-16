import { Check, Copy, ExternalLink } from "lucide-react"
import { useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { DeploymentStatusPill } from "@/components/StatusPill"
import type { Deployment } from "@/lib/api"
import { embedFor } from "@/lib/embed"

/** One Tavus deployment: where it runs, and the code or link to use it. */
export function EmbedCode({ deployment }: { deployment: Deployment }) {
  const embed = embedFor(deployment)
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)
  const headingId = useId()

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard blocked: select the text so Ctrl/Cmd+C works.
      const range = document.createRange()
      if (codeRef.current) {
        range.selectNodeContents(codeRef.current)
        getSelection()?.removeAllRanges()
        getSelection()?.addRange(range)
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 id={headingId} className="font-sans text-sm font-semibold break-words">
            {deployment.name || embed.label}
          </h4>
          <p className="text-xs text-muted-foreground">
            {embed.label}
            {deployment.allowed_origins.length > 0 && <> · works on {deployment.allowed_origins.map((o) => o.replace(/^https?:\/\//, "")).join(", ")}</>}
          </p>
        </div>
        <DeploymentStatusPill status={deployment.status} />
      </div>

      {embed.kind === "code" ? (
        <>
          <pre ref={codeRef} tabIndex={0} aria-label={`Embed code for ${deployment.name || embed.label}`} className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
            {embed.code}
          </pre>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="min-h-9" onClick={() => copy(embed.code)}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy code"}
            </Button>
            <span aria-live="polite" className="sr-only">{copied ? "Embed code copied" : ""}</span>
            <span className="text-xs text-muted-foreground">Paste it into the page where the avatar should appear.</span>
          </div>
        </>
      ) : embed.url ? (
        <a href={embed.url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-sm text-primary-text hover:underline">
          Open the landing page <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">This is a page hosted by Tavus. Copy its link from PAL Maker in Tavus.</p>
      )}
    </section>
  )
}
