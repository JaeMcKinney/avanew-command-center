import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { getRaLandingPage } from "@/lib/data"

const FRAME_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  border: "none",
  display: "block",
}

/** Inject the slug as a global so the template's self-hydrating JS can resolve
 *  its RA inside a srcdoc iframe (where there's no query string / path). */
function withSlug(demoHtml: string, slug: string): string {
  const tag = `<script>window.__RA_DEMO_SLUG__=${JSON.stringify(slug)};</script>`
  if (/<head[^>]*>/i.test(demoHtml)) {
    return demoHtml.replace(/<head[^>]*>/i, (m) => `${m}${tag}`)
  }
  return tag + demoHtml
}

export function RaDemoPage() {
  const { slug = "" } = useParams<{ slug: string }>()
  // null = still resolving; string = render this template demo HTML;
  // "" = no custom demo template, fall back to the static /demo.html file.
  const [demoHtml, setDemoHtml] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Divigner AI Automations"
  }, [])

  useEffect(() => {
    let alive = true
    getRaLandingPage(slug)
      .then((data) => {
        if (!alive) return
        setDemoHtml(data?.template_demo_html ?? "")
      })
      .catch(() => { if (alive) setDemoHtml("") })
    return () => { alive = false }
  }, [slug])

  // Still resolving — render nothing (avoids a flash of the static page before
  // a custom template takes over).
  if (demoHtml === null) {
    return <div style={{ position: "fixed", inset: 0, background: "#06101D" }} />
  }

  // Custom demo template — render its HTML with the slug injected.
  if (demoHtml) {
    return (
      <iframe
        title="Divigner AI Automations"
        srcDoc={withSlug(demoHtml, slug)}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        style={FRAME_STYLE}
      />
    )
  }

  // No custom demo template — fall back to the static self-hydrating page.
  const src = `/demo.html${slug ? `?ra=${encodeURIComponent(slug)}` : ""}`
  return <iframe src={src} title="Divigner AI Automations" style={FRAME_STYLE} />
}
