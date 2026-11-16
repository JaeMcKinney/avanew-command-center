import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { AvatarPhoto } from "@/components/AvatarPhoto"
import { TavusSyncStatus } from "@/components/AvatarPicker"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { InfoPill, StatusPill } from "@/components/StatusPill"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { listClients, searchPals } from "@/lib/api"
import { Link2 } from "lucide-react"

/** Every avatar in the Tavus account, and which client each one belongs to. */
export default function Avatars() {
  const [query, setQuery] = useState("")
  const hits = useQuery({ queryKey: ["pal-search", query], queryFn: () => searchPals(query), placeholderData: (prev) => prev })
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients })
  const slugOf = (clientId: string | null) => clients.data?.find((c) => c.id === clientId)?.slug

  return (
    <>
      <PageHeader title="Tavus avatars" description="A copy of the avatars in your Tavus account. To link one, open a client and choose “Link avatars”." />
      <TavusSyncStatus />
      <div className="flex max-w-md flex-col gap-1.5">
        <Label htmlFor="avatar-search">Search by name or website</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="avatar-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-10 pl-9" autoComplete="off" />
        </div>
      </div>

      {hits.isPending ? (
        <LoadingBlock label="Loading avatars" />
      ) : hits.isError ? (
        <ErrorBlock error={hits.error} onRetry={() => void hits.refetch()} />
      ) : hits.data.length === 0 ? (
        <EmptyState title={query ? "No avatars match" : "No avatars loaded yet"}>
          {query ? "Try a shorter word." : "Choose “Refresh from Tavus” to load the avatars in your Tavus account."}
        </EmptyState>
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">{hits.data.length} avatar{hits.data.length === 1 ? "" : "s"}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {hits.data.map((hit) => {
              const slug = slugOf(hit.linked_client_id)
              return (
                <li key={hit.pal_id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                  <AvatarPhoto name={hit.name || hit.pal_id} src={hit.thumbnail_image_url} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{hit.name || "(no name)"}</p>
                    <p className="font-mono text-xs text-muted-foreground">{hit.pal_id}</p>
                    <p className="text-xs text-muted-foreground">{hit.deployments.length} deployment{hit.deployments.length === 1 ? "" : "s"}</p>
                    <p className="mt-1.5">
                      {hit.linked_avatar_id ? (
                        <StatusPill tone="ok" icon={<Link2 />}>
                          {slug ? <Link to={`/admin/clients/${slug}`} className="underline">{hit.linked_client_name}</Link> : hit.linked_client_name}
                        </StatusPill>
                      ) : (
                        <InfoPill>Not linked</InfoPill>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
