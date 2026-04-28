import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"

export type AVEStatus = "idle" | "starting" | "active" | "ending" | "error"

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"

export function useAVE() {
  const [status, setStatus] = useState<AVEStatus>("idle")
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationUrl, setConversationUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (status === "active") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (status === "idle") setElapsed(0)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status])

  const start = useCallback(async (context: string) => {
    setStatus("starting")
    setErrorMsg(null)
    try {
      if (PREVIEW_MODE) {
        await new Promise((r) => setTimeout(r, 1400))
        setConversationId("preview-ave-session")
        setConversationUrl(null)
        setElapsed(0)
        setStatus("active")
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error: fnError } = await supabase.functions.invoke("ave-session", {
        body: { action: "start", context },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      })
      if (fnError) throw fnError
      setConversationId(data.conversation_id)
      setConversationUrl(data.conversation_url)
      setElapsed(0)
      setStatus("active")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect to AVE")
      setStatus("error")
    }
  }, [])

  const end = useCallback(async () => {
    if (!conversationId) { setStatus("idle"); return }
    setStatus("ending")
    try {
      if (!PREVIEW_MODE) {
        const { data: { session } } = await supabase.auth.getSession()
        await supabase.functions.invoke("ave-session", {
          body: { action: "end", conversation_id: conversationId },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        })
      }
    } catch {
      // Silently ignore — Tavus will timeout the session
    } finally {
      setConversationId(null)
      setConversationUrl(null)
      setStatus("idle")
    }
  }, [conversationId])

  return { status, conversationUrl, errorMsg, elapsed, start, end }
}
