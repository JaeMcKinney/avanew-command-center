import { useEffect } from "react"
import { useParams } from "react-router-dom"

export function RaDemoPage() {
  const { slug = "" } = useParams<{ slug: string }>()
  const src = `/demo.html${slug ? `?ra=${encodeURIComponent(slug)}` : ""}`

  useEffect(() => {
    document.title = "Divigner AI Automations"
  }, [])

  return (
    <iframe
      src={src}
      title="Divigner AI Automations"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none", display: "block" }}
    />
  )
}
