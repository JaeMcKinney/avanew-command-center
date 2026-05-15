import { useNavigate } from "react-router-dom"
import { Building2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOrganization } from "@/contexts/OrganizationContext"
import type { OrgWithRole } from "@/types/db"

const ROLE_LABEL: Record<string, string> = {
  super_user: "Super User",
  owner: "Owner",
  admin: "Admin",
  bd: "Business Development",
  partner: "Partner",
}

// Local icon overrides keyed by org slug — takes precedence over logo_url from DB
const ORG_ICONS: Record<string, string> = {
  avanew: "/logos/avanew-icon.svg",
  divigner: "/logos/divigner-icon-clean.png",
}

export function OrgPicker() {
  const navigate = useNavigate()
  const { orgs, selectOrg, loading } = useOrganization()

  function enter(org: OrgWithRole) {
    selectOrg(org)
    navigate("/", { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-2">
            AC
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose a workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            Select the organization you want to work in
          </p>
        </div>

        {/* Org cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Loading your workspaces…
            </div>
          ) : orgs.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              You don't belong to any organization yet.
              <br />
              Contact your administrator to get access.
            </div>
          ) : (
            orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => enter(org)}
                className="w-full flex items-center gap-4 rounded-xl border bg-card p-4 text-left
                           hover:border-primary/50 hover:bg-accent transition-all
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(() => {
                  const iconSrc = ORG_ICONS[org.slug ?? ""] ?? org.logo_url
                  return iconSrc ? (
                    <div className="h-12 w-12 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden p-1">
                      <img
                        src={iconSrc}
                        alt={org.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )
                })()}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABEL[org.role] ?? org.role}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>

        {/* Sign out link */}
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs"
            onClick={() => navigate("/login")}
          >
            Sign in with a different account
          </Button>
        </div>
      </div>
    </div>
  )
}
