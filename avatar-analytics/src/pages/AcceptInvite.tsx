import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { LoadingBlock } from "@/components/States"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import { AuthCard } from "@/pages/Login"

const MIN_LENGTH = 10

/** Where invite and password-reset emails land. The link signs the person in; here they choose a password. */
export default function AcceptInvite() {
  const { loading, session, access } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <LoadingBlock />

  if (!session) {
    return (
      <AuthCard title="This link no longer works">
        <p className="text-sm">The link may have expired or already been used. Ask the person who invited you to send a new one, or go to sign in.</p>
        <Button className="min-h-11" onClick={() => navigate("/login")}>Go to sign in</Button>
      </AuthCard>
    )
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`)
    if (password !== confirm) return setError("The two passwords do not match.")
    setError(null)
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) return setError(updateError.message)
    navigate("/", { replace: true })
  }

  return (
    <AuthCard title="Choose a password">
      <p className="text-sm text-muted-foreground">
        {access?.full_name ? `Welcome, ${access.full_name}. ` : "Welcome. "}Choose a password to finish setting up your account.
      </p>
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-11" aria-describedby="password-hint" />
          <p id="password-hint" className="text-xs text-muted-foreground">At least {MIN_LENGTH} characters.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">Type it again</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="min-h-11" />
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Button type="submit" disabled={busy} className="min-h-11">{busy ? "Saving…" : "Save and continue"}</Button>
      </form>
    </AuthCard>
  )
}
