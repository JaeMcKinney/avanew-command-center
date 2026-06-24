import { useState, useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getRaAssociate, getImpersonatedRaUserId } from "@/lib/data"
import {
  DIVIGNER_BG,
  DIVIGNER_CARD_BG,
  DIVIGNER_LOGO_SRC,
  DIVIGNER_NOISE_SVG,
} from "@/lib/brand"

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"

type RevokedReason = "declined" | "terminated" | "suspended"

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: DIVIGNER_BG }}>
      <Loader2 className="h-8 w-8 animate-spin text-[#34D6C2]" />
    </div>
  )
}

const REVOKED_COPY: Record<RevokedReason, { emoji: string; heading: string; body: string }> = {
  declined: {
    emoji: "❌",
    heading: "Application Declined",
    body: "Your RA application was not approved at this time. Please contact your Divigner representative for more information.",
  },
  terminated: {
    emoji: "🔒",
    heading: "Access Terminated",
    body: "Your Referral Associate access has been terminated. If you believe this is an error, please reach out.",
  },
  suspended: {
    emoji: "⏸️",
    heading: "Account Suspended",
    body: "Your Referral Associate account is currently suspended. Please contact your Divigner representative to resolve this.",
  },
}

function RevokedScreen({ reason }: { reason: RevokedReason }) {
  const copy = REVOKED_COPY[reason]
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: DIVIGNER_BG }}
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-[.04] mix-blend-overlay"
        style={{ backgroundImage: DIVIGNER_NOISE_SVG, backgroundSize: "160px 160px" }}
      />
      <img src={DIVIGNER_LOGO_SRC} alt="Divigner" className="h-7 mb-12 relative z-10" />
      <div
        className="relative z-10 rounded-2xl border border-white/10 p-10 max-w-md w-full text-center"
        style={{ background: DIVIGNER_CARD_BG }}
      >
        <div className="text-4xl mb-5">{copy.emoji}</div>
        <h1
          className="text-2xl font-semibold text-white mb-3"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          {copy.heading}
        </h1>
        <p
          className="text-white/60 text-sm leading-relaxed mb-6"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          {copy.body}
        </p>
        <a
          href="mailto:partners@divigner.com"
          className="text-[#34D6C2] text-sm hover:underline"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          partners@divigner.com
        </a>
      </div>
    </div>
  )
}

/**
 * Route-level guard for all /ra/* routes.
 * Redirects based on RA status; renders <Outlet /> only for active associates.
 */
export function RaPortalGuard() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [revokedReason, setRevokedReason] = useState<RevokedReason | null>(null)

  useEffect(() => {
    async function check() {
      if (PREVIEW_MODE) {
        const ra = await getRaAssociate().catch(() => null)
        if (!ra) { setReady(true); return }
        switch (ra.status) {
          case "declined":   setRevokedReason("declined"); break
          case "terminated": setRevokedReason("terminated"); break
          case "suspended":  setRevokedReason("suspended"); break
          default:           break
        }
        setReady(true)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate("/login", { replace: true }); return }

      // View-as-RA: admin is impersonating. Skip all status-based redirects —
      // we want them to see the dashboard for any RA regardless of lifecycle
      // state, and the password_set / login bounces don't apply to them.
      if (getImpersonatedRaUserId()) {
        setReady(true)
        return
      }

      if (!session.user.user_metadata?.password_set) {
        navigate("/onboarding", { replace: true }); return
      }

      const ra = await getRaAssociate().catch(() => null)
      if (!ra) { navigate("/login", { replace: true }); return }

      switch (ra.status) {
        case "active":
          setReady(true)
          break
        case "pending":
          navigate("/onboarding", { replace: true })
          break
        case "verification":
        case "needs_changes":
          navigate("/onboarding/steps", { replace: true })
          break
        case "declined":
          setRevokedReason("declined")
          setReady(true)
          break
        case "terminated":
          setRevokedReason("terminated")
          setReady(true)
          break
        case "suspended":
          setRevokedReason("suspended")
          setReady(true)
          break
      }
    }
    void check()
  }, [navigate])

  if (!ready) return <FullPageLoader />
  if (revokedReason) return <RevokedScreen reason={revokedReason} />
  return <Outlet />
}
