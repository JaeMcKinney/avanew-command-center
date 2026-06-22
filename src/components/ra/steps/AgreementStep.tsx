import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, CheckCircle2, FileSignature, Loader2, Scroll } from "lucide-react"
import { toast } from "sonner"
import { getCommissionConfig, saveRaAgreement } from "@/lib/data"
import { getAgreementSections } from "@/lib/raAgreement"
import type { CommissionConfig, RaAssociate } from "@/types/db"

type Props = {
  ra: RaAssociate
  stepLabel?: string  // e.g. "Step 1 of 5"
  onComplete: (updated: Partial<RaAssociate>) => void
}

export function AgreementStep({ ra, stepLabel = "Step 1 of 5", onComplete }: Props) {
  const alreadyAccepted = ra.agreement_completed === true
  const [cfg, setCfg] = useState<CommissionConfig | null>(null)
  // Already-accepted RAs landing back on Step 1 should see the agreement
  // pre-validated, not be able to "uncheck" their prior signature.
  const [scrolledToEnd, setScrolledToEnd] = useState(alreadyAccepted)
  const [signedName, setSignedName] = useState(ra.agreement_signed_name ?? "")
  const [agreeBox, setAgreeBox] = useState(alreadyAccepted)
  const [submitting, setSubmitting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getCommissionConfig().then(setCfg)
  }, [])

  const sections = useMemo(() => (cfg ? getAgreementSections(cfg) : []), [cfg])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    // 24px tolerance for end-of-scroll
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) {
      setScrolledToEnd(true)
    }
  }

  function jumpToEnd() {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }

  async function handleAccept() {
    if (!cfg) return
    if (!scrolledToEnd) { toast.error("Please scroll through the full agreement first"); return }
    if (!agreeBox) { toast.error("Please confirm you have read and agree to the terms"); return }
    const trimmed = signedName.trim()
    if (trimmed.length < 3) { toast.error("Please type your full legal name"); return }

    setSubmitting(true)
    try {
      const acceptance = await saveRaAgreement(ra.id, {
        signed_name: trimmed,
        agreement_version: cfg.agreement_version,
      })
      toast.success("Agreement accepted — let's continue your onboarding")
      onComplete({
        agreement_completed: true,
        agreement_version: acceptance.agreement_version,
        agreement_accepted_at: acceptance.agreement_accepted_at,
        agreement_ip_address: acceptance.agreement_ip_address,
        agreement_user_agent: acceptance.agreement_user_agent,
        agreement_signed_name: acceptance.agreement_signed_name,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record acceptance")
    } finally {
      setSubmitting(false)
    }
  }

  // Forward to the next step without re-recording acceptance.
  function handleContinue() {
    onComplete({})
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <p style={{
          margin: "0 0 4px", fontSize: "11px", fontWeight: 600,
          letterSpacing: "0.14em", textTransform: "uppercase",
          color: "rgba(95,227,210,.7)",
        }}>
          {stepLabel}
        </p>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 600, color: "#EAF2F9", fontFamily: "'Fraunces', serif" }}>
          Referral Associate Agreement
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#A2B6C9", lineHeight: 1.6 }}>
          Read the full agreement below, then type your full legal name and accept to continue. Your acceptance is
          captured with a timestamp and serves as a legally binding electronic signature.
        </p>
      </div>

      {alreadyAccepted && (
        <div style={{
          background: "rgba(52,214,194,.07)",
          border: "1px solid rgba(52,214,194,.25)",
          borderRadius: "10px",
          padding: "12px 14px",
          fontSize: "13px",
          color: "#A2B6C9",
          lineHeight: 1.6,
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
        }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: "#34D6C2", flexShrink: 0, marginTop: 2 }} />
          <div>
            Signed by <strong style={{ color: "#EAF2F9" }}>{ra.agreement_signed_name}</strong>
            {ra.agreement_accepted_at && (
              <> on {new Date(ra.agreement_accepted_at).toLocaleString()}</>
            )}
            {ra.agreement_version && <> · version {ra.agreement_version}</>}
          </div>
        </div>
      )}

      {/* Scrollable agreement body */}
      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            background: "rgba(0,0,0,.18)",
            border: "1px solid rgba(160,190,215,.15)",
            borderRadius: "12px",
            padding: "20px 22px",
            height: "420px",
            overflowY: "auto",
            fontSize: "13px",
            color: "#C8D5E0",
            lineHeight: 1.7,
            scrollBehavior: "smooth",
          }}
        >
          {!cfg ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <Loader2 style={{ color: "#34D6C2", width: 22, height: 22, animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#5FE3D2" }}>
                  Divigner Group
                </p>
                <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 600, color: "#EAF2F9", fontFamily: "'Fraunces', serif" }}>
                  Referral Associate Agreement
                </h3>
                <p style={{ margin: 0, fontSize: "11px", color: "#6E8499" }}>
                  Divigner Referral Associate Program · {cfg.agreement_version}
                </p>
              </div>

              {sections.map((s) => (
                <div key={s.id} style={{ marginBottom: "20px" }}>
                  <h4 style={{
                    margin: "0 0 8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#EAF2F9",
                    letterSpacing: "0.02em",
                  }}>
                    {s.number !== s.title ? `${s.number} — ${s.title}` : s.title}
                  </h4>
                  {s.body.map((p, i) => (
                    <p key={i} style={{ margin: "0 0 10px", color: "#C8D5E0" }}>{p}</p>
                  ))}
                </div>
              ))}

              <div style={{
                marginTop: "24px",
                paddingTop: "16px",
                borderTop: "1px solid rgba(160,190,215,.15)",
                fontSize: "12px",
                color: "#6E8499",
              }}>
                By signing below, both parties agree to be bound by the terms and conditions of this Referral
                Associate Agreement. On behalf of Divigner Group: <strong style={{ color: "#A2B6C9" }}>Jae McKinney, Founder &amp; Chief AI Strategist</strong>.
              </div>
            </>
          )}
        </div>

        {!scrolledToEnd && cfg && (
          <button
            type="button"
            onClick={jumpToEnd}
            style={{
              position: "absolute",
              right: 18,
              bottom: 14,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(52,214,194,.9)",
              color: "#06101D",
              border: "none",
              borderRadius: "999px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,.4)",
            }}
          >
            <ArrowDown style={{ width: 12, height: 12 }} />
            Scroll to end
          </button>
        )}
      </div>

      {/* Scroll-state indicator */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        color: scrolledToEnd ? "#34D6C2" : "#6E8499",
      }}>
        {scrolledToEnd
          ? <><CheckCircle2 style={{ width: 14, height: 14 }} /> You've reviewed the full agreement.</>
          : <><Scroll style={{ width: 14, height: 14 }} /> Scroll to the end of the agreement to continue.</>}
      </div>

      {/* Signature block */}
      <div style={{
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(160,190,215,.15)",
        borderRadius: "12px",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FileSignature style={{ width: 16, height: 16, color: "#34D6C2" }} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#EAF2F9" }}>Electronic signature</span>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "#A2B6C9" }}>Full legal name</span>
          <input
            type="text"
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            placeholder="Type your full legal name"
            disabled={submitting || alreadyAccepted}
            style={{
              background: "rgba(0,0,0,.22)",
              border: "1px solid rgba(160,190,215,.18)",
              borderRadius: "8px",
              color: "#EAF2F9",
              padding: "10px 14px",
              fontSize: "14px",
              outline: "none",
              fontFamily: "'Manrope', sans-serif",
              opacity: alreadyAccepted ? 0.7 : 1,
              cursor: alreadyAccepted ? "not-allowed" : "text",
            }}
          />
        </label>

        <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer", fontSize: "12px", color: "#A2B6C9", lineHeight: 1.6 }}>
          <input
            type="checkbox"
            checked={agreeBox}
            onChange={(e) => setAgreeBox(e.target.checked)}
            // Once accepted, the signature is locked — the RA cannot un-sign by
            // toggling the box on a return visit. Verification/audit log lives
            // on the row (agreement_accepted_at / agreement_ip_address).
            disabled={submitting || alreadyAccepted}
            style={{
              marginTop: 3,
              accentColor: "#34D6C2",
              cursor: alreadyAccepted ? "not-allowed" : "pointer",
            }}
          />
          <span>
            I have read, understood, and agree to the Divigner Referral Associate Agreement. I understand that
            my acceptance is legally binding, and that Divigner will record the date, time, and my user agent
            as evidence of my electronic signature.
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={alreadyAccepted ? handleContinue : handleAccept}
        disabled={!alreadyAccepted && (!cfg || !scrolledToEnd || !agreeBox || signedName.trim().length < 3 || submitting)}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          background:
            !alreadyAccepted && (!cfg || !scrolledToEnd || !agreeBox || signedName.trim().length < 3 || submitting)
              ? "rgba(52,214,194,.35)"
              : "linear-gradient(135deg,#18B9A6,#34D6C2)",
          border: "none",
          borderRadius: "10px",
          padding: "12px 22px",
          fontSize: "14px",
          fontWeight: 700,
          color: "#06101D",
          cursor:
            !alreadyAccepted && (!cfg || !scrolledToEnd || !agreeBox || signedName.trim().length < 3 || submitting)
              ? "not-allowed"
              : "pointer",
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        {submitting
          ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Recording acceptance…</>
          : alreadyAccepted
            ? <><CheckCircle2 style={{ width: 15, height: 15 }} /> Continue →</>
            : <><CheckCircle2 style={{ width: 15, height: 15 }} /> Accept &amp; continue</>}
      </button>
    </div>
  )
}
