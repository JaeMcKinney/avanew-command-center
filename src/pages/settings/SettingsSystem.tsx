import { Server, Globe, Clock, ToggleLeft } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"

const SYSTEM_SECTIONS = [
  {
    icon: Globe,
    title: "Locale & Region",
    description: "Default timezone, date format, currency display, and language settings.",
  },
  {
    icon: Clock,
    title: "Session & Timeout",
    description: "Configure idle session duration and automatic logout behavior platform-wide.",
  },
  {
    icon: ToggleLeft,
    title: "Feature Flags",
    description: "Enable or disable experimental features and beta capabilities for the platform.",
  },
]

export function SettingsSystem() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="System Preferences"
        description="Platform-level configuration for locale, sessions, and feature flags. Super User access only."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Platform Configuration
          </CardTitle>
          <CardDescription>
            Global settings that apply across all users and sessions on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SYSTEM_SECTIONS.map(({ icon: Icon, title, description }) => (
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
