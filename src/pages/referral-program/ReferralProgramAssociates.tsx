import { PageHeader } from "@/components/PageHeader"
import { RaProgramSection } from "@/pages/referral-program/RaProgramSection"

/** Referral Program → Referral Associates — the live home of RA management
 * since the 2026-07-04 cutover from Settings → Team. */
export function ReferralProgramAssociates() {
  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title="Referral Associates"
        description="Invite, review, and manage Referral Associates."
      />
      <RaProgramSection />
    </div>
  )
}
