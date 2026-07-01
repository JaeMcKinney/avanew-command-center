import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, AlertTriangle, CheckCircle2, Circle, LogOut } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getRaAssociate, listRaSectionComments, PREVIEW_DATA_MODE } from "@/lib/data"
import { AgreementStep } from "@/components/ra/steps/AgreementStep"
import { PhotoStep } from "@/components/ra/steps/PhotoStep"
import { ContactStep } from "@/components/ra/steps/ContactStep"
import { BankingStep } from "@/components/ra/steps/BankingStep"
import { W9Step } from "@/components/ra/steps/W9Step"
import { SubmitStep } from "@/components/ra/steps/SubmitStep"
import { getLocalAgreementAcceptance, getLocalW9 } from "@/lib/data"
import {
  DIVIGNER_LOGO_SRC,
  DIVIGNER_NOISE_SVG,
  DIVIGNER_BG,
  DIVIGNER_CARD_BG,
} from "@/lib/brand"
import type { RaAssociate, RaSectionComment } from "@/types/db"

type Step = number   // index into STEPS — agreement | photo | contact | banking | w9 | submit

const STEPS = [
  { label: "Agreement", field: "agreement_completed" as const },
  { label: "Photo",     field: "photo_completed"     as const },
  { label: "Contact",   field: "contact_completed"   as const },
  { label: "Banking",   field: "banking_completed"   as const },
  { label: "W-9",       field: "w9_completed"        as const },
  { label: "Review",    field: null },
]

// All sections except the trailing Review step (which has no completion field).
const TOTAL_PROGRESS_SECTIONS = STEPS.filter((s) => s.field !== null).length

export function RaOnboardingSteps() {
  const navigate = useNavigate()
  const [ra, setRa] = useState<RaAssociate | null>(null)
  const [comments, setComments] = useState<RaSectionComment[]>([])
  const [step, setStep] = useState<Step>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      if (!PREVIEW_DATA_MODE) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { navigate("/login", { replace: true }); return }

        // Must have completed the password gate first
        if (!session.user.user_metadata?.password_set) {
          navigate("/onboarding", { replace: true }); return
        }
      }

      const record = await getRaAssociate().catch(() => null)
      if (!record) {
        toast.error("No RA record found. Please contact Divigner support.")
        navigate("/login", { replace: true }); return
      }

      // Invite link expired (72h, never clicked) or onboarding deadline
      // passed (21d, never submitted) — block before the auto-advance logic
      // below ever runs.
      if (record.status === "invite_expired" || record.status === "onboarding_expired") {
        setRa(record); setLoading(false); return
      }

      // Already submitted — show pending state instead of re-showing checklist
      if (record.status === "verification") {
        setRa(record); setLoading(false); return
      }

      // Redirect active RAs to their dashboard (Day 4)
      if (record.status === "active") {
        navigate("/ra/dashboard", { replace: true }); return
      }

      // Merge localStorage agreement + W-9 acceptance (until PR-3 wires real columns).
      const localAgreement = getLocalAgreementAcceptance(record.id)
      const localW9 = getLocalW9(record.id)
      const hydrated: RaAssociate = {
        ...record,
        ...(localAgreement ?? {}),
        ...(localW9 ?? {}),
      }

      setRa(hydrated)

      // Pull any reviewer comments so each step can surface its own.
      const reviewerComments = await listRaSectionComments(record.id).catch(() => [])
      setComments(reviewerComments)

      // If admin requested changes, jump straight to the first section with an
      // open (unresolved) comment so the RA sees what to fix instead of landing
      // on Submit (which they would otherwise hit, since all sections are
      // already marked complete from their original submission).
      if (record.status === "needs_changes") {
        const sectionToStep: Record<string, Step> = {
          agreement: 0, photo: 1, bio: 2, contact: 2, banking: 3, w9: 4,
        }
        const firstOpen = reviewerComments.find((c) => !c.resolved_at)
        if (firstOpen && sectionToStep[firstOpen.section] !== undefined) {
          setStep(sectionToStep[firstOpen.section])
        } else {
          setStep(STEPS.length - 1) // no per-section comments → review summary screen
        }
      }
      // Auto-advance to first incomplete section
      else if (!hydrated.agreement_completed) { setStep(0); }
      else if (!hydrated.photo_completed) { setStep(1); }
      else if (!hydrated.contact_completed) { setStep(2); }
      else if (!hydrated.banking_completed) { setStep(3); }
      else if (!hydrated.w9_completed) { setStep(4); }
      else { setStep(STEPS.length - 1); }

      setLoading(false)
    }
    void init()
  }, [navigate])

  function handleStepComplete(updated: Partial<RaAssociate>) {
    setRa((prev) => prev ? { ...prev, ...updated } : prev)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleSubmitted() {
    setRa((prev) => prev ? { ...prev, status: "verification" } : prev)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleSignOut() {
    // Each step persists to the DB on its Next click, so progress is already
    // safe. Signing back in resumes at the first incomplete section.
    await supabase.auth.signOut()
    navigate("/login", { replace: true })
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" />
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: DIVIGNER_BG }}>
          <Loader2 style={{ color: "#34D6C2", width: 28, height: 28, animation: "spin 1s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    )
  }

  // ── Submitted / pending review state ────────────────────────────────────────
  if (ra?.status === "verification") {
    const submittedName = ra.display_name || ra.full_name || ""
    return (
      <>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600&family=Manrope:wght@400;500;600;700&display=swap" />
        <div className="ra-onboarding-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", background: DIVIGNER_BG, fontFamily: "'Manrope', sans-serif", position: "relative", overflow: "hidden" }}>
            <OnboardingOrbs />
            <div style={{ position: "absolute", inset: 0, backgroundImage: DIVIGNER_NOISE_SVG, opacity: 0.035, pointerEvents: "none" }} />
            {/* RA identity chip — pairs the name (and uploaded avatar when present) next to the sign-out button. */}
            <div style={{ position: "absolute", top: 20, right: 24, zIndex: 3, display: "flex", alignItems: "center", gap: 12 }}>
              {submittedName && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#A2B6C9", fontSize: 13, fontWeight: 500 }}>
                  {ra.photo_url
                    ? <img src={ra.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(95,227,210,.35)" }} />
                    : <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(52,214,194,.12)", color: "#34D6C2", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{initialsOf(submittedName)}</div>}
                  <span>{submittedName}</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(160,190,215,.18)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "#A2B6C9",
                  fontSize: 12, fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                <LogOut style={{ width: 13, height: 13 }} />
                Sign out
              </button>
            </div>
            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "440px", textAlign: "center", paddingTop: "60px" }}>
              {/* Logo sits fully above the card top edge. */}
              <div style={{ position: "relative" }}>
                <img
                  src={DIVIGNER_LOGO_SRC}
                  alt="Divigner"
                  style={{
                    height: "48px",
                    position: "absolute",
                    top: -56,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 2,
                    filter: "drop-shadow(0 8px 20px rgba(0,0,0,.45))",
                  }}
                />
                <div className="ra-status-card" style={{ background: DIVIGNER_CARD_BG, border: "1px solid rgba(160,190,215,.14)", borderRadius: "20px", padding: "32px 40px 40px", boxShadow: "0 32px 80px -20px rgba(0,0,0,.7)" }}>
                  <div style={{ background: "rgba(52,214,194,.1)", borderRadius: "50%", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <CheckCircle2 style={{ width: 32, height: 32, color: "#34D6C2" }} />
                  </div>
                  <h1 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: 600, color: "#EAF2F9", fontFamily: "'Fraunces', serif" }}>
                    Application submitted!
                  </h1>
                  <p style={{ margin: 0, fontSize: "14px", color: "#A2B6C9", lineHeight: 1.7 }}>
                    The Divigner team is reviewing your profile. You'll receive an email once your account is activated — typically within 1–2 business days.
                  </p>
                </div>
              </div>
            </div>
        </div>
        <OnboardingPageStyles />
      </>
    )
  }

  // ── Invite/onboarding window expired ────────────────────────────────────────
  if (ra?.status === "invite_expired" || ra?.status === "onboarding_expired") {
    const isInviteExpired = ra.status === "invite_expired"
    const expiredName = ra.display_name || ra.full_name || ""
    return (
      <>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600&family=Manrope:wght@400;500;600;700&display=swap" />
        <div className="ra-onboarding-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", background: DIVIGNER_BG, fontFamily: "'Manrope', sans-serif", position: "relative", overflow: "hidden" }}>
            <OnboardingOrbs />
            <div style={{ position: "absolute", inset: 0, backgroundImage: DIVIGNER_NOISE_SVG, opacity: 0.035, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 20, right: 24, zIndex: 3, display: "flex", alignItems: "center", gap: 12 }}>
              {expiredName && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#A2B6C9", fontSize: 13, fontWeight: 500 }}>
                  {ra.photo_url
                    ? <img src={ra.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(95,227,210,.35)" }} />
                    : <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(52,214,194,.12)", color: "#34D6C2", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{initialsOf(expiredName)}</div>}
                  <span>{expiredName}</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(160,190,215,.18)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "#A2B6C9",
                  fontSize: 12, fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                <LogOut style={{ width: 13, height: 13 }} />
                Sign out
              </button>
            </div>
            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "440px", textAlign: "center", paddingTop: "60px" }}>
              <div style={{ position: "relative" }}>
                <img
                  src={DIVIGNER_LOGO_SRC}
                  alt="Divigner"
                  style={{
                    height: "48px",
                    position: "absolute",
                    top: -56,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 2,
                    filter: "drop-shadow(0 8px 20px rgba(0,0,0,.45))",
                  }}
                />
                <div className="ra-status-card" style={{ background: DIVIGNER_CARD_BG, border: "1px solid rgba(160,190,215,.14)", borderRadius: "20px", padding: "32px 40px 40px", boxShadow: "0 32px 80px -20px rgba(0,0,0,.7)" }}>
                  <div style={{ background: "rgba(251,191,36,.1)", borderRadius: "50%", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <AlertTriangle style={{ width: 32, height: 32, color: "#fbbf24" }} />
                  </div>
                  <h1 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: 600, color: "#EAF2F9", fontFamily: "'Fraunces', serif" }}>
                    {isInviteExpired ? "Invite link expired" : "Onboarding window closed"}
                  </h1>
                  <p style={{ margin: 0, fontSize: "14px", color: "#A2B6C9", lineHeight: 1.7 }}>
                    {isInviteExpired
                      ? "Your invite link expired after 72 hours without being used. Please contact your Divigner representative to request a new invite."
                      : "Your application was automatically closed because onboarding wasn't completed within 14 days of your invite. Please contact your Divigner representative to reapply."}
                  </p>
                </div>
              </div>
            </div>
        </div>
        <OnboardingPageStyles />
      </>
    )
  }

  if (!ra) return null

  const isNeedsChanges = ra.status === "needs_changes"
  const raName = ra.display_name || ra.full_name || ""

  // ── Main wizard ─────────────────────────────────────────────────────────────
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600&family=Manrope:wght@300;400;500;600;700&display=swap" />

      <div className="ra-onboarding-root" style={{
        minHeight: "100vh",
        background: DIVIGNER_BG,
        fontFamily: "'Manrope', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}>
        <OnboardingOrbs />
        <div style={{ position: "fixed", inset: 0, backgroundImage: DIVIGNER_NOISE_SVG, opacity: 0.035, pointerEvents: "none", zIndex: 0 }} />

        {/* .ra-wizard-shell carries a desktop-only zoom (see OnboardingPageStyles)
            so the wizard reads comfortably on large displays without bumping
            browser zoom, while phones/tablets keep natural 1:1 scale. */}
        <div className="ra-wizard-shell" style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "32px 20px 60px" }}>

          {/* Header */}
          <div className="ra-wizard-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px", gap: 12 }}>
            <img src={DIVIGNER_LOGO_SRC} alt="Divigner" style={{ height: "44px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {raName && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {ra.photo_url
                    ? <img src={ra.photo_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(95,227,210,.4)" }} />
                    : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(52,214,194,.12)", color: "#34D6C2", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{initialsOf(raName)}</div>}
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#EAF2F9" }}>{raName}</span>
                    <span className="ra-wizard-sub" style={{ fontSize: 11, color: "#6E8499" }}>Referral Associate · Onboarding</span>
                  </div>
                </div>
              )}
              {/* Sign out — progress is auto-saved on each step's Next click,
                  so the RA can pause and resume later from the login screen. */}
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(160,190,215,.18)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "#A2B6C9",
                  fontSize: 12, fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "'Manrope', sans-serif",
                }}
                title="Your progress is auto-saved. Sign back in to resume."
              >
                <LogOut style={{ width: 13, height: 13 }} />
                Sign out
              </button>
            </div>
          </div>

          {/* needs_changes banner */}
          {isNeedsChanges && ra.verification_notes && (
            <div style={{
              display: "flex", gap: "12px", alignItems: "flex-start",
              background: "rgba(251,191,36,.07)", border: "1px solid rgba(251,191,36,.3)",
              borderRadius: "12px", padding: "16px 18px", marginBottom: "28px",
            }}>
              <AlertTriangle style={{ width: 18, height: 18, color: "#fbbf24", flexShrink: 0, marginTop: "1px" }} />
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "#fbbf24" }}>
                  Changes requested
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#A2B6C9", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {ra.verification_notes}
                </p>
              </div>
            </div>
          )}

          {/* Two-column layout: sidebar + content. Collapses to a stacked
              layout (step chips strip on top) below 900px — see
              OnboardingPageStyles. */}
          <div className="ra-wizard-grid" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "24px", alignItems: "start" }}>

            {/* Sidebar progress */}
            <div className="ra-wizard-side" style={{
              background: DIVIGNER_CARD_BG,
              border: "1px solid rgba(160,190,215,.14)",
              borderRadius: "16px",
              padding: "20px 16px",
              position: "sticky",
              top: "24px",
            }}>
              <p className="ra-wizard-side-label" style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6E8499" }}>
                Progress
              </p>
              <div className="ra-wizard-steps" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {STEPS.map((s, i) => {
                  const done = s.field ? Boolean(ra[s.field]) : false
                  const active = i === step
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setStep(i as Step)}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        background: active ? "rgba(52,214,194,.1)" : "transparent",
                        border: active ? "1px solid rgba(52,214,194,.25)" : "1px solid transparent",
                        borderRadius: "8px",
                        padding: "9px 10px",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                        transition: "background .15s",
                      }}
                    >
                      {done
                        ? <CheckCircle2 style={{ width: 15, height: 15, color: "#34D6C2", flexShrink: 0 }} />
                        : <Circle style={{ width: 15, height: 15, color: active ? "#34D6C2" : "#6E8499", flexShrink: 0 }} />}
                      <span style={{ fontSize: "13px", fontWeight: active ? 600 : 400, color: active ? "#EAF2F9" : done ? "#A2B6C9" : "#6E8499" }}>
                        {s.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Overall progress bar */}
              <div className="ra-wizard-progressbar" style={{ marginTop: "20px" }}>
                <div style={{ height: "4px", background: "rgba(160,190,215,.15)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${([ra.agreement_completed, ra.photo_completed, ra.contact_completed, ra.banking_completed, ra.w9_completed].filter(Boolean).length / TOTAL_PROGRESS_SECTIONS) * 100}%`,
                    background: "linear-gradient(90deg,#18B9A6,#34D6C2)",
                    borderRadius: "2px",
                    transition: "width .4s ease",
                  }} />
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#6E8499" }}>
                  {[ra.agreement_completed, ra.photo_completed, ra.contact_completed, ra.banking_completed, ra.w9_completed].filter(Boolean).length}/{TOTAL_PROGRESS_SECTIONS} sections done
                </p>
              </div>
            </div>

            {/* Step content card */}
            <div className="ra-wizard-card" style={{
              background: DIVIGNER_CARD_BG,
              border: "1px solid rgba(160,190,215,.14)",
              borderRadius: "16px",
              padding: "36px 40px",
              boxShadow: "0 32px 80px -20px rgba(0,0,0,.5)",
            }}>
              {step === 0 && <AgreementStep ra={ra} stepLabel={`Step 1 of ${STEPS.length}`} onComplete={handleStepComplete} reviewerComments={comments} />}
              {step === 1 && <PhotoStep     ra={ra} stepLabel={`Step 2 of ${STEPS.length}`} onComplete={handleStepComplete} reviewerComments={comments} />}
              {step === 2 && <ContactStep   ra={ra} stepLabel={`Step 3 of ${STEPS.length}`} onComplete={handleStepComplete} reviewerComments={comments} />}
              {step === 3 && <BankingStep   ra={ra} stepLabel={`Step 4 of ${STEPS.length}`} onComplete={handleStepComplete} reviewerComments={comments} />}
              {step === 4 && <W9Step        ra={ra} stepLabel={`Step 5 of ${STEPS.length}`} onComplete={handleStepComplete} reviewerComments={comments} />}
              {step === 5 && <SubmitStep    ra={ra} stepLabel={`Step 6 of ${STEPS.length}`} onSubmitted={handleSubmitted}   reviewerComments={comments} />}
            </div>

          </div>
        </div>
      </div>

      <OnboardingPageStyles />
    </>
  )
}

// ── Shared visual pieces ────────────────────────────────────────────────────

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

// Pure-CSS orb stage borrowed from the demo template — lives fixed behind all
// scrolling content so the onboarding pages share the brand's hero look.
function OnboardingOrbs() {
  return (
    <div className="ra-orb-stage" aria-hidden="true">
      <div className="ra-orb-halo" />
      <div className="ra-orb-ring" />
      <div className="ra-orb" />
      <div className="ra-orb-core" />
    </div>
  )
}

function OnboardingPageStyles() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes ra-orb-float { 0%, 100% { transform: translateY(-50%); } 50% { transform: translateY(calc(-50% - 22px)); } }
      @keyframes ra-orb-spin { to { transform: rotate(360deg); } }
      @keyframes ra-orb-pulse { 0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } 50% { transform: translate(-50%,-50%) scale(1.12); opacity: .85; } }

      .ra-orb-stage {
        position: fixed;
        right: -200px;
        top: 50%;
        transform: translateY(-50%);
        width: 720px;
        height: 720px;
        pointer-events: none;
        z-index: 0;
        opacity: .65;
      }
      .ra-orb { position: absolute; inset: 0; border-radius: 50%; filter: blur(2px); animation: ra-orb-float 9s ease-in-out infinite;
        background:
          radial-gradient(circle at 36% 30%, rgba(150,255,240,.85), rgba(52,214,194,.45) 26%, rgba(20,120,150,.22) 48%, transparent 64%),
          radial-gradient(circle at 60% 70%, rgba(40,160,200,.4), transparent 55%); }
      .ra-orb-ring { position: absolute; inset: 60px; border-radius: 50%; filter: blur(26px); opacity: .7; animation: ra-orb-spin 22s linear infinite;
        background: conic-gradient(from 0deg, transparent, rgba(95,227,210,.5), transparent 38%, rgba(201,168,106,.4), transparent 70%); }
      .ra-orb-core { position: absolute; left: 50%; top: 50%; width: 90px; height: 90px; transform: translate(-50%,-50%); border-radius: 50%;
        background: radial-gradient(circle at 38% 32%, #fff, #5FE3D2 45%, #18B9A6 80%);
        box-shadow: 0 0 80px 20px rgba(52,214,194,.5), 0 0 160px 40px rgba(52,214,194,.25);
        animation: ra-orb-pulse 5s ease-in-out infinite; }
      .ra-orb-halo { position: absolute; inset: -40px; border-radius: 50%; border: 1px solid rgba(95,227,210,.12); box-shadow: inset 0 0 120px rgba(52,214,194,.2); }

      /* Focus highlight — applies to every input/textarea/select inside an
         onboarding page. Inline styles set outline:none, so we override the
         border + add a teal ring on focus to keep the active field obvious. */
      .ra-onboarding-root input:focus,
      .ra-onboarding-root textarea:focus,
      .ra-onboarding-root select:focus {
        border-color: rgba(95,227,210,.65) !important;
        box-shadow: 0 0 0 3px rgba(52,214,194,.22);
      }

      /* Desktop-only readability zoom (was inline zoom:1.2). Phones/tablets
         keep 1:1 scale — a zoomed 375px viewport is effectively ~312px and
         everything overflows. */
      .ra-wizard-shell { zoom: 1.2; }
      @media (max-width: 1199px) {
        .ra-wizard-shell { zoom: 1; }
      }

      /* ── Mobile / narrow layout (covers phone portrait AND landscape) ──
         Inline styles below win specificity, hence the !importants. */
      @media (max-width: 900px) {
        .ra-wizard-shell { padding: 16px 12px 48px !important; }
        .ra-wizard-header { margin-bottom: 18px !important; }
        .ra-wizard-header > img { height: 34px !important; }

        /* Sidebar collapses into a horizontal step-chip strip above the card.
           minmax(0,1fr) + min-width:0 stop wide children (agreement doc, chip
           strip) from inflating the track past the viewport — a bare 1fr
           track's implicit min-width:auto would otherwise grow to fit them. */
        .ra-wizard-grid { grid-template-columns: minmax(0, 1fr) !important; gap: 14px !important; }
        .ra-wizard-grid > * { min-width: 0; }
        .ra-wizard-side { position: static !important; padding: 12px 12px 10px !important; }
        .ra-wizard-side-label { margin: 0 0 10px !important; }
        .ra-wizard-steps {
          flex-direction: row !important;
          gap: 6px !important;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding-bottom: 2px;
        }
        .ra-wizard-steps::-webkit-scrollbar { display: none; }
        .ra-wizard-steps button {
          width: auto !important;
          flex: 0 0 auto;
          padding: 7px 10px !important;
          white-space: nowrap;
        }
        .ra-wizard-progressbar { margin-top: 12px !important; }

        .ra-wizard-card { padding: 22px 16px !important; }
        .ra-status-card { padding: 28px 20px 32px !important; }

        /* 16px floor stops iOS Safari from auto-zooming the page when an
           input gains focus. */
        .ra-onboarding-root input,
        .ra-onboarding-root textarea,
        .ra-onboarding-root select {
          font-size: 16px !important;
        }
      }

      @media (max-width: 480px) {
        .ra-wizard-sub { display: none; }
      }

      @media (max-width: 720px) {
        .ra-orb-stage { width: 480px; height: 480px; right: -200px; opacity: .45; }
      }
    `}</style>
  )
}
