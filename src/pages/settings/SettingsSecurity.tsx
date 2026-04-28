import { Lock, ShieldCheck, KeyRound, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"
import { useRole } from "@/hooks/useRole"

export function SettingsSecurity() {
  const { isSuperUser } = useRole()

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Security"
        description="Manage authentication policies, MFA, and session configuration."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Multi-Factor Authentication
          </CardTitle>
          <CardDescription>
            Enable MFA for your account. Owners can enable MFA; Super User controls platform-wide MFA policy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">MFA enrollment</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Configure authenticator app or SMS-based multi-factor authentication for your account.
              </p>
            </div>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Login History
          </CardTitle>
          <CardDescription>
            View recent sign-in events for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Session history</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                View IP addresses, timestamps, and device information for recent logins.
              </p>
            </div>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>

      {isSuperUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Platform Authentication Policies
            </CardTitle>
            <CardDescription>
              Configure MFA requirements, session timeouts, and password policies platform-wide.
              Super User access only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Lock className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Global authentication settings</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Enforce MFA platform-wide, configure session timeout durations, and set password complexity rules.
                </p>
              </div>
              <Badge variant="secondary">Coming soon</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
