import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Plus } from "lucide-react"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AvatarCards } from "@/components/AvatarCards"
import { AvatarPicker } from "@/components/AvatarPicker"
import { ClientAccount, ClientContacts, ClientNotes } from "@/components/ClientFile"
import { ClientForm } from "@/components/ClientForm"
import { LogoEditor } from "@/components/LogoEditor"
import { PageHeader } from "@/components/PageHeader"
import { Stat } from "@/components/Stat"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { ClientStatusPill } from "@/components/StatusPill"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersPanel } from "@/components/UsersPanel"
import Conversations from "@/pages/portal/Conversations"
import Dashboard from "@/pages/portal/Dashboard"
import Questions from "@/pages/portal/Questions"
import { useAuth } from "@/hooks/useAuth"
import { getClientBySlug, sumUsage, updateClient, usageByDay, type Client } from "@/lib/api"
import { browserToday, presetRange, startOfMonth } from "@/lib/dates"
import { count, minutes } from "@/lib/format"

function UsageSummary({ client }: { client: Client }) {
  const today = browserToday()
  const year = presetRange("year", today)
  const days = useQuery({ queryKey: ["usage-by-day", client.id, year.from, year.to], queryFn: () => usageByDay(client.id, year) })
  const rows = days.data ?? []
  const day = sumUsage(rows.filter((r) => r.usage_date === today))
  const month = sumUsage(rows.filter((r) => r.usage_date >= startOfMonth(today)))
  const all = sumUsage(rows)
  return (
    <section aria-label="Talk time" className="grid gap-3 sm:grid-cols-3">
      <Stat label="Today" value={minutes(day.billable_seconds)} unit="min" note={`${count(day.conversations)} conversations`} />
      <Stat highlight label="This month" value={minutes(month.billable_seconds)} unit="min" note={`${count(month.conversations)} conversations`} />
      <Stat label="This year" value={minutes(all.billable_seconds)} unit="min" note={`${count(all.conversations)} conversations`} />
    </section>
  )
}

export default function ClientDetail() {
  const { slug = "" } = useParams()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const client = useQuery({ queryKey: ["client", slug], queryFn: () => getClientBySlug(slug) })
  const [linking, setLinking] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (values: Parameters<typeof updateClient>[1]) => updateClient(client.data!.id, values),
    onSuccess: () => {
      toast.success("Client details saved.")
      void queryClient.invalidateQueries({ queryKey: ["client", slug] })
      void queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
    onError: (err: Error) => setSaveError(err.message),
  })

  if (client.isPending) return <LoadingBlock label="Loading client" />
  if (client.isError) return <ErrorBlock error={client.error} onRetry={() => void client.refetch()} />
  if (!client.data) {
    return (
      <EmptyState title="Client not found" action={<Button asChild variant="outline"><Link to="/admin/clients">Back to clients</Link></Button>}>
        It may have been removed, or you may not have access to it.
      </EmptyState>
    )
  }
  const c = client.data
  const canLink = can("avatars.link")

  return (
    <>
      <PageHeader
        back={{ to: "/admin/clients", label: "Clients" }}
        documentTitle={c.name}
        title={<span className="flex flex-wrap items-center gap-3">{c.name} <ClientStatusPill status={c.status} /></span>}
        description={<>Portal address <span className="font-mono">/c/{c.slug}</span> · {c.timezone.replace(/_/g, " ")}</>}
        actions={
          <Button asChild variant="outline" className="min-h-10">
            <Link to={`/c/${c.slug}`}>See what the client sees <ExternalLink aria-hidden="true" /></Link>
          </Button>
        }
      />

      {can("analytics.view") && <UsageSummary client={c} />}

      <Tabs defaultValue="avatars" className="flex flex-col gap-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="avatars" className="min-h-10 px-4">Avatars</TabsTrigger>
          {can("analytics.view") && <TabsTrigger value="analytics" className="min-h-10 px-4">Analytics</TabsTrigger>}
          {can("transcripts.view") && <TabsTrigger value="conversations" className="min-h-10 px-4">Conversations</TabsTrigger>}
          {can("transcripts.view") && <TabsTrigger value="questions" className="min-h-10 px-4">Questions</TabsTrigger>}
          <TabsTrigger value="people" className="min-h-10 px-4">People</TabsTrigger>
          <TabsTrigger value="notes" className="min-h-10 px-4">Notes</TabsTrigger>
          <TabsTrigger value="contacts" className="min-h-10 px-4">Contacts</TabsTrigger>
          <TabsTrigger value="details" className="min-h-10 px-4">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="avatars" className="flex flex-col gap-4">
          {canLink && (
            <div><Button className="min-h-10" onClick={() => setLinking(true)}><Plus aria-hidden="true" />Link avatars</Button></div>
          )}
          <AvatarCards
            clientId={c.id}
            manage={canLink}
            showEmbeds={can("embeds.view")}
            empty={
              <EmptyState title="No avatars linked yet" action={canLink && <Button className="min-h-10" onClick={() => setLinking(true)}>Link avatars</Button>}>
                Link this client's Tavus avatars to start counting their talk time and to get their embed codes.
              </EmptyState>
            }
          />
        </TabsContent>

        {/* The same screens the client has, so staff can read, export and answer without leaving the file. */}
        {can("analytics.view") && <TabsContent value="analytics" className="flex flex-col gap-6"><Dashboard client={c} embedded /></TabsContent>}
        {can("transcripts.view") && <TabsContent value="conversations" className="flex flex-col gap-4"><Conversations client={c} embedded /></TabsContent>}
        {can("transcripts.view") && <TabsContent value="questions" className="flex flex-col gap-4"><Questions client={c} embedded /></TabsContent>}

        <TabsContent value="people">
          <UsersPanel scope={{ clientId: c.id, clientName: c.name }} canManage={can("client_users.manage")} />
        </TabsContent>

        <TabsContent value="notes"><ClientNotes client={c} /></TabsContent>
        <TabsContent value="contacts"><ClientContacts client={c} /></TabsContent>

        <TabsContent value="details" className="flex flex-col gap-4">
          <ClientAccount key={`account-${c.updated_at}`} client={c} />
          {can("clients.manage") && (
            <>
              <LogoEditor clientId={c.id} clientName={c.name} current={c.logo_url} onSaved={() => void queryClient.invalidateQueries({ queryKey: ["client", c.slug] })} />
              <ClientForm
                key={c.updated_at}
                mode="edit"
                initial={{ name: c.name, slug: c.slug, timezone: c.timezone, brand_color: c.brand_color ?? "", logo_url: c.logo_url ?? "", status: c.status }}
                submitLabel="Save changes"
                busy={save.isPending}
                error={saveError}
                onSubmit={(v) => {
                  setSaveError(null)
                  save.mutate({ name: v.name, timezone: v.timezone, status: v.status, brand_color: v.brand_color || null, logo_url: v.logo_url || null })
                }}
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={linking} onOpenChange={setLinking}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link avatars to {c.name}</DialogTitle>
            <DialogDescription>Linking tells Tavus to report each call to this app. Nothing else about the avatar changes.</DialogDescription>
          </DialogHeader>
          <AvatarPicker clientId={c.id} clientName={c.name} />
        </DialogContent>
      </Dialog>
    </>
  )
}
