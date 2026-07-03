import { FlaskConical } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { RaProgramSection } from "@/pages/referral-program/RaProgramSection"

/**
 * Referral Program → Referral Associates. Sandbox home for RA management
 * while the section is built out — the team keeps working from the live
 * Settings → Team → Referral Associates tab until cutover. See the header
 * comment in RaProgramSection.tsx for the sync rules between the copies.
 */
export function ReferralProgramAssociates() {
  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Referral Associates"
        description="Invite, review, and manage Referral Associates."
      />

      {/* Sandbox notice — remove at cutover. Both copies read/write the same
          production data; this banner is about which UI the team should use. */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-amber-500">Preview copy.</span>{" "}
          This is the future home of RA management while the Referral Program
          section is built out. For day-to-day work, keep using{" "}
          <span className="font-medium">Settings → Team / Organization → Referral Associates</span>{" "}
          — both views show the same live data.
        </p>
      </div>

      <RaProgramSection />
    </div>
  )
}
