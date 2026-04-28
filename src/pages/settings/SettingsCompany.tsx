import { Building2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"

export function SettingsCompany() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Company Profile"
        description="Manage your business identity, branding information, and company details."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Business Information
          </CardTitle>
          <CardDescription>
            Company name, logo, address, and contact details displayed throughout the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Company profile configuration</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Set your business name, logo, address, fiscal year, and other company-wide defaults.
              </p>
            </div>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
