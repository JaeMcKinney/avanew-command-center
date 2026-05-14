import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import {
  Crown,
  Briefcase,
  ShieldCheck,
  Target,
  Handshake,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/PageHeader"
import { getMyProfile, updateMyProfile, type ProfileLite } from "@/lib/data"
import { useRole } from "@/hooks/useRole"
import { supabase } from "@/lib/supabase"
import { AvatarUpload } from "@/components/AvatarUpload"

function deriveInitials(name: string | null, email: string | null) {
  const src = name || email || "U"
  return src
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "U"
}

export function SettingsProfile() {
  const { role, isSuperUser } = useRole()
  const [profile, setProfile] = useState<ProfileLite | null>(null)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [saving, setSaving] = useState(false)

  // password change state
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPw, setChangingPw] = useState(false)

  async function refresh() {
    try {
      const p = await getMyProfile()
      setProfile(p)
      setFullName(p.full_name ?? "")
      setPhone(p.phone ?? "")
      setJobTitle(p.job_title ?? "")
      setAvatarUrl(p.avatar_url ?? "")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load profile")
    }
  }

  useEffect(() => { void refresh() }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateMyProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        job_title: jobTitle.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
      })
      toast.success("Profile updated")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setChangingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success("Password updated successfully")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password")
    } finally {
      setChangingPw(false)
    }
  }

  const initials = deriveInitials(profile?.full_name ?? null, profile?.email ?? null)

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="My Profile"
        description="Manage your personal information and account security."
      />

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>How you appear inside Avanew Command Center.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <AvatarUpload
                currentUrl={avatarUrl || null}
                initials={initials}
                onUploaded={(url) => {
                  setAvatarUrl(url)
                  void updateMyProfile({ full_name: fullName, avatar_url: url })
                }}
              />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Profile photo</p>
                <p>Click your avatar to upload a new photo.</p>
                <p className="text-xs mt-0.5">JPG, PNG, WebP · Max 5 MB</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? ""} disabled readOnly />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={role ?? ""} disabled readOnly className="capitalize" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jordan Avery"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input
                  id="jobTitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Business Development Manager"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password. You'll stay signed in on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={changingPw || !newPassword || !confirmPassword}>
              {changingPw ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isSuperUser && (
        <Card className="border-yellow-300 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <Crown className="h-4 w-4" />
              Super User — Platform Authority
            </CardTitle>
            <CardDescription>
              You are the system owner and platform controller with unrestricted visibility across the entire platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data Access</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>All CRM data across all users</li>
                  <li>All financial data and Cashflow insights</li>
                  <li>All AVE sessions and transcripts</li>
                  <li>All audit logs and system activity</li>
                </ul>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">System Control</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Manage all users, roles, and permissions</li>
                  <li>Override any restriction platform-wide</li>
                  <li>Configure authentication policies</li>
                  <li>Configure API credentials for all integrations</li>
                </ul>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">DevOps</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Deployment and release management</li>
                  <li>Environment variables and secrets</li>
                  <li>CI/CD pipeline configuration</li>
                  <li>Infrastructure health monitoring</li>
                </ul>
              </div>
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
              Full access to financial data, AI insights, AVE, and business-level decision tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>All CRM business data</li>
                  <li>Cashflow module and connected bank accounts</li>
                  <li>AI Insights and financial forecasts</li>
                  <li>AVE (AI Voice Experience)</li>
                  <li>Reports and business summaries</li>
                  <li>Integration data outputs</li>
                </ul>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Trigger AI insights and forecasting</li>
                  <li>Receive financial, AI, and operational alerts</li>
                  <li>Interact with AVE across the application</li>
                  <li>Enable MFA and view personal login history</li>
                  <li>View business-level analytics</li>
                </ul>
              </div>
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
              Manage operational workflows and CRM data. Financial modules are not available at this access level.
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
                  <li>Configure non-financial notifications</li>
                  <li>Manage team members (if permitted)</li>
                </ul>
              </div>
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
              Access to your assigned pipeline. All data is scoped to records assigned directly to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Assigned leads, contacts, and deals</li>
                  <li>Activities on your records</li>
                  <li>Personal notification preferences</li>
                  <li>Operational alerts for assigned data</li>
                </ul>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Create and edit assigned CRM records</li>
                  <li>Log calls, emails, meetings, and notes</li>
                  <li>Update deal stages for assigned deals</li>
                </ul>
              </div>
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
              Limited external visibility into data that has been explicitly shared with you.
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
