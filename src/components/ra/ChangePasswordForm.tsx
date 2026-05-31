import { useState } from "react"
import type { FormEvent } from "react"
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length < 8) return { level: 0, label: "Too short", color: "text-muted-foreground" }
  let score = 0
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { level: 1, label: "Weak", color: "text-red-500" }
  if (score === 2) return { level: 2, label: "Fair", color: "text-amber-500" }
  return { level: 3, label: "Strong", color: "text-emerald-600" }
}

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const strength = passwordStrength(newPassword)
  const mismatch = confirm.length > 0 && newPassword !== confirm
  const canSubmit = newPassword.length >= 8 && newPassword === confirm && !submitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Password updated successfully.")
    setNewPassword("")
    setConfirm("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Change Password
        </CardTitle>
        <CardDescription>
          Update the password you use to sign in to your portal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">

          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">New password</Label>
            <div className="relative">
              <Input
                id="cp-new"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Strength bar */}
            {newPassword.length > 0 && (
              <div className="mt-1.5">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-1 flex-1 rounded-full transition-colors"
                      style={{
                        background: n <= strength.level
                          ? (strength.level === 1 ? "#ef4444" : strength.level === 2 ? "#f59e0b" : "#10b981")
                          : "hsl(var(--muted))",
                      }}
                    />
                  ))}
                </div>
                <p className={`text-[11px] ${strength.color}`}>{strength.label}</p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <div className="relative">
              <Input
                id="cp-confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Re-enter new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`pr-10 ${mismatch ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mismatch && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
              : "Update password"}
          </Button>

        </form>
      </CardContent>
    </Card>
  )
}
