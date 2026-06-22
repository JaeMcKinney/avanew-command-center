import { useState, useEffect } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, Loader2, LogOut, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import {
  DIVIGNER_LOGO_SRC,
  DIVIGNER_NOISE_SVG,
  DIVIGNER_BG,
  DIVIGNER_CARD_BG,
  DIVIGNER_BTN_BG,
} from "@/lib/brand"

// ── Password strength helper ─────────────────────────────────────────────────

function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length < 8) return { level: 0, label: "Too short", color: "#6E8499" }
  let score = 0
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { level: 1, label: "Weak", color: "#f87171" }
  if (score === 2) return { level: 2, label: "Fair", color: "#fbbf24" }
  return { level: 3, label: "Strong", color: "#34D6C2" }
}

// ── Component ────────────────────────────────────────────────────────────────

export function RaOnboarding() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const strength = passwordStrength(password)
  const mismatch = confirm.length > 0 && password !== confirm

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/login", { replace: true }); return }

      const meta = session.user.user_metadata ?? {}

      // Already completed password setup — skip gate and go to checklist
      if (meta.password_set === true) {
        navigate("/onboarding/steps", { replace: true })
        return
      }

      setFirstName(meta.first_name ?? meta.full_name?.split(" ")[0] ?? "")
      setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const meta = session.user.user_metadata ?? {}
          if (meta.password_set === true) {
            navigate("/onboarding/steps", { replace: true })
            return
          }
          setFirstName(meta.first_name ?? meta.full_name?.split(" ")[0] ?? "")
          setReady(true)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error("Passwords do not match"); return }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return }

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    })
    setSubmitting(false)

    if (error) { toast.error(error.message); return }

    toast.success("Password saved — let's get you set up!")
    navigate("/onboarding/steps", { replace: true })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate("/login", { replace: true })
  }

  // ── Shared style tokens ───────────────────────────────────────────────────

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

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (!ready) {
    return (
      <>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap" />
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: DIVIGNER_BG }}>
          <Loader2 style={{ color: "#34D6C2", width: 28, height: 28, animation: "spin 1s linear infinite" }} />
        </div>
      </>
    )
  }

  // ── Password gate ─────────────────────────────────────────────────────────

  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600&family=Manrope:wght@300;400;500;600;700&display=swap" />

      <div
        className="ra-onboarding-root"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1rem",
          fontFamily: "'Manrope', sans-serif",
          position: "relative",
          overflow: "hidden",
          background: DIVIGNER_BG,
        }}
      >
        {/* Branded orb stage — pure CSS, lives behind everything. */}
        <div className="ra-orb-stage" aria-hidden="true">
          <div className="ra-orb-halo" />
          <div className="ra-orb-ring" />
          <div className="ra-orb" />
          <div className="ra-orb-core" />
        </div>
        {/* Noise overlay */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: DIVIGNER_NOISE_SVG, opacity: 0.035, pointerEvents: "none" }} />

        {/* Sign out — top-right. Password hasn't been set yet so there's
            nothing to lose; lets the RA come back later via the same invite. */}
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            position: "absolute", top: 20, right: 24, zIndex: 2,
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
        >
          <LogOut style={{ width: 13, height: 13 }} />
          Sign out
        </button>

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "420px" }}>

          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src={DIVIGNER_LOGO_SRC} alt="Divigner" style={{ height: "80px", width: "auto" }} />
          </div>

          {/* Card */}
          <div style={{
            background: DIVIGNER_CARD_BG,
            border: "1px solid rgba(160,190,215,.14)",
            borderRadius: "20px",
            padding: "36px 40px 40px",
            boxShadow: "0 32px 80px -20px rgba(0,0,0,.7), 0 0 0 1px rgba(52,214,194,.05)",
          }}>

            {/* Shield icon + heading */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
              <div style={{ background: "rgba(52,214,194,.12)", borderRadius: "10px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck style={{ color: "#34D6C2", width: 20, height: 20 }} />
              </div>
              <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(95,227,210,.7)" }}>
                Partner Program
              </p>
            </div>

            <h1 style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: 600, color: "#EAF2F9", lineHeight: 1.3, fontFamily: "'Fraunces', serif" }}>
              {firstName ? `Welcome, ${firstName}!` : "Welcome!"}
            </h1>
            <p style={{ margin: "0 0 28px", fontSize: "14px", color: "#A2B6C9", lineHeight: 1.6 }}>
              Set a password to secure your account before we begin onboarding.
            </p>

            <div style={{ height: "1px", background: "rgba(160,190,215,.12)", marginBottom: "28px" }} />

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

              {/* Password */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#A2B6C9", marginBottom: "6px" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: "42px" }}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6E8499", padding: 0, display: "flex" }}
                  >
                    {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                      {[1, 2, 3].map((n) => (
                        <div key={n} style={{
                          flex: 1, height: "3px", borderRadius: "2px",
                          background: n <= strength.level ? strength.color : "rgba(160,190,215,.15)",
                          transition: "background .2s",
                        }} />
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: "11px", color: strength.color }}>{strength.label}</p>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#A2B6C9", marginBottom: "6px" }}>
                  Confirm password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    style={{
                      ...inputStyle,
                      paddingRight: "42px",
                      border: mismatch ? "1px solid rgba(248,113,113,.6)" : inputStyle.border,
                    }}
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6E8499", padding: 0, display: "flex" }}
                  >
                    {showConfirm ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
                {mismatch && (
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#f87171" }}>Passwords do not match</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || mismatch || password.length < 8}
                style={{
                  marginTop: "8px",
                  background: submitting || mismatch || password.length < 8 ? "rgba(52,214,194,.35)" : DIVIGNER_BTN_BG,
                  border: "none",
                  borderRadius: "10px",
                  padding: "13px",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#06101D",
                  cursor: submitting || mismatch || password.length < 8 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontFamily: "'Manrope', sans-serif",
                  transition: "opacity .15s",
                }}
              >
                {submitting
                  ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Saving…</>
                  : "Set password & continue →"}
              </button>

            </form>
          </div>

          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "12px", color: "rgba(110,132,153,.6)" }}>
            © 2026 Divigner Group · Referral Associate Program
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ra-orb-float { 0%, 100% { transform: translateY(-50%); } 50% { transform: translateY(calc(-50% - 22px)); } }
        @keyframes ra-orb-spin { to { transform: rotate(360deg); } }
        @keyframes ra-orb-pulse { 0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } 50% { transform: translate(-50%,-50%) scale(1.12); opacity: .85; } }

        .ra-orb-stage {
          position: fixed; right: -200px; top: 50%;
          transform: translateY(-50%);
          width: 720px; height: 720px;
          pointer-events: none; z-index: 0; opacity: .65;
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

        .ra-onboarding-root input:focus,
        .ra-onboarding-root textarea:focus,
        .ra-onboarding-root select:focus {
          border-color: rgba(95,227,210,.65) !important;
          box-shadow: 0 0 0 3px rgba(52,214,194,.22);
        }

        @media (max-width: 720px) {
          .ra-orb-stage { width: 480px; height: 480px; right: -200px; opacity: .45; }
        }
      `}</style>
    </>
  )
}
