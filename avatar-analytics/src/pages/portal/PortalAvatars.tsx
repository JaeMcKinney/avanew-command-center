import { AvatarCards } from "@/components/AvatarCards"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/States"
import { usePortalClient } from "@/pages/portal/PortalLayout"
import { COMPANY } from "@/lib/edition"

export default function PortalAvatars() {
  const client = usePortalClient()
  return (
    <>
      <PageHeader title="Avatars and Embed Codes" description="Copy the code for an avatar and paste it into your website where the avatar should appear." />
      <AvatarCards
        clientId={client.id}
        manage={false}
        showEmbeds
        empty={<EmptyState title="Your Avatars Are Being Set Up">They will appear here once {COMPANY} links them.</EmptyState>}
      />
    </>
  )
}
