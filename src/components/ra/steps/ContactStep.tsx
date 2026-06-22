import { useState } from "react"
import type { FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { saveRaContact } from "@/lib/data"
import { ReviewerCommentsBanner } from "@/components/ra/ReviewerCommentsBanner"
import type { RaAssociate, RaSectionComment } from "@/types/db"

type Props = {
  ra: RaAssociate
  stepLabel?: string
  onComplete: (updated: Partial<RaAssociate>) => void
  reviewerComments?: RaSectionComment[]
}

// Mask a string of up to 10 digits as "(###) ###-####". Anything pre-formatted
// with the +1 country code is treated as a US number — strip and re-format.
function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").slice(0, 10)
  if (digits.length === 0) return ""
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function ContactStep({ ra, stepLabel = "Step 2 of 4", onComplete, reviewerComments = [] }: Props) {
  const [phone, setPhone] = useState(formatPhone(ra.contact_phone ?? ""))
  // Pre-fill contact email from the invite address (ra.email is the joined
  // profiles.email, set when the RA was invited). The RA may overwrite it
  // since the contact email shown on their referral page can differ from
  // their login email.
  const [email, setEmail] = useState(ra.contact_email ?? ra.email ?? "")
  const [bio, setBio] = useState(ra.bio ?? "")
  const [saving, setSaving] = useState(false)

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(160,190,215,.18)",
    borderRadius: "8px",
    color: "#EAF2F9",
    padding: "10px 14px",
    fontSize: "15px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "'Manrope', sans-serif",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#A2B6C9",
    marginBottom: "6px",
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { toast.error("Phone number is required"); return }
    if (!email.trim()) { toast.error("Contact email is required"); return }
    setSaving(true)
    try {
      await saveRaContact(ra.id, {
        contact_phone: phone.trim(),
        contact_email: email.trim(),
        bio: bio.trim(),
      })
      onComplete({
        contact_phone: phone.trim(),
        contact_email: email.trim(),
        bio: bio.trim(),
        contact_completed: true,
      })
      toast.success("Contact info saved!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(95,227,210,.7)" }}>
          {stepLabel}
        </p>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 600, color: "#EAF2F9" }}>
          Contact info
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#A2B6C9", lineHeight: 1.6 }}>
          How prospects and the Divigner team can reach you. Displayed on your referral page.
        </p>
      </div>

      <ReviewerCommentsBanner section="contact" comments={reviewerComments} />
      <ReviewerCommentsBanner section="bio" comments={reviewerComments} />

      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div>
          <label style={labelStyle}>Phone number <span style={{ color: "#f87171" }}>*</span></label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(555) 000-0000"
            style={inputStyle}
            autoComplete="tel"
            inputMode="tel"
            maxLength={14}
          />
        </div>

        <div>
          <label style={labelStyle}>Contact email <span style={{ color: "#f87171" }}>*</span></label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
            autoComplete="email"
          />
          <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#6E8499" }}>
            Can differ from your login email — this is what appears on your referral page.
          </p>
        </div>

        <div>
          <label style={labelStyle}>
            Bio <span style={{ color: "#6E8499", fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short intro about yourself that prospects will see on your referral page…"
            rows={4}
            maxLength={500}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
          <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#6E8499" }}>
            {bio.length}/500 characters
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
          background: saving ? "rgba(52,214,194,.35)" : "linear-gradient(135deg,#18B9A6,#34D6C2)",
          border: "none", borderRadius: "10px", padding: "12px 22px",
          fontSize: "14px", fontWeight: 700, color: "#06101D",
          cursor: saving ? "not-allowed" : "pointer",
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        {saving
          ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Saving…</>
          : "Save & continue →"}
      </button>
    </form>
  )
}
