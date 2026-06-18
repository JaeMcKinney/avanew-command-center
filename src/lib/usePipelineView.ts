import { useEffect, useState } from "react"

export type PipelineView = "list" | "board"
const LS_PREFIX = "avanew-crm.pipeline-view."

export function usePipelineView(scope: string, fallback: PipelineView = "list"): [PipelineView, (v: PipelineView) => void] {
  const key = LS_PREFIX + scope
  const [view, setView] = useState<PipelineView>(() => {
    if (typeof localStorage === "undefined") return fallback
    const raw = localStorage.getItem(key)
    return raw === "list" || raw === "board" ? raw : fallback
  })
  useEffect(() => {
    if (typeof localStorage === "undefined") return
    try { localStorage.setItem(key, view) } catch { /* ignore */ }
  }, [key, view])
  return [view, setView]
}
