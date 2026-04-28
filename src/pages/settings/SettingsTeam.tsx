import { PageHeader } from "@/components/PageHeader"
import { TeamSection } from "@/components/TeamSection"

export function SettingsTeam() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Team / Organization"
        description="Manage team members, assign roles, and control access."
      />
      <TeamSection />
    </div>
  )
}
