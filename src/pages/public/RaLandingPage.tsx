import { useEffect, useState, useMemo } from "react"
import { useParams } from "react-router-dom"
import { Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { getRaLandingPage, submitRaLead, type RaLandingPageData } from "@/lib/data"
import {
  renderMergeTags,
  splitFormSlot,
  isFullPageTemplate,
  BUILTIN_FALLBACK_TEMPLATE,
  type MergeContext,
} from "@/lib/landingTemplate"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Edge function URL for full-page templates — injected as {{functions_url}} merge tag.
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ra-lead-submit`

export function RaLandingPage() {
  const { slug = "" } = useParams<{ slug: string }>()
  const [ra, setRa] = useState<RaLandingPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    document.title = "Divigner AI Automations"
    void (async () => {
      try {
        const data = await getRaLandingPage(slug)
        if (!data || !data.is_active) {
          setNotFound(true)
        } else {
          setRa(data)
          document.title = `${data.display_name} · Divigner AI Automations`
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  const ctx: MergeContext | null = useMemo(() => {
    if (!ra) return null
    return {
      ra_first_name: ra.first_name ?? "",
      ra_last_name:  ra.last_name  ?? "",
      ra_photo:      ra.photo_url  ?? "",
      ra_bio:        ra.bio        ?? "",
      ra_slug:       ra.slug,
      functions_url: FUNCTIONS_URL,
    }
  }, [ra])

  // Determine which template to render and whether it's full-page
  const templateHtml = ra?.template_html?.trim() ? ra.template_html : BUILTIN_FALLBACK_TEMPLATE
  const fullPage     = isFullPageTemplate(templateHtml)

  // Rendered HTML (merge tags replaced) — only computed when ctx is ready
  const renderedHtml = useMemo(
    () => (ctx ? renderMergeTags(templateHtml, ctx) : ""),
    [templateHtml, ctx]
  )

  // Partial-template split (only used when !fullPage)
  const { before, after } = useMemo(() => {
    if (fullPage || !renderedHtml) return { before: "", after: "" }
    return splitFormSlot(renderedHtml)
  }, [fullPage, renderedHtml])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#091A2D]">
        <Loader2 className="h-6 w-6 animate-spin text-[#34D6C2]" />
      </div>
    )
  }

  // ── Not found / inactive ─────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#091A2D] p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Referral link not active</h1>
          <p className="text-sm text-white/50 max-w-md">
            This referral link is either invalid or no longer active. Please check the URL or
            contact the person who shared it with you.
          </p>
        </div>
      </div>
    )
  }

  // ── Full-page template (has own HTML/CSS/JS) — render in iframe ──────────
  if (fullPage) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <iframe
          srcDoc={renderedHtml}
          title={ra ? `${ra.display_name} — Divigner Group` : "Divigner Group"}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          // allow popups for external links inside the page
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    )
  }

  // ── Partial template — React renders content + React form ────────────────
  return (
    <div className="min-h-screen bg-white">
      <div dangerouslySetInnerHTML={{ __html: before }} />
      <LeadForm slug={slug} />
      {after && <div dangerouslySetInnerHTML={{ __html: after }} />}
    </div>
  )
}

// ── React lead form (used for partial templates only) ─────────────────────

function LeadForm({ slug }: { slug: string }) {
  const [firstName, setFirstName] = useState("")
  const [lastName,  setLastName]  = useState("")
  const [email,     setEmail]     = useState("")
  const [phone,     setPhone]     = useState("")
  const [company,   setCompany]   = useState("")
  const [website,   setWebsite]   = useState("")
  const [message,   setMessage]   = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) { toast.error("First name is required"); return }
    if (!email.trim() && !phone.trim()) { toast.error("Please provide an email or phone number"); return }
    if (email && !EMAIL_RE.test(email)) { toast.error("Please enter a valid email"); return }

    setSubmitting(true)
    try {
      await submitRaLead({
        slug,
        first_name: firstName.trim(),
        last_name:  lastName.trim()  || undefined,
        email:      email.trim()     || undefined,
        phone:      phone.trim()     || undefined,
        company:    company.trim()   || undefined,
        website:    website.trim()   || undefined,
        message:    message.trim()   || undefined,
      })
      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: "24px auto", padding: "32px 24px", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", textAlign: "center", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <h2 className="text-xl font-semibold mb-1">Thank you!</h2>
        <p className="text-sm text-muted-foreground">
          We've received your message. Someone will be in touch with you shortly.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ maxWidth: 480, margin: "24px auto", padding: "28px 24px", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lead-first">First name *</Label>
          <Input id="lead-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-last">Last name</Label>
          <Input id="lead-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-email">Email</Label>
        <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-phone">Phone</Label>
        <Input id="lead-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-company">Company</Label>
        <Input id="lead-company" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-website">Website</Label>
        <Input id="lead-website" type="url" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-message">How can we help? <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id="lead-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Submit"}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center pt-1">
        Either an email or phone number is required.
      </p>
    </form>
  )
}
