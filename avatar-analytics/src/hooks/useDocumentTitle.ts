import { useEffect } from "react"

const APP = "Divigner Avatar Analytics"

/** Names the page in the browser tab and history. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP
  }, [title])
}
