import { useRef, useState } from "react"
import { CheckCircle2, Download, FileText, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { saveRaW9 } from "@/lib/data"
import { ReviewerCommentsBanner } from "@/components/ra/ReviewerCommentsBanner"
import type { RaAssociate, RaSectionComment } from "@/types/db"

type Props = {
  ra: RaAssociate
  stepLabel?: string
  onComplete: (updated: Partial<RaAssociate>) => void
  reviewerComments?: RaSectionComment[]
}

const IRS_W9_BLANK_URL = "https://www.irs.gov/pub/irs-pdf/fw9.pdf"

export function W9Step({ ra, stepLabel = "Step 5 of 6", onComplete, reviewerComments = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [filename, setFilename] = useState<string | null>(
    ra.w9_document_url ? decodeURIComponent(ra.w9_document_url.split("/").pop() ?? "W-9.pdf") : null
  )
  const [isDragging, setIsDragging] = useState(false)

  async function handleFile(file: File) {
    setSaving(true)
    try {
      const saved = await saveRaW9(ra.id, file)
      setFilename(file.name)
      onComplete({
        w9_completed: true,
        w9_document_url: saved.w9_document_url,
        w9_uploaded_at: saved.w9_uploaded_at,
      })
      toast.success("W-9 uploaded — Divigner will review within 1 business day")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
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

  const uploaded = Boolean(ra.w9_completed) || filename !== null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <div>
        <p style={{
          margin: "0 0 4px", fontSize: "11px", fontWeight: 600,
          letterSpacing: "0.14em", textTransform: "uppercase",
          color: "rgba(95,227,210,.7)",
        }}>
          {stepLabel}
        </p>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 600, color: "#EAF2F9", fontFamily: "'Fraunces', serif" }}>
          W-9 · Tax information
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#A2B6C9", lineHeight: 1.6 }}>
          Download the blank IRS Form W-9, complete and sign it offline, then upload the signed PDF here.
          Divigner reviews W-9s within one business day. Your SSN/EIN is never typed into the portal — it
          lives only inside the PDF.
        </p>
      </div>

      <ReviewerCommentsBanner section="w9" comments={reviewerComments} />

      {/* Step 1 — download blank */}
      <div style={{
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(160,190,215,.15)",
        borderRadius: "12px",
        padding: "16px 18px",
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
      }}>
        <div style={{
          background: "rgba(52,214,194,.1)",
          borderRadius: "8px",
          width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Download style={{ width: 18, height: 18, color: "#34D6C2" }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#EAF2F9" }}>
            1. Download the blank W-9
          </p>
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#A2B6C9", lineHeight: 1.6 }}>
            The official IRS Form W-9 (Request for Taxpayer Identification Number and Certification).
          </p>
          <a
            href={IRS_W9_BLANK_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              fontSize: "13px", fontWeight: 600, color: "#34D6C2",
              textDecoration: "none",
            }}
          >
            <Download style={{ width: 13, height: 13 }} />
            Download fw9.pdf from irs.gov
          </a>
        </div>
      </div>

      {/* Step 2 — upload completed */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          background: isDragging ? "rgba(52,214,194,.06)" : "rgba(255,255,255,.04)",
          border: `1px solid ${isDragging ? "rgba(52,214,194,.5)" : "rgba(160,190,215,.15)"}`,
          borderRadius: "12px",
          padding: "24px 24px",
          cursor: "pointer",
          transition: "border-color .2s, background .2s",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "14px",
        }}
      >
        <div style={{
          background: uploaded ? "rgba(52,214,194,.12)" : "rgba(160,190,215,.08)",
          borderRadius: "50%",
          width: 56, height: 56,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {uploaded
            ? <CheckCircle2 style={{ width: 26, height: 26, color: "#34D6C2" }} />
            : <FileText style={{ width: 26, height: 26, color: "#A2B6C9" }} />}
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#EAF2F9" }}>
            {uploaded
              ? "W-9 uploaded"
              : isDragging
                ? "Drop your signed W-9 here"
                : "2. Upload your signed W-9"}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#6E8499" }}>
            {uploaded
              ? filename ?? "Document on file"
              : "PDF only · max 10 MB · click or drag & drop"}
          </p>
        </div>
        {saving && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#A2B6C9", fontSize: "12px" }}>
            <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
            Uploading…
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={saving}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
          background: "linear-gradient(135deg,#18B9A6,#34D6C2)",
          border: "none", borderRadius: "10px", padding: "12px 22px",
          fontSize: "14px", fontWeight: 700, color: "#06101D",
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.5 : 1,
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        <Upload style={{ width: 15, height: 15 }} />
        {uploaded ? "Replace W-9" : "Upload W-9 PDF"}
      </button>

      <div style={{
        background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(160,190,215,.1)",
        borderRadius: "10px",
        padding: "12px 14px",
        fontSize: "12px",
        color: "#6E8499",
        lineHeight: 1.6,
      }}>
        <strong style={{ color: "#A2B6C9" }}>Privacy:</strong> Your W-9 PDF is stored in a private Supabase
        Storage bucket accessible only to Divigner administrators. Your Social Security or EIN number is
        never stored as a database column — it remains inside the PDF you upload.
      </div>
    </div>
  )
}
