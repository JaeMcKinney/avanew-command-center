import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { AvatarPicker } from "@/components/AvatarPicker"
import { ClientForm } from "@/components/ClientForm"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { createClient, inviteUser, listRoles, type Client } from "@/lib/api"
import { cn } from "@/lib/utils"

const STEPS = ["Client Details", "Link Avatars", "Invite the Client"] as const

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Steps">
      {STEPS.map((label, i) => (
        <li key={label} aria-current={i === current ? "step" : undefined} className={cn("flex items-center gap-2", i === current ? "font-semibold" : "text-muted-foreground")}>
          <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold", i < current ? "bg-ok-soft text-ok" : i === current ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {i < current ? <Check className="size-3.5" aria-label="Done" /> : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  )
}

function InviteStep({ client, onDone }: { client: Client; onDone: (invited: string | null) => void }) {
  const roles = useQuery({ queryKey: ["roles"], queryFn: listRoles })
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const adminRole = roles.data?.find((r) => r.key === "client_admin")
  const invite = useMutation({
    mutationFn: () => inviteUser({ email, full_name: name, role_id: adminRole!.id, client_id: client.id }),
    onSuccess: () => onDone(email.trim()),
    onError: (err: Error) => setError(err.message),
  })
  return (
    <form className="flex max-w-xl flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); setError(null); if (adminRole) invite.mutate() }}>
      <p className="text-sm text-muted-foreground">
        Invite the main contact at {client.name}. They get an email with a link to choose a password, and can then invite their own colleagues.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-name">Their name</Label>
        <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} className="min-h-11" autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-email">Their email</Label>
        <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11" autoComplete="off" />
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={invite.isPending || !adminRole}>{invite.isPending ? "Sending…" : "Send invite"}</Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => onDone(null)}>Skip for now</Button>
      </div>
    </form>
  )
}

export default function ClientNew() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [client, setClient] = useState<Client | null>(null)
  const [linked, setLinked] = useState(0)
  const [invited, setInvited] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the step heading so screen-reader users hear the new step.
  useEffect(() => { headingRef.current?.focus() }, [step, invited])

  const create = useMutation({
    mutationFn: createClient,
    onSuccess: (created) => {
      setClient(created)
      setStep(can("avatars.link") ? 1 : 2)
      toast.success(`${created.name} created.`)
      void queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const done = invited !== undefined

  return (
    <>
      <PageHeader title="New Client" back={{ to: "/admin/clients", label: "Clients" }} />
      {!done && <Steps current={step} />}
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
        {done ? `${client?.name} Is Set Up` : STEPS[step]}
      </h2>

      {step === 0 && !done && (
        <ClientForm
          mode="create"
          initial={{ name: "", slug: "", timezone: "America/New_York", brand_color: "", logo_url: "" }}
          submitLabel="Create client and continue"
          busy={create.isPending}
          error={error}
          onSubmit={(values) => { setError(null); create.mutate(values) }}
        />
      )}

      {step === 1 && client && !done && (
        <div className="flex flex-col gap-4">
          <p className="max-w-prose text-sm text-muted-foreground">
            Search your Tavus account for {client.name}'s avatars and tick the ones that belong to them. Linking tells Tavus to report each call to this app. Nothing else about the avatar changes.
          </p>
          <AvatarPicker clientId={client.id} clientName={client.name} initialQuery={client.name.split(/\s+/)[0]} onLinked={(n) => setLinked((v) => v + n)} />
          <div>
            <Button variant={linked ? "default" : "outline"} className="min-h-11" onClick={() => setStep(2)}>
              {linked ? "Continue" : "Skip for now"}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && client && !done && <InviteStep client={client} onDone={setInvited} />}

      {done && client && (
        <div className="flex max-w-xl flex-col gap-4">
          <ul className="flex flex-col gap-2 text-sm">
            <li>Client created, with the portal address <span className="font-mono">/c/{client.slug}</span>.</li>
            <li>{linked ? `${linked} avatar${linked === 1 ? "" : "s"} linked.` : "No avatars linked yet. You can link them from the client's page."}</li>
            <li>{invited ? `Invite sent to ${invited}.` : "Nobody invited yet. You can invite people from the client's page."}</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-11"><Link to={`/admin/clients/${client.slug}`}>Open {client.name}</Link></Button>
            <Button asChild variant="outline" className="min-h-11"><Link to={`/c/${client.slug}`}>See what the client sees</Link></Button>
          </div>
        </div>
      )}
    </>
  )
}
