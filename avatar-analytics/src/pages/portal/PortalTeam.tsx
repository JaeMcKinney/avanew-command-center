import { PageHeader } from "@/components/PageHeader"
import { UsersPanel } from "@/components/UsersPanel"
import { useAuth } from "@/hooks/useAuth"
import { usePortalClient } from "@/pages/portal/PortalLayout"

export default function PortalTeam() {
  const client = usePortalClient()
  const { can } = useAuth()
  return (
    <>
      <PageHeader title="Team" description={`The people at ${client.name} who can sign in.`} />
      <UsersPanel scope={{ clientId: client.id, clientName: client.name }} canManage={can("client_users.manage")} />
    </>
  )
}
