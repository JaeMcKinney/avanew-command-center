import { ScrollText, Filter } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"

export function SettingsAuditLogs() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Review authentication events, permission changes, and system activity history."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Activity Log
          </CardTitle>
          <CardDescription>
            Immutable record of user actions, role changes, login events, and data modifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <ScrollText className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Audit trail</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Filterable log of all significant events including authentication, permission changes, data exports, and system configuration updates.
              </p>
            </div>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Log Filters &amp; Export
          </CardTitle>
          <CardDescription>
            Filter by event type, user, date range, or severity and export for compliance reporting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Filter className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground max-w-xs">
              Advanced filtering and CSV/JSON export for compliance and security reviews.
            </p>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
