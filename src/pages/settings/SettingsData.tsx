import { Database, Upload, Download, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"

const DATA_SECTIONS = [
  {
    icon: Upload,
    title: "Data Import",
    description: "Import contacts, deals, leads, or transactions from CSV or third-party exports.",
  },
  {
    icon: Download,
    title: "Data Export",
    description: "Export any module to CSV or JSON for backup, analysis, or migration.",
  },
  {
    icon: Trash2,
    title: "Data Cleanup",
    description: "Archive or delete stale records, duplicate contacts, and orphaned data.",
  },
]

export function SettingsData() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Data Management"
        description="Import, export, archive, and manage platform data. Super User access only."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Operations
          </CardTitle>
          <CardDescription>
            Bulk data operations for CRM records, financial data, and system configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DATA_SECTIONS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 text-[10px]">Coming soon</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
