import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { Settings as SettingsIcon, Landmark, ExternalLink, Crown, Briefcase, ShieldCheck, Target, Handshake } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/PageHeader"
import { StageManager } from "@/components/StageManager"
import { TeamSection } from "@/components/TeamSection"
import { getMyProfile, updateMyProfile, type ProfileLite } from "@/lib/data"
import { useRole } from "@/hooks/useRole"

export function Settings() {
  const { role, isOwner, isSuperUser } = useRole()
  const [profile, setProfile] = useState<ProfileLite | null>(null)
  const [fullName, setFullName] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)

  async function refreshProfile() {
    try {
      const p = await getMyProfile()
      setProfile(p)
      setFullName(p.full_name ?? "")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load profile")
    }
  }

  useEffect(() => {
    void refreshProfile()
  }, [])

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await updateMyProfile({ full_name: fullName.trim() })
      toast.success("Profile updated")
      await refreshProfile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your profile, pipeline, and team."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How you appear inside Avanew CRM.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile?.email ?? ""}
                  disabled
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Display name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jordan Avery"
                />
              </div>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Pipeline stages
            </CardTitle>
            <CardDescription>
              Customize the stages deals move through.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Add new stages, rename, reorder, or mark stages as won/lost.
              Changes apply to the Deals kanban immediately.
            </p>
            <Button variant="outline" onClick={() => setStageOpen(true)}>
              Manage stages
            </Button>
          </CardContent>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Bank Integrations
              </CardTitle>
              <CardDescription>
                Connect Mercury or Plaid to automatically sync transactions into Cashflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Manage Connections</p>
                  <p className="text-xs text-muted-foreground">Add Mercury or Plaid-linked bank accounts.</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/cashflow/bank-connections">
                    Open Bank Connections
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-[13px]">Required environment variables</p>
                <div className="space-y-1.5 font-mono">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">Mercury</Badge>
                    <span><code>MERCURY_API_KEY</code> — read-only API token from Mercury Settings › API</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">Plaid</Badge>
                    <span>
                      <code>PLAID_CLIENT_ID</code>, <code>PLAID_SECRET</code>, <code>PLAID_ENV</code> (sandbox | development | production)
                    </span>
                  </div>
                </div>
                <p className="pt-1 text-[11px]">Set these in Supabase Dashboard › Edge Functions › Secrets. They are never exposed to the frontend.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {role === "partner" && (
          <Card className="border-purple-300 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <Handshake className="h-4 w-4" />
                Partner — External Access
              </CardTitle>
              <CardDescription>
                You have limited external visibility into data that has been explicitly shared with you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Assigned or shared partner-visible data</li>
                    <li>Operational alerts for assigned data</li>
                    <li>Personal notification preferences</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>View shared records and updates</li>
                    <li>Manage your own profile</li>
                    <li>Configure personal notification channels</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Not available at this role</p>
                <p>Internal CRM data, Cashflow, AI Insights, AVE, financial dashboards, reports, team management, pipeline configuration, and system settings are not accessible. All security policies are enforced — you cannot modify authentication rules. Contact your internal point of contact for access changes.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {role === "bd" && (
          <Card className="border-emerald-300 dark:border-emerald-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Target className="h-4 w-4" />
                BD — Business Development
              </CardTitle>
              <CardDescription>
                You have access to your assigned pipeline. All data is scoped to records assigned directly to you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Assigned leads, contacts, and deals</li>
                    <li>Tasks and activities on your records</li>
                    <li>Personal notification preferences</li>
                    <li>Operational alerts for assigned data</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Create and edit assigned CRM records</li>
                    <li>Log calls, emails, meetings, and notes</li>
                    <li>Manage tasks on your pipeline</li>
                    <li>Update deal stages for assigned deals</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Not available at this role</p>
                <p>Cashflow, AI Insights, AVE, financial dashboards, financial reports, team management, pipeline configuration, and records not assigned to you are restricted. Contact your Admin or Owner for broader access.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {role === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Admin — Operations Control
              </CardTitle>
              <CardDescription>
                You manage operational workflows and CRM data. Financial modules are not available at this access level.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>All CRM modules — Deals, Leads, Contacts, Tasks</li>
                    <li>User management (if permitted by Owner)</li>
                    <li>Non-financial reports and summaries</li>
                    <li>Operational and non-financial notifications</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Manage operational workflows</li>
                    <li>Manage pipeline stages and deal tracking</li>
                    <li>Configure non-financial notification preferences</li>
                    <li>Manage team members (if permitted)</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Not available at this role</p>
                <p>Cashflow, AI Insights, AVE, financial dashboards, financial reports, financial notifications, and bank integrations are restricted to Owner and above. All authentication policies set by the Super User are enforced — you cannot modify security rules. Contact your Owner or Super User for financial or security changes.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {role === "owner" && (
          <Card className="border-blue-300 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Briefcase className="h-4 w-4" />
                Owner — Business Intelligence Authority
              </CardTitle>
              <CardDescription>
                You are the business-level decision-maker with full access to financial data, AI insights, and AVE.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>All CRM business data</li>
                    <li>Cashflow module and connected bank account data</li>
                    <li>AI Insights and financial forecasts</li>
                    <li>AVE (AI Voice Experience) — global</li>
                    <li>Reports and business summaries</li>
                    <li>Integration data outputs (synced transactions, balances)</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Trigger AI insights and forecasting</li>
                    <li>Receive financial, AI Insight, and operational alerts</li>
                    <li>Configure personal notification channels</li>
                    <li>Interact with AVE across the application</li>
                    <li>View business-level analytics</li>
                    <li>Enable MFA and view personal login history</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Restrictions</p>
                <p>Cannot override system-level permissions, access DevOps or API credential configuration, or modify global authentication and security policies. MFA and session policies are enforced by the Super User and must be followed. Contact your Super User for system-level changes.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isSuperUser && (
          <Card className="border-yellow-300 dark:border-yellow-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <Crown className="h-4 w-4" />
                Super User — Platform Authority
              </CardTitle>
              <CardDescription>
                You are the system owner and platform controller. You have unrestricted visibility and control across the entire platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data Access</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>All CRM data across all users</li>
                    <li>All financial data and Cashflow insights</li>
                    <li>All AVE sessions and conversation transcripts</li>
                    <li>All audit logs and system activity</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">System Control</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Manage all users, roles, and permissions</li>
                    <li>Override any restriction platform-wide</li>
                    <li>Configure authentication policies (MFA, sessions)</li>
                    <li>Configure API credentials for all integrations</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">DevOps</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Deployment configuration and release management</li>
                    <li>Environment variables and backend secrets</li>
                    <li>CI/CD pipeline configuration</li>
                    <li>Infrastructure health and uptime monitoring</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Integrations</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Mercury, Plaid — bank sync API credentials</li>
                    <li>Twilio — SMS and voice credentials</li>
                    <li>Tavus — AVE replica and persona config</li>
                    <li>Email providers and notification channel setup</li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monitoring</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Inspect system logs and debug issues</li>
                    <li>Monitor data sync health and errors</li>
                    <li>Configure global notification channels</li>
                    <li>Access security audit logs and authentication events</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="lg:col-span-2">
          <TeamSection />
        </div>
      </div>

      <StageManager
        open={stageOpen}
        onOpenChange={setStageOpen}
        onChanged={() => {
          /* nothing to refresh on this page */
        }}
      />
    </div>
  )
}
