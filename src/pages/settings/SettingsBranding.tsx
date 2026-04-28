import { Palette, Moon, Type } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"

export function SettingsBranding() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Branding / UI Settings"
        description="Customize visual appearance, color theme, and interface preferences."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Color Theme
          </CardTitle>
          <CardDescription>
            Set the primary brand color and accent palette used across the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Palette className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Brand color configuration</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Choose primary and accent colors, configure light and dark mode preferences for your team.
              </p>
            </div>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Moon className="h-4 w-4" />
              Dark Mode
            </CardTitle>
            <CardDescription>System, light, or forced dark mode for all users.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              <Badge variant="secondary">Coming soon</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Type className="h-4 w-4" />
              Typography
            </CardTitle>
            <CardDescription>Font size preferences and density settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              <Badge variant="secondary">Coming soon</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
