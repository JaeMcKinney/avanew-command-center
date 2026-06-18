import { useState, useRef } from "react"
import { Camera, Upload, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { saveRaPhoto } from "@/lib/data"
import type { RaAssociate } from "@/types/db"

type Props = {
  ra: RaAssociate
  stepLabel?: string
  onComplete: (updated: Partial<RaAssociate>) => void
}

export function PhotoStep({ ra, stepLabel = "Step 1 of 4", onComplete }: Props) {
  const [preview, setPreview] = useState<string | null>(ra.photo_url ?? null)
  const [saving, setSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const cardStyle: React.CSSProperties = {
    background: isDragging ? "rgba(52,214,194,.06)" : "rgba(255,255,255,.04)",
    border: `1px solid ${isDragging ? "rgba(52,214,194,.5)" : "rgba(160,190,215,.15)"}`,
    borderRadius: "14px",
    padding: "40px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color .2s, background .2s",
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return }
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setSaving(true)
    try {
      const photoUrl = await saveRaPhoto(ra.id, file)
      onComplete({ photo_url: photoUrl, photo_completed: true })
      toast.success("Photo saved!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
      setPreview(ra.photo_url ?? null)
    } finally {
      setSaving(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(95,227,210,.7)" }}>
          {stepLabel}
        </p>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 600, color: "#EAF2F9" }}>
          Profile photo
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#A2B6C9", lineHeight: 1.6 }}>
          This photo will appear on your referral landing page. A clear headshot works best.
        </p>
      </div>

      {/* Upload area */}
      <div
        style={cardStyle}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        {preview ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <img
              src={preview}
              alt="Profile preview"
              style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(52,214,194,.4)" }}
            />
            {saving ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#A2B6C9", fontSize: "13px" }}>
                <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                Uploading…
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#34D6C2", fontSize: "13px" }}>
                {ra.photo_completed && <CheckCircle2 style={{ width: 14, height: 14 }} />}
                Click or drag to replace
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "rgba(52,214,194,.1)", borderRadius: "50%", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Camera style={{ width: 28, height: 28, color: "#34D6C2" }} />
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 500, color: "#EAF2F9" }}>
                {isDragging ? "Drop it here" : "Click to upload or drag & drop"}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#6E8499" }}>
                JPG, PNG, or WebP · max 5 MB
              </p>
            </div>
            {saving && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#A2B6C9", fontSize: "13px" }}>
                <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                Uploading…
              </div>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* Upload icon button for accessibility */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={saving}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          background: "linear-gradient(135deg,#18B9A6,#34D6C2)",
          border: "none", borderRadius: "10px", padding: "12px",
          fontSize: "14px", fontWeight: 700, color: "#06101D",
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.5 : 1,
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        <Upload style={{ width: 15, height: 15 }} />
        {preview ? "Change photo" : "Choose photo"}
      </button>
    </div>
  )
}
