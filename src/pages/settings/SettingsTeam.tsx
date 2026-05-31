import { PageHeader } from "@/components/PageHeader"
import { TeamSection } from "@/components/TeamSection"
import { RaSection } from "@/components/RaSection"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Link2 } from "lucide-react"

export function SettingsTeam() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Team / Organization"
        description="Manage team members, assign roles, and control access."
      />
      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team Members
          </TabsTrigger>
          <TabsTrigger value="ra" className="gap-2">
            <Link2 className="h-4 w-4" />
            Referral Associates
          </TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="mt-4">
          <TeamSection />
        </TabsContent>
        <TabsContent value="ra" className="mt-4">
          <RaSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
