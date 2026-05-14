import { useCallback, useEffect, useRef, useState } from "react"
import {
  Upload,
  FileText,
  Trash2,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  FileVideo,
  FileAudio,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
} from "@/lib/data"
import type { DocumentRecord, EntityType } from "@/types/db"
import { supabase } from "@/lib/supabase"

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso))
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File
  if (mimeType.startsWith("image/")) return FileImage
  if (mimeType.startsWith("video/")) return FileVideo
  if (mimeType.startsWith("audio/")) return FileAudio
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  ) return FileSpreadsheet
  if (
    mimeType.includes("zip") ||
    mimeType.includes("x-tar") ||
    mimeType.includes("gzip") ||
    mimeType.includes("x-rar")
  ) return FileArchive
  if (
    mimeType.includes("javascript") ||
    mimeType.includes("json") ||
    mimeType.includes("html") ||
    mimeType.includes("css") ||
    mimeType.includes("xml")
  ) return FileCode
  return FileText
}

interface Props {
  entityType: EntityType
  entityId: string
}

export function DocumentsSection({ entityType, entityId }: Props) {
  const [docs, setDocs] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listDocuments(entityType, entityId)
      setDocs(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load documents")
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => { void load() }, [load])

  async function handleUpload(files: FileList) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUploading(true)
    const count = files.length
    try {
      for (let i = 0; i < count; i++) {
        const file = files[i]
        setUploadProgress(
          count > 1
            ? `Uploading ${file.name} (${i + 1} of ${count})…`
            : `Uploading ${file.name}…`
        )
        await uploadDocument(entityType, entityId, file, user.id)
      }
      toast.success(count === 1 ? "Document uploaded" : `${count} documents uploaded`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      setUploadProgress(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleDelete(doc: DocumentRecord) {
    if (!window.confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
    try {
      await deleteDocument(doc.id, doc.storage_path)
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      toast.success("Document deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  async function handleDownload(doc: DocumentRecord) {
    try {
      const url = await getDocumentUrl(doc.storage_path)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.file_name
      a.target = "_blank"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Documents
          {!loading && (
            <span className="text-muted-foreground font-normal text-xs">
              ({docs.length})
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {uploadProgress && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {uploadProgress}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void handleUpload(e.target.files)
            }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : docs.length === 0 ? (
          <div
            className="mx-4 mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 py-12 cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              Drop files here or click Upload
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              All file types supported · Up to 1 GB per file
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Size</TableHead>
                  <TableHead className="hidden md:table-cell">Uploaded by</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="pr-4 w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => {
                  const Icon = getFileIcon(doc.mime_type)
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium max-w-[160px] sm:max-w-[260px] md:max-w-[360px]">
                            {doc.file_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                        {fmtBytes(doc.file_size)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {doc.uploader_name ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm whitespace-nowrap">
                        {fmtDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => void handleDownload(doc)}
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive/60 hover:text-destructive"
                            onClick={() => void handleDelete(doc)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="border-t px-4 py-2.5 flex justify-end">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3 w-3" />
                Upload more files
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
