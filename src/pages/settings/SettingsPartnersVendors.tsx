import { Handshake } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"

export function SettingsPartnersVendors() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Partner & Vendor Settings"
        description="Configure default fields, visibility rules, and access controls for external relationships."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="h-4 w-4" />
            External Relationship Defaults
          </CardTitle>
          <CardDescription>
            Set default visibility, required fields, and tagging rules for partner and vendor records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Handshake className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Partner &amp; vendor configuration</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Manage default fields, shared data rules, and access controls for partners and vendors.
              </p>
            </div>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
