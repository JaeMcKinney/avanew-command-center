import { useState, useEffect } from "react"
import type { CSSProperties, FormEvent, ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getRaPortalRedirect } from "@/lib/data"
import { SITE } from "@/lib/siteBrand"
import { SKIN, noiseSvg } from "@/pages/auth/Login"

// Invite links land here. Same branded shell as the Login page.

function readLinkError(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
  const desc = params.get("error_description")
  return desc ? desc.replace(/\+/g, " ") : null
}

const labelStyle: CSSProperties = {
  fontSize: "0.8125rem", fontWeight: 500, color: SKIN.muted, letterSpacing: "0.02em",
}

const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: SKIN.inputBg, border: `1px solid ${SKIN.inputBorder}`, borderRadius: "8px",
  padding: "0.625rem 0.875rem", color: SKIN.text, fontSize: "0.9375rem",
  outline: "none", transition: "border-color .2s", fontFamily: SKIN.bodyFont,
}

const focusOn = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = SKIN.inputFocus)
const focusOff = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = SKIN.inputBorder)

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      {SKIN.fontsHref && <link rel="stylesheet" href={SKIN.fontsHref} />}
      <div
        style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "2rem 1rem",
          fontFamily: SKIN.bodyFont, position: "relative", overflow: "hidden", background: SKIN.bg,
        }}
      >
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, backgroundImage: noiseSvg, opacity: 0.05, mixBlendMode: "overlay", pointerEvents: "none" }}
        />
        <div style={{ marginBottom: "2.5rem", position: "relative", zIndex: 1 }}>
          <img src={SKIN.logo} alt={SKIN.logoAlt} style={{ height: SKIN.logoHeight, width: "auto" }} />
        </div>
        <div
          style={{
            position: "relative", zIndex: 1, width: "100%", maxWidth: "400px",
            background: SKIN.card, border: SKIN.cardBorder, borderRadius: "18px",
            padding: "2.5rem 2rem", boxShadow: SKIN.cardShadow,
          }}
        >
          {children}
        </div>
        <p style={{ position: "relative", zIndex: 1, marginTop: "2rem", fontSize: "0.75rem", color: SKIN.muted, opacity: 0.45 }}>
          © {new Date().getFullYear()} {SKIN.footer}
        </p>
      </div>
    </>
  )
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h1 style={{ fontFamily: SKIN.headingFont, fontWeight: 500, fontSize: "1.75rem", color: SKIN.heading, margin: 0, lineHeight: 1.2 }}>
        {title}
      </h1>
      <p style={{ fontSize: "0.875rem", color: SKIN.muted, margin: "0.5rem 0 0", lineHeight: 1.5 }}>{subtitle}</p>
    </div>
  )
}

export function SetupAccount() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(() => readLinkError())
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Token may already be exchanged if the page loaded with a hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setFullName(session.user.user_metadata?.full_name ?? "")
        setReady(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          setFullName(session.user.user_metadata?.full_name ?? "")
          setReady(true)
        }
      }
    )
    // No session after a while means the link was already used or expired.
    const timer = window.setTimeout(() => {
      setLinkError((cur) => cur ?? "This invite link has expired or was already used.")
    }, 8000)
    return () => { subscription.unsubscribe(); window.clearTimeout(timer) }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error("Passwords do not match")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({
      password,
      data: fullName.trim() ? { full_name: fullName.trim() } : undefined,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Welcome to ${SITE.appName}!`)
    const raPath = await getRaPortalRedirect().catch(() => null)
    navigate(raPath ?? "/dashboard", { replace: true })
  }

  if (!ready) {
    return (
      <Shell>
        {linkError ? (
          <>
            <Heading title="Link Expired" subtitle={`${linkError} Ask your administrator for a new invite, or sign in if you already set a password.`} />
            <Link
              to="/login"
              style={{ display: "block", textAlign: "center", padding: "0.75rem 1rem", background: SKIN.button, borderRadius: "8px", color: SKIN.buttonText, fontWeight: 700, fontSize: "0.9375rem", textDecoration: "none" }}
            >
              Go to Sign In
            </Link>
          </>
        ) : (
          <p style={{ textAlign: "center", fontSize: "0.875rem", color: SKIN.muted, margin: 0 }}>Verifying your invite…</p>
        )}
      </Shell>
    )
  }

  return (
    <Shell>
      <Heading
        title={`Welcome to ${SITE.appName}`}
        subtitle="Confirm your name and choose a password to set up your account."
      />
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label htmlFor="full-name" style={labelStyle}>Full Name</label>
          <input
            id="full-name" type="text" autoComplete="name" placeholder="Your name"
            value={fullName} onChange={(e) => setFullName(e.target.value)}
            style={inputStyle} onFocus={focusOn} onBlur={focusOff}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label htmlFor="password" style={labelStyle}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              id="password" type={showPassword ? "text" : "password"} autoComplete="new-password"
              placeholder="At least 8 characters" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, paddingRight: "2.5rem" }} onFocus={focusOn} onBlur={focusOff}
            />
            <button
              type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{ position: "absolute", right: "0.625rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: SKIN.link, padding: 0, display: "flex", alignItems: "center" }}
            >
              {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label htmlFor="confirm" style={labelStyle}>Confirm Password</label>
          <input
            id="confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" required
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            style={inputStyle} onFocus={focusOn} onBlur={focusOff}
          />
        </div>
        <button
          type="submit" disabled={submitting}
          style={{
            marginTop: "0.25rem", width: "100%", padding: "0.75rem 1rem",
            background: submitting ? SKIN.buttonBusy : SKIN.button, border: "none", borderRadius: "8px",
            color: SKIN.buttonText, fontFamily: SKIN.bodyFont, fontWeight: 700, fontSize: "0.9375rem",
            cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Setting Up…" : "Create My Account"}
        </button>
      </form>
    </Shell>
  )
}
