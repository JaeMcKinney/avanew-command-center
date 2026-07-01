import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { RevokedScreen } from "@/components/RaPortalGuard"
import {
  DIVIGNER_BG,
  DIVIGNER_CARD_BG,
  DIVIGNER_LOGO_SRC,
  DIVIGNER_NOISE_SVG,
} from "@/lib/brand"

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"

type State =
  | { kind: "working" }
  | { kind: "expired" }        // 72h invite window passed
  | { kind: "closed" }         // 21d onboarding deadline passed
  | { kind: "invalid" }        // bad / forged / superseded token
  | { kind: "preview" }

/**
 * Landing page for the emailed invite link (/invite/accept?token=…).
 *
 * The token is our own HMAC-signed 72h value (not a Supabase link). This page
 * hands it to the accept-invite function, which — if valid — mints a fresh
 * short-lived Supabase magic link on the spot and returns it, so we redirect
 * the browser straight into the authenticated onboarding flow. Expired,
 * closed, already-accepted, and invalid tokens each get their own outcome.
 */
export function InviteAccept() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ kind: "working" })
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    if (PREVIEW_MODE) { setState({ kind: "preview" }); return }

    const token = params.get("token")
    if (!token) { setState({ kind: "invalid" }); return }

    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<
          | { ok: true; action_link: string }
          | { ok: false; reason: "expired" | "closed" | "already" | "invalid" }
        >("accept-invite", { body: { token } })
        if (error || !data) { setState({ kind: "invalid" }); return }

        if (data.ok) {
          // Follow the freshly-minted sign-in link into /onboarding.
          window.location.href = data.action_link
          return
        }
        switch (data.reason) {
          case "expired": setState({ kind: "expired" }); break
          case "closed":  setState({ kind: "closed" }); break
          case "already":
            toast.info("You've already accepted this invite — please sign in.")
            navigate("/login", { replace: true })
            break
          default:        setState({ kind: "invalid" })
        }
      } catch {
        setState({ kind: "invalid" })
      }
    })()
  }, [params, navigate])

  if (state.kind === "expired") return <RevokedScreen reason="invite_expired" />
  if (state.kind === "closed") return <RevokedScreen reason="onboarding_expired" />

  if (state.kind === "invalid" || state.kind === "preview") {
    const isPreview = state.kind === "preview"
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
          <div className="text-4xl mb-5">{isPreview ? "👁️" : "🔗"}</div>
          <h1 className="text-2xl font-semibold text-white mb-3" style={{ fontFamily: "Fraunces, serif" }}>
            {isPreview ? "Invite acceptance" : "This link isn't valid"}
          </h1>
          <p className="text-white/60 text-sm leading-relaxed mb-6" style={{ fontFamily: "Manrope, sans-serif" }}>
            {isPreview
              ? "Invite acceptance runs against the live environment. In preview there's no invite to accept."
              : "This invite link is invalid or has been superseded by a newer one. Check for the most recent invite email, or contact your Divigner representative for a fresh invitation."}
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

  // working — verifying the token / redirecting into onboarding.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: DIVIGNER_BG }}>
      <Loader2 className="h-8 w-8 animate-spin text-[#34D6C2]" />
      <p className="text-white/50 text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>
        Verifying your invite…
      </p>
    </div>
  )
}
