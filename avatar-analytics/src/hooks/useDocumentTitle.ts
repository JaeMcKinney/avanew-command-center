import { useEffect } from "react"

/** Names the page in the browser tab and history. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Avalytics` : "Avalytics"
  }, [title])
}
