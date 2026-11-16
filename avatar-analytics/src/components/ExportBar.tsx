import { useQuery } from "@tanstack/react-query"
import { Cloud, Download, HardDrive, Link2, Mail, Share2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { loadExportItems, type Client, type Conversation } from "@/lib/api"
import { buildExportFile, type ExportFile } from "@/lib/exportFiles"
import {
  canShareFile, createLink, dropboxAvailable, emailToMe, exportOptions, googleDriveAvailable, saveToDropbox, saveToGoogleDrive, shareFile, uploadExport,
} from "@/lib/exportTargets"
import { count } from "@/lib/format"

type Action = "download" | "share" | "link" | "email" | "dropbox" | "drive"

/**
 * The actions for the transcripts a person has ticked: download (a PDF for
 * one, a ZIP for several), share, copy a private link, email to yourself,
 * Dropbox and Google Drive.
 */
export function ExportBar({ client, selected, nameOf, onClear }: {
  client: Client
  selected: Conversation[]
  nameOf: (avatarId: string) => string
  onClear: () => void
}) {
  const { access } = useAuth()
  const options = useQuery({ queryKey: ["export-options"], queryFn: exportOptions, staleTime: 600_000 })
  const [busy, setBusy] = useState<Action | null>(null)
  // The built file and its uploaded copy are kept while the selection stays the same,
  // so "download, then email it too" does not do the work twice.
  const key = selected.map((c) => c.conversation_id).sort().join(",")
  const [cache, setCache] = useState<{ key: string; file?: ExportFile; path?: string }>({ key })
  const current = cache.key === key ? cache : { key }

  const n = selected.length
  const what = n === 1 ? "transcript" : "transcripts"

  const build = async (): Promise<ExportFile> => {
    if (current.file) return current.file
    const items = await loadExportItems(selected)
    const file = await buildExportFile(client, items.map((item) => ({ ...item, avatarName: nameOf(item.conversation.avatar_id) })))
    setCache({ key, file })
    return file
  }
  const upload = async (file: ExportFile): Promise<string> => {
    if (current.path) return current.path
    if (!access) throw new Error("Your session has ended. Sign in again.")
    const path = await uploadExport(client.id, access.user_id, file)
    setCache({ key, file, path })
    return path
  }

  const run = async (action: Action) => {
    setBusy(action)
    try {
      const file = await build()
      const kind = file.type === "application/zip" ? `ZIP of ${count(file.count)} transcripts` : "transcript PDF"
      if (action === "download") {
        const { saveFile } = await import("@/lib/pdf")
        saveFile(file.bytes, file.filename, file.type)
        toast.success(`Downloaded the ${kind}`)
      } else if (action === "share") {
        if (await shareFile(file, `Transcripts from ${client.name}`)) toast.success("Shared")
      } else if (action === "link") {
        const link = await createLink(await upload(file))
        await navigator.clipboard.writeText(link.url)
        toast.success(`Private link copied. It works for ${options.data?.link_days ?? 7} days.`)
      } else if (action === "email") {
        const link = await emailToMe(await upload(file))
        toast.success(`Sent to ${link.emailed_to}`)
      } else if (action === "dropbox") {
        const link = await createLink(await upload(file))
        if ((await saveToDropbox(link.url, file.filename)) === "saved") toast.success("Saved to Dropbox")
      } else {
        if ((await saveToGoogleDrive(file)) === "saved") toast.success("Saved to Google Drive")
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // Whether the device has its own share sheet is only known once there is a file to offer it.
  const shareable = typeof navigator.share === "function" && (!current.file || canShareFile(current.file))
  const button = (action: Action, label: string, icon: React.ReactNode, working: string, variant: "default" | "outline" = "outline") => (
    <Button variant={variant} className="min-h-10" disabled={busy !== null} onClick={() => void run(action)}>
      {icon}{busy === action ? working : label}
    </Button>
  )

  return (
    <section aria-label="Export selected transcripts" className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-lg sm:bottom-4 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm">
          <strong>{count(n)}</strong> {what} selected. {n === 1 ? "It downloads as a PDF." : "They download together as one ZIP file, with a PDF for each conversation."}
        </p>
        <Button variant="ghost" className="min-h-10" disabled={busy !== null} onClick={onClear}><X aria-hidden="true" />Clear selection</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {button("download", n === 1 ? "Download PDF" : "Download ZIP", <Download aria-hidden="true" />, "Preparing…", "default")}
        {shareable && button("share", "Share", <Share2 aria-hidden="true" />, "Preparing…")}
        {options.data?.email && button("email", "Email to me", <Mail aria-hidden="true" />, "Sending…")}
        {button("link", "Copy private link", <Link2 aria-hidden="true" />, "Preparing…")}
        {dropboxAvailable && button("dropbox", "Save to Dropbox", <Cloud aria-hidden="true" />, "Opening Dropbox…")}
        {googleDriveAvailable && button("drive", "Save to Google Drive", <HardDrive aria-hidden="true" />, "Opening Google…")}
      </div>
    </section>
  )
}
