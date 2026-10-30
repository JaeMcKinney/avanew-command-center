import { useNavigate } from "react-router-dom"
import { Building2, ArrowRight } from "lucide-react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useTheme } from "@/lib/theme"
import { SITE } from "@/lib/siteBrand"
import { cn } from "@/lib/utils"
import type { OrgWithRole } from "@/types/db"

const ROLE_LABEL: Record<string, string> = {
  super_user: "Super User",
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
  bd: "Business Development",
  partner: "Partner",
}

// Local icon overrides keyed by org slug — takes precedence over logo_url from DB
const ORG_ICONS: Record<string, string> = {
  avanew: "/brands/avanew/favicon.svg",
  divigner: "/logos/divigner-icon-clean.png",
}

export function OrgPicker() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { orgs, selectOrg, loading } = useOrganization()

  function enter(org: OrgWithRole) {
    selectOrg(org)
    navigate("/", { replace: true })
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

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-10 px-6 py-12">
        <div className="flex flex-col items-center gap-6 text-center">
          <img
            src={theme === "dark" ? SITE.logoDark : SITE.logoLight}
            alt={SITE.appName}
            className="h-14 w-auto"
          />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Choose a Workspace</h1>
            {(loading || orgs.length > 0) && (
              <p className="text-sm text-muted-foreground">Pick where you want to work today.</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading your workspaces…
            </div>
          ) : orgs.length === 0 ? (
            <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              You don't belong to a workspace here yet.
              <br />
              Contact your administrator to get access.
            </div>
          ) : (
            orgs.map((org) => {
              const iconSrc = ORG_ICONS[org.slug ?? ""] ?? org.logo_url
              const isHome = org.slug === SITE.homeOrgSlug
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => enter(org)}
                  className={cn(
                    "group flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm",
                    "transition-all hover:-translate-y-0.5 hover:border-primary/60",
                    "hover:shadow-[0_14px_34px_-18px_color-mix(in_srgb,var(--primary)_70%,transparent)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isHome && "border-primary/40"
                  )}
                >
                  {iconSrc ? (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted p-1.5">
                      <img src={iconSrc} alt="" className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{org.name}</p>
                      {isHome && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Home
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[org.role] ?? org.role}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              )
            })
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Sign In With a Different Account
          </button>
        </div>
      </div>
    </div>
  )
}
