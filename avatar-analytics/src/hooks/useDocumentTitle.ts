import { useEffect } from "react"
import { COMPANY } from "@/lib/edition"

const APP = `Avalytics by ${COMPANY}`

/** Names the page in the browser tab and history. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP
  }, [title])
}
