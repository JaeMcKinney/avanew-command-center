import { useRef } from "react"
import { Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type QueuedFile = { file: File; description: string }

interface DocumentQueueInputProps {
  files: QueuedFile[]
  onChange: (files: QueuedFile[]) => void
}

export function DocumentQueueInput({ files, onChange }: DocumentQueueInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    const added = Array.from(incoming).map((f) => ({ file: f, description: "" }))
    onChange([...files, ...added])
  }

  function remove(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  function setDescription(index: number, value: string) {
    const next = files.map((f, i) => i === index ? { ...f, description: value } : f)
    onChange(next)
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
      >
        <Paperclip className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drop files here or <span className="text-primary font-medium">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Files will upload when you save</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((qf, i) => (
            <li key={i} className="rounded-md border bg-muted/30 px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{qf.file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(qf.file.size)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => remove(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Input
                className="h-7 text-xs"
                placeholder="Description (optional)"
                value={qf.description}
                onChange={(e) => setDescription(i, e.target.value)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
