import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as {
    state?: { from?: { pathname: string } }
  }
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    navigate(location.state?.from?.pathname ?? "/dashboard", { replace: true })
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ backgroundColor: "#0f1b2d" }}
    >
      {/* Logo */}
      <div className="mb-8">
        <img
          src="/logos/divigner-logo-light.png"
          alt="Divigner"
          className="h-10 w-auto"
        />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to your Divigner account to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-gray-700 font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-gray-300 focus-visible:ring-[#1a3a5c]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-gray-700 font-medium">
                Password
              </Label>
              <Link
                to="/forgot-password"
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-gray-300 focus-visible:ring-[#1a3a5c]"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full font-semibold"
            style={{
              backgroundColor: submitting ? "#2a4a6b" : "#0f1b2d",
              color: "#ffffff",
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-white/30">
        © {new Date().getFullYear()} Divigner. All rights reserved.
      </p>
    </div>
  )
}
