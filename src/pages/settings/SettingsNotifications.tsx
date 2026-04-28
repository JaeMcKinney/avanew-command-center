import { Bell } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"
import { useRole } from "@/hooks/useRole"

const NOTIFICATION_TYPES = [
  { type: "Financial alerts", description: "Low balance, large transactions, sync failures", roles: ["owner", "super_user"] },
  { type: "AI Insight alerts", description: "Forecasting updates, anomalies detected", roles: ["owner", "super_user"] },
  { type: "Operational alerts", description: "CRM activity, task due dates, deal stage changes", roles: ["owner", "super_user", "admin", "member", "viewer", "bd", "partner"] },
  { type: "Team alerts", description: "New members, role changes, permission updates", roles: ["owner", "super_user", "admin"] },
  { type: "System alerts", description: "Deployment events, errors, sync health", roles: ["super_user"] },
]

export function SettingsNotifications() {
  const { role } = useRole()

  const available = NOTIFICATION_TYPES.filter(
    (n) => role === "super_user" || (role && n.roles.includes(role))
  )

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Configure which alerts you receive and how they are delivered."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notification Types
          </CardTitle>
          <CardDescription>
            The alerts available to you are determined by your role. Personal channel preferences are coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {available.map((n) => (
            <div
              key={n.type}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium">{n.type}</p>
                <p className="text-xs text-muted-foreground">{n.description}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">Available</Badge>
            </div>
          ))}
          {available.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No notification types are configured for your role.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Channels</CardTitle>
          <CardDescription>Configure how notifications reach you — email, SMS, in-app.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Channel configuration</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Set your preferred delivery channels and configure email, SMS, and in-app notification preferences.
              </p>
            </div>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
