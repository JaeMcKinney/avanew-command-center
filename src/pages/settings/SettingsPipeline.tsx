import { useState } from "react"
import { Kanban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/PageHeader"
import { StageManager } from "@/components/StageManager"

export function SettingsPipeline() {
  const [stageOpen, setStageOpen] = useState(false)

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Pipeline / Deal Settings"
        description="Customize the stages deals move through and configure deal flow behavior."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Kanban className="h-4 w-4" />
            Deal Stages
          </CardTitle>
          <CardDescription>
            Add new stages, rename, reorder, or mark stages as won or lost.
            Changes apply to the Deals kanban immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your pipeline stages define how deals flow from initial contact through to close.
            Each stage can be configured as a win state, loss state, or active step.
          </p>
          <Button variant="outline" onClick={() => setStageOpen(true)}>
            Manage stages
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deal Defaults</CardTitle>
          <CardDescription>Default settings applied when new deals are created.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10 rounded-lg border border-dashed border-border">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Deal default configuration</p>
              <p className="text-xs text-muted-foreground/60">Coming soon</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <StageManager
        open={stageOpen}
        onOpenChange={setStageOpen}
        onChanged={() => {}}
      />
    </div>
  )
}
