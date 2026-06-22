import { useEffect, useRef, useState } from "react"
import { Camera, Loader2, ShieldCheck, Landmark, FileText, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  getRaAssociate, saveRaPhoto, updateRaSelfProfile,
  submitRaChangeRequest, listRaChangeRequests,
} from "@/lib/data"
import type { RaAssociate, RaChangeRequest } from "@/types/db"

function formatPhone(input: string): string {
  const d = input.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").slice(0, 10)
  if (!d) return ""
  if (d.length < 4) return `(${d}`
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

export function RaSettings() {
  const [ra, setRa] = useState<RaAssociate | null>(null)
  const [requests, setRequests] = useState<RaChangeRequest[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // profile form
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploading, setUploading] = useState(false)

  // banking change request form
  const [bankHolder, setBankHolder] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankRouting, setBankRouting] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [bankNote, setBankNote] = useState("")
  const [submittingBank, setSubmittingBank] = useState(false)

  async function load() {
    const r = await getRaAssociate()
    setRa(r)
    if (r) {
      setDisplayName(r.display_name ?? "")
      setBio(r.bio ?? "")
      setPhone(formatPhone(r.contact_phone ?? ""))
      setEmail(r.contact_email ?? "")
      setRequests(await listRaChangeRequests(r.id).catch(() => []))
    }
  }
  useEffect(() => { void load() }, [])

  async function handlePhoto(file: File) {
    if (!ra) return
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return }
    setUploading(true)
    try {
      const url = await saveRaPhoto(ra.id, file)
      setRa({ ...ra, photo_url: url })
      toast.success("Photo updated")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed") }
    finally { setUploading(false) }
  }

  async function saveProfile() {
    if (!ra) return
    setSavingProfile(true)
    try {
      await updateRaSelfProfile(ra.id, {
        display_name: displayName.trim() || ra.display_name,
        bio: bio.trim(),
        contact_phone: phone.trim(),
        contact_email: email.trim(),
      })
      toast.success("Profile saved")
      await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") }
    finally { setSavingProfile(false) }
  }

  async function requestBankingChange() {
    if (!ra) return
    if (!bankRouting && !bankAccount && !bankHolder && !bankName) { toast.error("Enter the details you'd like to change"); return }
    setSubmittingBank(true)
    try {
      await submitRaChangeRequest({
        raId: ra.id,
        request_type: "banking",
        payload: {
          ach_account_holder: bankHolder.trim() || undefined,
          ach_bank_name: bankName.trim() || undefined,
          ach_routing: bankRouting.replace(/\D/g, "") || undefined,
          ach_account: bankAccount.replace(/\D/g, "") || undefined,
        },
        note: bankNote.trim() || null,
      })
      toast.success("Change request sent to the Divigner team for review")
      setBankHolder(""); setBankName(""); setBankRouting(""); setBankAccount(""); setBankNote("")
      await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to submit") }
    finally { setSubmittingBank(false) }
  }

  const pendingBanking = requests.find((r) => r.request_type === "banking" && r.status === "pending")

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile. Banking and tax changes are reviewed by the Divigner team.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Shown on your public referral and demo pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            {ra?.photo_url ? (
              <img src={ra.photo_url} alt="" className="h-16 w-16 rounded-full object-cover border" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted grid place-items-center"><Camera className="h-5 w-5 text-muted-foreground" /></div>
            )}
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f) }} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</> : "Change photo"}
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Display name (alias)</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How your name appears publicly" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact phone</Label>
              <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(555) 000-0000" inputMode="tel" maxLength={14} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Contact email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Bio</Label>
              <Textarea rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short intro prospects will see…" />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Banking & W-9 — review-gated */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Banking &amp; Tax</CardTitle>
          <CardDescription>For your security, changes here require Divigner team approval before they take effect.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" /> Bank on file</p>
              <p className="font-medium mt-1">{ra?.ach_bank_name || "—"}{ra?.ach_account ? ` ···${ra.ach_account.slice(-4)}` : ""}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> W-9</p>
              <p className="font-medium mt-1">{ra?.w9_completed ? "On file" : "Not on file"}</p>
            </div>
          </div>

          {pendingBanking ? (
            <div className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-amber-800 dark:text-amber-300">You have a banking change request pending review. We'll email you once it's processed.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Request a banking change</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input placeholder="Account holder name" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
                <Input placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                <Input placeholder="Routing number" value={bankRouting} onChange={(e) => setBankRouting(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" />
                <Input placeholder="Account number" value={bankAccount} onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, "").slice(0, 17))} inputMode="numeric" />
              </div>
              <Textarea rows={2} placeholder="Anything the reviewer should know (optional)" value={bankNote} onChange={(e) => setBankNote(e.target.value)} />
              <Button onClick={requestBankingChange} disabled={submittingBank}>
                {submittingBank ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</> : "Submit for review"}
              </Button>
            </div>
          )}

          {requests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Change history</p>
              <div className="rounded-md border divide-y text-sm">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2">
                    <span className="capitalize">{r.request_type} change</span>
                    <span className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{new Date(r.requested_at).toLocaleDateString()}</span>
                      <span className={r.status === "approved" ? "text-primary" : r.status === "declined" ? "text-destructive" : "text-amber-600"}>{r.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
