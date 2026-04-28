import { useEffect, useState } from "react"
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Trophy,
  XCircle,
  Pencil,
  Check,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  createStage,
  deleteStage,
  listStages,
  reorderStages,
  updateStage,
} from "@/lib/data"
import type { PipelineStage } from "@/types/db"

export function StageManager({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<PipelineStage | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      setStages(await listStages())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load stages")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void refresh()
  }, [open])

  function notifyChange() {
    void refresh()
    onChanged()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      await createStage({ name })
      setNewName("")
      toast.success("Stage added")
      notifyChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add stage")
    }
  }

  function startEdit(s: PipelineStage) {
    setEditingId(s.id)
    setEditingName(s.name)
  }

  async function commitEdit() {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) {
      setEditingId(null)
      return
    }
    try {
      await updateStage(editingId, { name })
      setEditingId(null)
      toast.success("Stage renamed")
      notifyChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename")
    }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const next = [...stages]
    const swapWith = index + dir
    if (swapWith < 0 || swapWith >= next.length) return
    ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
    setStages(next)
    try {
      await reorderStages(next.map((s) => s.id))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder")
      void refresh()
    }
  }

  async function handleToggle(s: PipelineStage, key: "is_won" | "is_lost") {
    const next: Partial<PipelineStage> = { [key]: !s[key] }
    // Won and Lost are mutually exclusive
    if (key === "is_won" && next.is_won) next.is_lost = false
    if (key === "is_lost" && next.is_lost) next.is_won = false
    try {
      await updateStage(s.id, next)
      notifyChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stage")
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteStage(confirmDelete.id)
      setConfirmDelete(null)
      toast.success("Stage deleted")
      notifyChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Pipeline stages</SheetTitle>
          <SheetDescription>
            Customize the stages deals move through. Use the arrows to reorder.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            stages.map((s, i) => {
              const isEditing = editingId === s.id
              return (
                <div
                  key={s.id}
                  className="rounded-md border bg-card p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitEdit()
                            if (e.key === "Escape") setEditingId(null)
                          }}
                          className="h-8"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void commitEdit()}
                          aria-label="Save name"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 font-medium">{s.name}</span>
                        {s.is_won && (
                          <Badge variant="secondary" className="gap-1">
                            <Trophy className="h-3 w-3" />
                            Won
                          </Badge>
                        )}
                        {s.is_lost && (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Lost
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(s)}
                          aria-label="Rename"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => void handleMove(i, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => void handleMove(i, 1)}
                      disabled={i === stages.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <span className="ml-1">Position {s.position}</span>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={() => void handleToggle(s, "is_won")}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      {s.is_won ? "Unset won" : "Mark won"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={() => void handleToggle(s, "is_lost")}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {s.is_lost ? "Unset lost" : "Mark lost"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(s)}
                      aria-label="Delete stage"
                      disabled={stages.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <form onSubmit={handleAdd} className="border-t p-4 flex gap-2">
          <Input
            placeholder="New stage name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>

        <AlertDialog
          open={Boolean(confirmDelete)}
          onOpenChange={(open) => !open && setConfirmDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this stage?</AlertDialogTitle>
              <AlertDialogDescription>
                "{confirmDelete?.name}" will be removed. Any deals in it will
                move to the first stage.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
