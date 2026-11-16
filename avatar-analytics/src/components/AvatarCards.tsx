// A client's linked avatars: photo, whether Tavus is reporting their calls,
// and the embed code for each deployment.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { toast } from "sonner"
import { AvatarPhoto } from "@/components/AvatarPhoto"
import { EmbedCode } from "@/components/EmbedCode"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { WebhookStatusPill } from "@/components/StatusPill"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { listAvatars, listDeployments, renameAvatar, retryWebhook, unlinkAvatar, type Avatar } from "@/lib/api"
import { timeAgo } from "@/lib/dates"

function RenameDialog({ avatar, onClose }: { avatar: Avatar; onClose: () => void }) {
  const id = useId()
  const queryClient = useQueryClient()
  const [name, setName] = useState(avatar.display_name)
  const [role, setRole] = useState(avatar.role_label ?? "")
  const save = useMutation({
    mutationFn: () => renameAvatar(avatar.id, { display_name: name.trim(), role_label: role.trim() || null }),
    onSuccess: () => {
      toast.success("Avatar updated.")
      void queryClient.invalidateQueries({ queryKey: ["avatars"] })
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit avatar</DialogTitle>
          <DialogDescription>This changes how the avatar is shown here. It does not change anything in Tavus.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate() }}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>Name shown to the client</Label>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} className="min-h-10" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-role`}>What it does (optional)</Label>
            <Input id={`${id}-role`} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Leasing concierge" className="min-h-10" />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" className="min-h-10" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={`${id}-form`} className="min-h-10" disabled={save.isPending || !name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AvatarCards({ clientId, manage, showEmbeds, empty }: { clientId: string; manage: boolean; showEmbeds: boolean; empty?: React.ReactNode }) {
  const queryClient = useQueryClient()
  const avatars = useQuery({ queryKey: ["avatars", clientId], queryFn: () => listAvatars(clientId) })
  const palIds = (avatars.data ?? []).map((a) => a.tavus_pal_id)
  const deployments = useQuery({ queryKey: ["deployments", clientId, palIds.join(",")], queryFn: () => listDeployments(palIds), enabled: showEmbeds && palIds.length > 0 })
  const [renaming, setRenaming] = useState<Avatar | null>(null)
  const [unlinking, setUnlinking] = useState<Avatar | null>(null)

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["avatars"] })
  const retry = useMutation({
    mutationFn: (avatarId: string) => retryWebhook(avatarId),
    onSuccess: () => { toast.success("Connected. Tavus will now report this avatar's calls."); refresh() },
    onError: (err: Error) => toast.error(err.message),
  })
  const unlink = useMutation({
    mutationFn: (avatarId: string) => unlinkAvatar(avatarId),
    onSuccess: (res) => {
      if (res.warning) toast.warning(res.warning)
      else toast.success("Avatar unlinked. Its past usage stays with this client.")
      setUnlinking(null)
      refresh()
      void queryClient.invalidateQueries({ queryKey: ["pal-search"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (avatars.isPending) return <LoadingBlock label="Loading avatars" />
  if (avatars.isError) return <ErrorBlock error={avatars.error} onRetry={() => void avatars.refetch()} />
  if (avatars.data.length === 0) return <>{empty ?? <EmptyState title="No avatars yet" />}</>

  return (
    <ul className="flex flex-col gap-4">
      {avatars.data.map((avatar) => {
        const own = (deployments.data ?? []).filter((d) => d.pal_id === avatar.tavus_pal_id)
        return (
          <li key={avatar.id} className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-4">
              <AvatarPhoto name={avatar.display_name} src={avatar.custom_photo_url ?? avatar.photo_url} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-semibold break-words">{avatar.display_name}</h3>
                {avatar.role_label && <p className="text-sm text-muted-foreground">{avatar.role_label}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <WebhookStatusPill status={avatar.webhook_status} />
                  {avatar.last_event_at && <span>Last call reported {timeAgo(avatar.last_event_at)}</span>}
                </div>
              </div>
              {manage && (
                <div className="flex flex-wrap gap-2">
                  {avatar.webhook_status === "error" && (
                    <Button size="sm" className="min-h-9" disabled={retry.isPending} onClick={() => retry.mutate(avatar.id)}>Connect again</Button>
                  )}
                  <Button variant="outline" size="sm" className="min-h-9" aria-label={`Edit ${avatar.display_name}`} onClick={() => setRenaming(avatar)}>Edit</Button>
                  <Button variant="outline" size="sm" className="min-h-9" aria-label={`Unlink ${avatar.display_name}`} onClick={() => setUnlinking(avatar)}>Unlink</Button>
                </div>
              )}
            </div>
            {manage && avatar.webhook_status === "error" && avatar.webhook_error && (
              <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm">
                Tavus is not reporting this avatar's calls yet, so its talk time is not being counted. {avatar.webhook_error}
              </p>
            )}
            {showEmbeds && (
              <div className="flex flex-col gap-3">
                {deployments.isPending ? (
                  <LoadingBlock label="Loading embed codes" />
                ) : own.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This avatar has no deployment yet. Create one in Tavus (embed, widget or landing page) and it will appear here after the next refresh.
                  </p>
                ) : (
                  own.map((d) => <EmbedCode key={d.deployment_id} deployment={d} />)
                )}
              </div>
            )}
          </li>
        )
      })}

      {renaming && <RenameDialog avatar={renaming} onClose={() => setRenaming(null)} />}
      <AlertDialog open={Boolean(unlinking)} onOpenChange={(open) => !open && setUnlinking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink {unlinking?.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              New calls to this avatar will stop being counted for this client. Talk time already recorded stays in their reports. The avatar itself is not changed or deleted in Tavus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-10">Keep it linked</AlertDialogCancel>
            <AlertDialogAction className="min-h-10" disabled={unlink.isPending} onClick={(e) => { e.preventDefault(); if (unlinking) unlink.mutate(unlinking.id) }}>
              {unlink.isPending ? "Unlinking…" : "Unlink avatar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ul>
  )
}
