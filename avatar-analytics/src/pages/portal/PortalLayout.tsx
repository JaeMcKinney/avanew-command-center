import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, CircleHelp, Code2, CreditCard, LayoutDashboard, MessagesSquare, Users } from "lucide-react"
import { Link, Outlet, useOutletContext, useParams } from "react-router-dom"
import { PortalShell, type NavItem } from "@/components/Shell"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { getClientBySlug, type Client } from "@/lib/api"
import { isHexColor, readableOn } from "@/lib/color"

// eslint-disable-next-line react-refresh/only-export-components
export function usePortalClient(): Client {
  return useOutletContext<Client>()
}

/** The client's own space: their branding, and only their data. */
export default function PortalLayout() {
  const { slug = "" } = useParams()
  const { access, can, signOut } = useAuth()
  const client = useQuery({ queryKey: ["client", slug], queryFn: () => getClientBySlug(slug) })

  if (client.isPending) return <LoadingBlock label="Loading" />
  if (client.isError) return <div className="p-6"><ErrorBlock error={client.error} onRetry={() => void client.refetch()} /></div>
  if (!client.data) {
    return (
      <main id="main" className="mx-auto max-w-lg p-6 pt-16">
        <EmptyState
          title="This Page Is Not Available"
          action={<div className="flex gap-2"><Button asChild><Link to="/">Go to your home page</Link></Button><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></div>}
        >
          The address may be wrong, or your account does not have access to it.
        </EmptyState>
      </main>
    )
  }

  const c = client.data
  const base = `/c/${c.slug}`
  const items: NavItem[] = [
    { to: base, label: "Dashboard", icon: LayoutDashboard, end: true },
    ...(can("transcripts.view") ? [{ to: `${base}/conversations`, label: "Conversations", icon: MessagesSquare }] : []),
    ...(can("transcripts.view") || can("questions.answer") ? [{ to: `${base}/questions`, label: "Questions", icon: CircleHelp }] : []),
    ...(can("embeds.view") ? [{ to: `${base}/avatars`, label: "Avatars", icon: Code2 }] : []),
    ...(can("client_users.manage") ? [{ to: `${base}/team`, label: "Team", icon: Users }] : []),
    ...(can("billing.view") ? [{ to: `${base}/billing`, label: "Billing", icon: CreditCard }] : []),
  ]
  const brand = c.brand_color && isHexColor(c.brand_color) ? c.brand_color : null
  const style = brand ? ({ "--brand": brand, "--brand-foreground": readableOn(brand) } as React.CSSProperties) : undefined

  return (
    <div style={style}>
      <PortalShell
        clientName={c.name}
        logoUrl={c.logo_url}
        items={items}
        banner={
          <>
            {(c.status === "paused" || c.status === "cancelled") && (
              <div role="status" className="border-b bg-warn-soft text-warn">
                <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm sm:px-6">
                  <p>
                    <strong>{c.status === "paused" ? "Your avatars are paused." : "Your subscription has ended."}</strong>{" "}
                    {c.status === "paused" ? "They are not taking new calls right now." : "Your avatars are not taking calls."}
                  </p>
                  {can("billing.view") && <Link to={`${base}/billing`} className="inline-flex min-h-8 items-center font-semibold underline">{c.status === "paused" ? "Add minutes or see billing" : "See billing"}</Link>}
                </div>
              </div>
            )}
            {access?.side === "divigner" && (
            <div className="bg-sidebar text-sidebar-foreground">
              <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm sm:px-6">
                <p>You are seeing what <strong>{c.name}</strong> sees.</p>
                <Link to={`/admin/clients/${c.slug}`} className="inline-flex min-h-8 items-center gap-1 underline">
                  <ArrowLeft className="size-4" aria-hidden="true" />Back to admin
                </Link>
              </div>
            </div>
          )}
          </>
        }
      >
        <Outlet context={c} />
      </PortalShell>
    </div>
  )
}
