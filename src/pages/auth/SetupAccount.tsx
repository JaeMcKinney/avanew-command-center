import { useState, useEffect } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

export function SetupAccount() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Token may already be exchanged if the page loaded with a hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setFullName(session.user.user_metadata?.full_name ?? "")
        setReady(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          setFullName(session.user.user_metadata?.full_name ?? "")
          setReady(true)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error("Passwords do not match")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({
      password,
      data: fullName.trim() ? { full_name: fullName.trim() } : undefined,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Account set up — welcome to Avanew!")
    navigate("/dashboard", { replace: true })
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
            Verifying invite link…
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Set up your account</CardTitle>
          <CardDescription>
            Confirm your name and choose a password to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Setting up…" : "Get started"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
