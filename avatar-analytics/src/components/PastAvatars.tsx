// Avatars that used to be linked to a client. Their past calls and
// transcripts stay with the client; this is the record of them, and the way
// to link one back.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { History, Link2 } from "lucide-react"
import { toast } from "sonner"
import { AvatarPhoto } from "@/components/AvatarPhoto"
import { Button } from "@/components/ui/button"
import { linkAvatars, listAvatarsEver, usageByAvatar, type Avatar } from "@/lib/api"
import { browserToday, formatDay } from "@/lib/dates"
import { count, minutes } from "@/lib/format"

const day = (iso: string | null) => (iso ? formatDay(iso.slice(0, 10), true) : "an unknown date")

export function PastAvatars({ clientId, canLink }: { clientId: string; canLink: boolean }) {
  const queryClient = useQueryClient()
  const avatars = useQuery({ queryKey: ["avatars-ever", clientId], queryFn: () => listAvatarsEver(clientId) })
  const everything = { from: "2000-01-01", to: browserToday() }
  const usage = useQuery({ queryKey: ["usage-by-avatar", clientId, everything.from, everything.to], queryFn: () => usageByAvatar(clientId, everything) })

  const link = useMutation({
    mutationFn: async (avatar: Avatar) => (await linkAvatars(clientId, [avatar.tavus_pal_id]))[0],
    onSuccess: async (result, avatar) => {
      if (result?.status === "linked") toast.success(`${avatar.display_name} is linked again.`)
      else if (result?.status === "linked_webhook_error") toast.warning(`${avatar.display_name} is linked again, but Tavus could not be told to report its calls yet. Use Retry on its card.`)
      else if (result?.status === "callback_in_use") toast.error(`${avatar.display_name} now reports its calls somewhere else. Link it with “Link avatars” to choose whether to replace that.`)
      else if (result?.status === "already_linked") toast.error(`${avatar.display_name} is already linked to a client.`)
      else if (result?.status === "not_found") toast.error(`${avatar.display_name} is no longer in the Tavus account.`)
      else toast.error(result?.message ?? "The avatar could not be linked. Try again.")
      await queryClient.invalidateQueries({ queryKey: ["avatars"] })
      await queryClient.invalidateQueries({ queryKey: ["avatars-ever"] })
      await queryClient.invalidateQueries({ queryKey: ["pal-search"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const all = avatars.data ?? []
  const past = all.filter((a) => a.unlinked_at).sort((a, b) => (b.unlinked_at ?? "").localeCompare(a.unlinked_at ?? ""))
  if (past.length === 0) return null
  const linkedNow = new Set(all.filter((a) => !a.unlinked_at).map((a) => a.tavus_pal_id))

  return (
    <section aria-labelledby={`past-avatars-${clientId}`} className="flex flex-col gap-3">
      <div>
        <h3 id={`past-avatars-${clientId}`} className="flex items-center gap-2 font-sans text-base font-semibold"><History className="size-4" aria-hidden="true" />Previously Linked</h3>
        <p className="text-sm text-muted-foreground">Avatars that are no longer linked. Their past calls and transcripts are kept, and still count in the totals for the dates they took calls.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {past.map((a) => {
          const used = usage.data?.get(a.id)
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
              <AvatarPhoto name={a.display_name} src={a.custom_photo_url ?? a.photo_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{a.display_name}</p>
                <p className="text-sm text-muted-foreground">
                  Linked {day(a.linked_at)} · unlinked {day(a.unlinked_at)} · {minutes(used?.billable_seconds)} min in {count(used?.conversations)} conversations
                </p>
              </div>
              {linkedNow.has(a.tavus_pal_id) ? (
                <span className="text-sm text-muted-foreground">Linked again since</span>
              ) : canLink ? (
                <Button variant="outline" className="min-h-10" disabled={link.isPending} onClick={() => link.mutate(a)} aria-label={`Link ${a.display_name} again`}>
                  <Link2 aria-hidden="true" />
                  {link.isPending && link.variables?.id === a.id ? "Linking…" : "Link again"}
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
