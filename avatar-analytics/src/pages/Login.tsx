import { useState } from "react"
import { Navigate } from "react-router-dom"
import { LoadingBlock } from "@/components/States"
import { BrandLogo } from "@/components/Shell"
import { VoiceWaves } from "@/components/MotionBackdrop"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { company, useBrand } from "@/lib/brand"
import { supabase } from "@/lib/supabase"

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  useDocumentTitle(title)
  const { motion } = useBrand()
  return (
    // The sign-in page always wears the dark look, whatever the device setting.
    <div className="dark site-backdrop relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10 text-foreground">
      {motion && <VoiceWaves />}
      <main id="main" className="relative flex w-full max-w-sm flex-col gap-6 rounded-lg border bg-card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandLogo on="dark" className="h-20" />
          <p className="indent-[0.18em] text-xs font-medium tracking-[0.18em] text-balance text-muted-foreground uppercase">Avalytics</p>
        </div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </main>
    </div>
  )
}

export default function Login() {
  const { loading, session, access, signOut } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (loading) return <LoadingBlock />
  if (session && access) return <Navigate to="/" replace />

  // Signed in, but no active profile: an old login, or a deactivated account.
  if (session && !access) {
    return (
      <AuthCard title="No Access">
        <p role="alert" className="text-sm">
          This account is signed in but does not have access to Avalytics. It may have been deactivated. Ask your {company()} contact for help.
        </p>
        <Button variant="outline" className="min-h-11" onClick={() => void signOut()}>Sign out</Button>
      </AuthCard>
    )
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (signInError) setError("That email and password do not match. Check them and try again.")
  }

  async function sendReset() {
    setError(null)
    setNotice(null)
    if (!email.trim()) return setError("Enter your email first, then choose “Forgot your password?”")
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/accept-invite` })
    setNotice("If that email has an account, a link to set a new password is on its way.")
  }

  return (
    <AuthCard title="Sign In">
      <form onSubmit={signIn} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11" aria-describedby={error ? "login-error" : undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-11" aria-describedby={error ? "login-error" : undefined} />
        </div>
        {error && <p id="login-error" role="alert" className="text-sm text-bad">{error}</p>}
        {notice && <p role="status" className="text-sm text-ok">{notice}</p>}
        <Button type="submit" disabled={busy} className="min-h-11">{busy ? "Signing in…" : "Sign in"}</Button>
        <Button type="button" variant="link" className="min-h-10 self-start px-0" onClick={() => void sendReset()}>
          Forgot your password?
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">Accounts are by invitation. Ask your {company()} contact if you need one.</p>
    </AuthCard>
  )
}
