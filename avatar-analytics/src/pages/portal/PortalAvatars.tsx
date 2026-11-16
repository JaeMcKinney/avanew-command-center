import { AvatarCards } from "@/components/AvatarCards"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/States"
import { usePortalClient } from "@/pages/portal/PortalLayout"

export default function PortalAvatars() {
  const client = usePortalClient()
  return (
    <>
      <PageHeader title="Avatars and embed codes" description="Copy the code for an avatar and paste it into your website where the avatar should appear." />
      <AvatarCards
        clientId={client.id}
        manage={false}
        showEmbeds
        empty={<EmptyState title="Your avatars are being set up">They will appear here once Divigner links them.</EmptyState>}
      />
    </>
  )
}
