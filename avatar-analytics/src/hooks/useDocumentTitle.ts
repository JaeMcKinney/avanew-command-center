import { useEffect } from "react"
import { company } from "@/lib/brand"

/** Names the page in the browser tab and history. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    const app = `Avalytics by ${company()}`
    document.title = title ? `${title} · ${app}` : app
  }, [title])
}
