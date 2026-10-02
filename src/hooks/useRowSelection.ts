import { useCallback, useMemo, useState } from "react"

/**
 * Generic row-selection hook for list pages that support bulk actions.
 *
 * `visibleIds` is the current page/filter slice: "select all" toggles only
 * those IDs so a filtered view doesn't accidentally bulk-delete hidden rows.
 */
export function useRowSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allOn = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id))
      if (allOn) {
        const next = new Set(prev)
        visibleIds.forEach((id) => next.delete(id))
        return next
      }
      const next = new Set(prev)
      visibleIds.forEach((id) => next.add(id))
      return next
    })
  }, [visibleIds])

  const clear = useCallback(() => setSelected(new Set()), [])

  const isAllSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selected.has(id)),
    [visibleIds, selected],
  )
  const isSomeSelected = useMemo(
    () => visibleIds.some((id) => selected.has(id)) && !isAllSelected,
    [visibleIds, selected, isAllSelected],
  )

  return {
    selected,
    selectedIds: Array.from(selected),
    count: selected.size,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAll,
    clear,
    isAllSelected,
    isSomeSelected,
  }
}
