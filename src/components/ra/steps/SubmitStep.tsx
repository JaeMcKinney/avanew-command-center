import { useState } from "react"
import { CheckCircle2, XCircle, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { submitRaApplication } from "@/lib/data"
import type { RaAssociate } from "@/types/db"

type Props = {
  ra: RaAssociate
  onSubmitted: () => void
}

export function SubmitStep({ ra, onSubmitted }: Props) {
  const [submitting, setSubmitting] = useState(false)

  const allComplete = ra.photo_completed && ra.contact_completed && ra.banking_completed

  const sections = [
    {
      label: "Profile photo",
      done: ra.photo_completed,
      detail: ra.photo_url ? "Photo uploaded" : "No photo yet",
    },
    {
      label: "Contact info",
      done: ra.contact_completed,
      detail: ra.contact_completed
        ? [ra.contact_phone, ra.contact_email].filter(Boolean).join(" · ")
        : "Not completed",
    },
    {
      label: "Banking details",
      done: ra.banking_completed,
      detail: ra.banking_completed
        ? `${ra.ach_bank_name ?? "Bank"} ···${(ra.ach_account ?? "").slice(-4)}`
        : "Not completed",
    },
  ]

  async function handleSubmit() {
    if (!allComplete) return
    setSubmitting(true)
    try {
      await submitRaApplication(ra.id)
      toast.success("Application submitted! We'll review and be in touch shortly.")
      onSubmitted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(95,227,210,.7)" }}>
          Step 4 of 4
        </p>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 600, color: "#EAF2F9" }}>
          Review & submit
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#A2B6C9", lineHeight: 1.6 }}>
          Once you submit, the Divigner team will review your application and activate your account.
        </p>
      </div>

      {/* Section checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {sections.map((s) => (
          <div key={s.label} style={{
            display: "flex", alignItems: "center", gap: "14px",
            background: "rgba(255,255,255,.04)", border: "1px solid rgba(160,190,215,.12)",
            borderRadius: "10px", padding: "14px 16px",
          }}>
            {s.done
              ? <CheckCircle2 style={{ width: 18, height: 18, color: "#34D6C2", flexShrink: 0 }} />
              : <XCircle style={{ width: 18, height: 18, color: "#f87171", flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 500, color: s.done ? "#EAF2F9" : "#A2B6C9" }}>
                {s.label}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#6E8499" }}>{s.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Incomplete warning */}
      {!allComplete && (
        <div style={{
          background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.25)",
          borderRadius: "10px", padding: "14px 16px",
          fontSize: "13px", color: "#fca5a5", lineHeight: 1.6,
        }}>
          Please complete all sections above before submitting.
        </div>
      )}

      {/* What happens next */}
      {allComplete && (
        <div style={{
          background: "rgba(52,214,194,.06)", border: "1px solid rgba(52,214,194,.18)",
          borderRadius: "10px", padding: "14px 16px",
          fontSize: "13px", color: "#A2B6C9", lineHeight: 1.7,
        }}>
          <strong style={{ color: "#EAF2F9" }}>What happens next:</strong> The Divigner team will review your profile and banking details. You'll receive an email once your account is activated — usually within 1–2 business days.
        </div>
      )}

      <button
        type="button"
        disabled={!allComplete || submitting}
        onClick={handleSubmit}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          background: !allComplete || submitting ? "rgba(52,214,194,.35)" : "linear-gradient(135deg,#18B9A6,#34D6C2)",
          border: "none", borderRadius: "10px", padding: "13px",
          fontSize: "15px", fontWeight: 700, color: "#06101D",
          cursor: !allComplete || submitting ? "not-allowed" : "pointer",
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        {submitting
          ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Submitting…</>
          : <><Send style={{ width: 15, height: 15 }} /> Submit application</>}
      </button>
    </div>
  )
}
