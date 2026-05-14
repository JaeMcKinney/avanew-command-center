import { useEffect, useState } from "react"
import { Download, X, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getDocumentUrl } from "@/lib/data"
import type { DocumentRecord } from "@/types/db"

interface Props {
  doc: DocumentRecord | null
  onClose: () => void
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function canPreview(mimeType: string | null): boolean {
  if (!mimeType) return false
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  )
}

function PreviewContent({
  url,
  mimeType,
  fileName,
}: {
  url: string
  mimeType: string | null
  fileName: string
}) {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)

  useEffect(() => {
    if (
      mimeType?.startsWith("text/") ||
      mimeType === "application/json"
    ) {
      setTextLoading(true)
      fetch(url)
        .then((r) => r.text())
        .then((t) => setTextContent(t))
        .catch(() => setTextContent("(Unable to load file content)"))
        .finally(() => setTextLoading(false))
    }
  }, [url, mimeType])

  if (mimeType?.startsWith("image/")) {
    return (
      <div className="flex items-center justify-center w-full h-full p-4 min-h-0">
        <img
          src={url}
          alt={fileName}
          className="max-w-full max-h-full object-contain rounded"
        />
      </div>
    )
  }

  if (mimeType?.startsWith("video/")) {
    return (
      <div className="flex items-center justify-center w-full h-full p-4 min-h-0">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={url}
          controls
          className="max-w-full max-h-full rounded"
          style={{ maxHeight: "calc(80vh - 100px)" }}
        />
      </div>
    )
  }

  if (mimeType?.startsWith("audio/")) {
    return (
      <div className="flex items-center justify-center w-full h-full p-8">
        <div className="w-full max-w-lg space-y-4">
          <div className="flex items-center justify-center h-24 rounded-lg bg-muted">
            <FileText className="h-10 w-10 text-muted-foreground/50" />
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls className="w-full" />
        </div>
      </div>
    )
  }

  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={url}
        title={fileName}
        className="w-full h-full border-0 min-h-0"
        style={{ height: "calc(80vh - 72px)" }}
      />
    )
  }

  if (mimeType?.startsWith("text/") || mimeType === "application/json") {
    if (textLoading) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )
    }
    return (
      <div className="w-full h-full overflow-auto p-4 min-h-0">
        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground/80 leading-relaxed">
          {textContent ?? ""}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-3 p-8 text-center">
      <FileText className="h-12 w-12 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">
        Preview not available for this file type
      </p>
      <p className="text-xs text-muted-foreground/60">{mimeType ?? "Unknown type"}</p>
    </div>
  )
}

export function DocumentPreviewDialog({ doc, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!doc) { setUrl(null); return }
    setLoading(true)
    setUrl(null)
    getDocumentUrl(doc.storage_path)
      .then(setUrl)
      .catch(() => setUrl(null))
      .finally(() => setLoading(false))
  }, [doc])

  function handleDownload() {
    if (!url || !doc) return
    const a = document.createElement("a")
    a.href = url
    a.download = doc.file_name
    a.target = "_blank"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const previewable = canPreview(doc?.mime_type ?? null)

  return (
    <Dialog open={!!doc} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="max-w-4xl w-full p-0 gap-0 overflow-hidden flex flex-col"
        style={{ height: "80vh" }}
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between gap-3 px-4 py-3 border-b shrink-0">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm font-semibold truncate pr-2">
              {doc?.file_name ?? ""}
            </DialogTitle>
            {doc && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtBytes(doc.file_size)}
                {doc.mime_type ? ` · ${doc.mime_type}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={!url}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-auto min-h-0 bg-muted/30">
          {loading && (
            <div className="flex items-center justify-center w-full h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && url && doc && (
            previewable ? (
              <PreviewContent
                url={url}
                mimeType={doc.mime_type}
                fileName={doc.file_name}
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full gap-3 p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  Preview not available for this file type
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {doc.mime_type ?? "Unknown type"}
                </p>
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" />
                  Download to view
                </Button>
              </div>
            )
          )}
          {!loading && !url && doc && (
            <div className="flex items-center justify-center w-full h-full">
              <p className="text-sm text-muted-foreground">Failed to load preview</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
