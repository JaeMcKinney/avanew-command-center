import { useParams } from "react-router-dom"

export function RaDemoPage() {
  const { slug = "" } = useParams<{ slug: string }>()
  const src = `/demo.html${slug ? `?ra=${encodeURIComponent(slug)}` : ""}`

  return (
    <iframe
      src={src}
      title="Divigner Interactive Avatar Demo"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none", display: "block" }}
    />
  )
}
