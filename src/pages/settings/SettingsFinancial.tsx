import { Link } from "react-router-dom"
import { Landmark, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/PageHeader"

export function SettingsFinancial() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Financial Settings"
        description="Manage bank connections, sync credentials, and financial data sources."
      />

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
                  <code>PLAID_CLIENT_ID</code>, <code>PLAID_SECRET</code>, <code>PLAID_ENV</code>{" "}
                  (sandbox | development | production)
                </span>
              </div>
            </div>
            <p className="pt-1 text-[11px]">
              Set these in Supabase Dashboard › Edge Functions › Secrets. They are never exposed to the frontend.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync Settings</CardTitle>
          <CardDescription>Configure how frequently transactions are fetched and how far back to sync.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10 rounded-lg border border-dashed border-border">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Sync schedule and history window</p>
              <p className="text-xs text-muted-foreground/60">Coming soon</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
