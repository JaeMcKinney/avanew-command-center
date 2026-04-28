import { Plug2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"

const INTEGRATIONS = [
  { name: "Mercury", tag: "Banking", description: "Read-only bank account and transaction sync via Mercury API." },
  { name: "Plaid", tag: "Banking", description: "Multi-institution bank connections via Plaid Link." },
  { name: "Tavus", tag: "AI Voice", description: "AVE replica and persona configuration for the AI Voice Experience." },
  { name: "Twilio", tag: "Messaging", description: "SMS and voice notification delivery." },
  { name: "Email Provider", tag: "Notifications", description: "SMTP or transactional email service for system alerts." },
]

export function SettingsIntegrations() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Integrations"
        description="Manage third-party API credentials and service connections. Super User access only."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug2 className="h-4 w-4" />
            Connected Services
          </CardTitle>
          <CardDescription>
            API credentials are stored as Supabase Edge Function secrets and never exposed to the frontend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{integration.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5">{integration.tag}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-[10px]">Not configured</Badge>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">
            Configure credentials via Supabase Dashboard › Edge Functions › Secrets.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
