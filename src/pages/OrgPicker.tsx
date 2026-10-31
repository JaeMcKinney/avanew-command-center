import { Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useTheme } from "@/lib/theme"
import { SITE } from "@/lib/siteBrand"

// There is no workspace picker: each domain opens its one workspace directly.
// This screen only shows when the signed-in user has no access on this site.
export function OrgPicker() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { signOut } = useAuth()
  const { currentOrg, loading } = useOrganization()

  if (currentOrg) return <Navigate to="/dashboard" replace />

  async function switchAccount() {
    await signOut()
    navigate("/login", { replace: true })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 420px at 50% -10%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12 text-center">
        <img
          src={theme === "dark" ? SITE.logoDark : SITE.logoLight}
          alt={SITE.appName}
          className="mx-auto h-14 w-auto"
        />
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">No Access Yet</h1>
              <p className="text-sm text-muted-foreground">
                This account isn't set up for {SITE.appName} yet. Contact your administrator to get access.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={switchAccount}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Sign In With a Different Account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
