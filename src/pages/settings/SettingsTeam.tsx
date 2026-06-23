import { useState } from "react"
import { PageHeader } from "@/components/PageHeader"
import { TeamSection } from "@/components/TeamSection"
import { RaSection } from "@/components/RaSection"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Link2 } from "lucide-react"

const TAB_KEY = "avanew-crm.settings-team.tab"

export function SettingsTeam() {
  // Persist the active tab so navigating away (e.g. into an RA's detail view)
  // and back doesn't kick the admin out of the Referral Associates tab — they
  // were doing repeat clicks every time.
  const [tab, setTab] = useState<string>(() => {
    if (typeof window === "undefined") return "team"
    const saved = window.localStorage.getItem(TAB_KEY)
    return saved === "ra" || saved === "team" ? saved : "team"
  })

  function handleChange(next: string) {
    setTab(next)
    try { window.localStorage.setItem(TAB_KEY, next) } catch { /* ignore quota */ }
  }

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Team / Organization"
        description="Manage team members, assign roles, and control access."
      />
      <Tabs value={tab} onValueChange={handleChange}>
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
