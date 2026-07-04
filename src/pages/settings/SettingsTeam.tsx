import { PageHeader } from "@/components/PageHeader"
import { TeamSection } from "@/components/TeamSection"

// Referral Associates moved to /referral-program/associates at the
// 2026-07-04 cutover — this page is back to team members only. (The old
// tabbed layout, its localStorage tab key, and the team-tab-change event
// went with it.)
export function SettingsTeam() {
  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Team / Organization"
        description="Manage team members, assign roles, and control access."
      />
      <TeamSection />
    </div>
  )
}
