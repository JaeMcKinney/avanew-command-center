// Find avatars in the Tavus account by name and link them to a client.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, Search } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { AvatarPhoto } from "@/components/AvatarPhoto"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { lastSyncRun, linkAvatars, searchPals, syncTavus, type LinkResult, type PalSearchHit } from "@/lib/api"
import { timeAgo } from "@/lib/dates"

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function TavusSyncStatus() {
  const queryClient = useQueryClient()
  const run = useQuery({ queryKey: ["tavus-sync-run"], queryFn: lastSyncRun })
  const sync = useMutation({
    mutationFn: syncTavus,
    onSuccess: (res) => {
      toast.success(`Tavus list refreshed: ${res.pals} avatars, ${res.deployments} deployments.`)
      void queryClient.invalidateQueries()
    },
    onError: (err: Error) => {
      toast.error(err.message)
      void queryClient.invalidateQueries({ queryKey: ["tavus-sync-run"] })
    },
  })
  const last = run.data
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span role="status">
        {!last
          ? "The Tavus list has not been loaded yet."
          : last.status === "ok"
            ? `Tavus list refreshed ${timeAgo(last.finished_at)} · ${last.pals_count} avatars`
            : last.status === "error"
              ? `Last refresh failed ${timeAgo(last.started_at)}: ${last.error}`
              : "Refreshing…"}
      </span>
      <Button variant="outline" size="sm" className="min-h-9" disabled={sync.isPending} onClick={() => sync.mutate()}>
        <RefreshCw className={sync.isPending ? "animate-spin" : undefined} aria-hidden="true" />
        {sync.isPending ? "Refreshing…" : "Refresh from Tavus"}
      </Button>
    </div>
  )
}

function channelsSummary(hit: PalSearchHit): string {
  if (!hit.deployments.length) return "No deployments yet"
  const sites = [...new Set(hit.deployments.flatMap((d) => d.allowed_origins.map((o) => o.replace(/^https?:\/\/(www\.)?/, ""))))]
  const n = hit.deployments.length
  return `${n} deployment${n === 1 ? "" : "s"} (${[...new Set(hit.deployments.map((d) => d.channel))].join(", ")})${sites.length ? ` · ${sites.slice(0, 2).join(", ")}` : ""}`
}

export function AvatarPicker({
  clientId,
  clientName,
  initialQuery = "",
  onLinked,
}: {
  clientId: string
  clientName: string
  initialQuery?: string
  onLinked?: (linked: number) => void
}) {
  const id = useId()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(initialQuery)
  const debounced = useDebounced(query, 250)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [needsConfirm, setNeedsConfirm] = useState<LinkResult[]>([])
  const [problems, setProblems] = useState<LinkResult[]>([])

  const results = useQuery({ queryKey: ["pal-search", debounced], queryFn: () => searchPals(debounced), placeholderData: (prev) => prev })

  const link = useMutation({
    mutationFn: ({ palIds, replace }: { palIds: string[]; replace: boolean }) => linkAvatars(clientId, palIds, replace),
    onSuccess: (res) => {
      const linked = res.filter((r) => r.status === "linked" || r.status === "linked_webhook_error")
      setNeedsConfirm(res.filter((r) => r.status === "callback_in_use"))
      setProblems(res.filter((r) => !["linked", "callback_in_use"].includes(r.status)))
      setSelected(new Set())
      if (linked.length) {
        toast.success(`Linked ${linked.length} avatar${linked.length === 1 ? "" : "s"} to ${clientName}.`)
        onLinked?.(linked.length)
      }
      void queryClient.invalidateQueries({ queryKey: ["pal-search"] })
      void queryClient.invalidateQueries({ queryKey: ["avatars"] })
      void queryClient.invalidateQueries({ queryKey: ["deployments"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const hits = results.data ?? []
  const nameOf = (palId: string) => hits.find((h) => h.pal_id === palId)?.name ?? palId

  function toggle(palId: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(palId)
      else next.delete(palId)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-search`}>Search your Tavus avatars</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${id}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Part of a name or website, for example “northline”"
            className="min-h-11 pl-9"
            aria-describedby={`${id}-count`}
            autoComplete="off"
          />
        </div>
        <TavusSyncStatus />
      </div>

      {needsConfirm.length > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-warn/50 bg-warn-soft p-4 text-sm">
          <p className="font-semibold">
            {needsConfirm.length === 1 ? "This avatar already reports" : "These avatars already report"} calls somewhere else
          </p>
          <ul className="list-disc pl-5">
            {needsConfirm.map((r) => (
              <li key={r.pal_id}>
                <strong>{nameOf(r.pal_id)}</strong> sends its call events to {r.existing_callback_host}.
              </li>
            ))}
          </ul>
          <p>Tavus can only send them to one place. Linking will send them here instead, and the other system will stop receiving them. The old address is saved and restored if you unlink.</p>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-10" disabled={link.isPending} onClick={() => link.mutate({ palIds: needsConfirm.map((r) => r.pal_id), replace: true })}>
              Link and send calls here
            </Button>
            <Button variant="outline" className="min-h-10" onClick={() => setNeedsConfirm([])}>Leave unlinked</Button>
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <div role="alert" className="rounded-lg border border-bad/40 bg-bad-soft p-4 text-sm">
          <p className="font-semibold">Some avatars need attention</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((r) => (
              <li key={r.pal_id}>
                <strong>{nameOf(r.pal_id)}</strong>: {r.status === "linked_webhook_error" ? `linked, but Tavus could not be set up to report its calls. ${r.message}` : r.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p id={`${id}-count`} role="status" className="text-sm text-muted-foreground">
        {results.isPending ? "Searching…" : `${hits.length} avatar${hits.length === 1 ? "" : "s"} found${debounced ? ` for “${debounced}”` : ""}`}
      </p>

      {results.isPending ? (
        <LoadingBlock label="Searching Tavus avatars" />
      ) : results.isError ? (
        <ErrorBlock error={results.error} onRetry={() => void results.refetch()} />
      ) : hits.length === 0 ? (
        <EmptyState title="No avatars match">
          Try a shorter word, or refresh the list from Tavus if the avatar was created in the last few minutes.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {hits.map((hit) => {
            const taken = Boolean(hit.linked_avatar_id)
            const checkboxId = `${id}-${hit.pal_id}`
            return (
              <li key={hit.pal_id} className="flex items-center gap-3 rounded-lg border bg-card p-3 has-[:checked]:border-primary has-[[data-state=checked]]:border-primary">
                <AvatarPhoto name={hit.name || hit.pal_id} src={hit.thumbnail_image_url} size="sm" />
                <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block font-medium break-words">{hit.name || "(no name)"}</span>
                  <span className="block text-xs break-words text-muted-foreground">
                    {taken ? `Already linked to ${hit.linked_client_name}` : channelsSummary(hit)}
                  </span>
                </label>
                <Checkbox
                  id={checkboxId}
                  className="size-5"
                  disabled={taken}
                  checked={selected.has(hit.pal_id)}
                  onCheckedChange={(on) => toggle(hit.pal_id, on === true)}
                />
              </li>
            )
          })}
        </ul>
      )}

      <div className="sticky bottom-16 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm md:bottom-0">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {selected.size === 0 ? "Tick the avatars that belong to this client." : `${selected.size} selected`}
        </p>
        <Button className="min-h-11" disabled={selected.size === 0 || link.isPending} onClick={() => link.mutate({ palIds: [...selected], replace: false })}>
          {link.isPending ? "Linking…" : selected.size > 1 ? `Link ${selected.size} avatars` : "Link avatar"}
        </Button>
      </div>
    </div>
  )
}
