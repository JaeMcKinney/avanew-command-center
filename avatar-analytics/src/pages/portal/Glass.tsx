import { GlassConnectionCard, GlassUsage, useGlassConnection } from "@/components/Glass"
import { PageHeader } from "@/components/PageHeader"
import { type Client } from "@/lib/api"
import { usePortalClient } from "@/pages/portal/PortalLayout"

/** Shown in the client's portal, and inside the client's file for Divigner staff (pass `client` and `embedded`). */
export default function Glass({ client: given, embedded = false }: { client?: Client; embedded?: boolean } = {}) {
  const fromPortal = usePortalClient()
  const client = given ?? fromPortal
  const connection = useGlassConnection(client.id)
  return (
    <>
      {!embedded && <PageHeader title="Glass Health" description="Your clinical avatars look up published medical evidence through your own Glass Health account. Connect the account here, and see how much of it your avatars have used." />}
      {embedded && <p className="max-w-prose text-sm text-muted-foreground">{client.name}'s clinical avatars look up published medical evidence through the client's own Glass Health account. The client pays Glass directly; this shows how much of that account their avatars used.</p>}
      <GlassConnectionCard client={client} />
      {connection.data && <GlassUsage client={client} />}
    </>
  )
}
