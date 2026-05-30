import {
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  MoreHorizontal,
  User,
  XCircle,
  AlertTriangle,
  Plus,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ---------- Helpers ----------

function ScreenLabel({ id, title }: { id: string; title: string }) {
  return (
    <Badge variant="outline" className="border-border bg-muted/40 text-foreground/80">
      Screen {id} — {title}
    </Badge>
  )
}

function ScreenFrame({
  id,
  title,
  when,
  size = "desktop",
  children,
}: {
  id: string
  title: string
  when: string
  size?: "desktop" | "mobile"
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <ScreenLabel id={id} title={title} />
        <p className="text-sm text-muted-foreground">{when}</p>
      </div>
      <div
        className={cn(
          "rounded-lg border bg-card p-6 shadow-sm",
          size === "desktop" ? "max-w-4xl" : "max-w-md"
        )}
      >
        {children}
      </div>
    </section>
  )
}

function ModalNote() {
  return (
    <p className="mb-3 text-xs italic text-muted-foreground">
      (Shown inline for preview. In production this appears as a modal.)
    </p>
  )
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Active: "text-emerald-600 border-emerald-300",
    "Pending Verification": "text-amber-600 border-amber-300",
    "Needs Changes": "text-orange-600 border-orange-300",
    "Pending Onboarding": "text-gray-500 border-gray-300",
    Declined: "text-red-600 border-red-300",
  }
  return (
    <Badge variant="outline" className={cn(map[status] ?? "")}>
      {status}
    </Badge>
  )
}

function intentBadge(intent: "learning" | "interested" | "sold") {
  const map = {
    learning: { label: "Just learning", cls: "text-gray-500 border-gray-300" },
    interested: { label: "Interested", cls: "text-amber-600 border-amber-300" },
    sold: { label: "Sold", cls: "text-emerald-600 border-emerald-300" },
  }
  return (
    <Badge variant="outline" className={map[intent].cls}>
      {map[intent].label}
    </Badge>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold">{children}</h3>
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

// ---------- Screen Z1 ----------

const RA_ROWS = [
  { name: "John Smith", email: "john.smith@example.com", slug: "john-smith", status: "Active", joined: "May 12 2026" },
  { name: "Maria Lopez", email: "maria.lopez@example.com", slug: "maria-lopez", status: "Pending Verification", joined: "May 18 2026" },
  { name: "David Park", email: "david.park@example.com", slug: "david-park", status: "Needs Changes", joined: "May 15 2026" },
  { name: "Lila Chen", email: "lila.chen@example.com", slug: "lila-chen", status: "Pending Onboarding", joined: "May 19 2026" },
  { name: "Tom Reeves", email: "tom.reeves@example.com", slug: "tom-reeves", status: "Declined", joined: "May 8 2026" },
]

function ScreenZ1() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle>Referral Associates</CardTitle>
          <CardDescription>Manage your Divigner referral associates and their onboarding state.</CardDescription>
        </div>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Referral Associate
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All (5)</TabsTrigger>
            <TabsTrigger value="pv">Pending Verification (1)</TabsTrigger>
            <TabsTrigger value="active">Active (1)</TabsTrigger>
            <TabsTrigger value="nc">Needs Changes (1)</TabsTrigger>
            <TabsTrigger value="dec">Declined (1)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RA_ROWS.map((r) => (
                <TableRow key={r.email}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email}</TableCell>
                  <TableCell className="text-muted-foreground">{r.slug}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.joined}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Z2 Add RA ----------

function ScreenZ2() {
  return (
    <>
      <ModalNote />
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle>Add Referral Associate</CardTitle>
          <CardDescription>Send an invitation to a new referral associate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Display name">
            <Input placeholder="e.g. Maria Lopez" defaultValue="Maria Lopez" />
          </Field>
          <Field label="Email">
            <Input type="email" placeholder="maria@example.com" defaultValue="maria.lopez@example.com" />
          </Field>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Slug</Label>
            <Input defaultValue="maria-lopez" />
            <p className="text-xs text-muted-foreground">
              Will become portal.divigner.com/refer/&lt;slug&gt;
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost">Cancel</Button>
            <Button>Send Invitation</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ---------- Z3 Verification queue ----------

function ScreenZ3() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify Maria Lopez</CardTitle>
        <CardDescription>Review the submission and approve, request changes, or decline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button className="bg-emerald-600 hover:bg-emerald-700">Approve</Button>
          <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
            Request Changes
          </Button>
          <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
            Decline
          </Button>
        </div>

        <Separator />

        <div>
          <SectionHeading>Profile</SectionHeading>
          <div className="flex gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Display name">
                <Input readOnly defaultValue="Maria Lopez" />
              </Field>
              <Field label="Phone">
                <Input readOnly defaultValue="(415) 555-0142" />
              </Field>
              <Field label="Email">
                <Input readOnly defaultValue="maria.lopez@example.com" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Bio">
                  <Textarea
                    readOnly
                    rows={3}
                    defaultValue="Healthcare consultant with 12 years bridging providers and digital health platforms."
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <SectionHeading>Banking</SectionHeading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Bank name">
              <Input readOnly defaultValue="Bank of America" />
            </Field>
            <Field label="Account holder name">
              <Input readOnly defaultValue="Maria E. Lopez" />
            </Field>
            <div>
              <Label className="text-xs text-muted-foreground">Routing number</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input readOnly defaultValue="•••• ••5678" />
                <Button variant="ghost" size="sm">Show</Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Account number</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input readOnly defaultValue="•••• ••4321" />
                <Button variant="ghost" size="sm">Show</Button>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Submitted May 18, 2026 at 3:42 PM</p>
      </CardContent>
    </Card>
  )
}

// ---------- Z4 Request Changes ----------

function ScreenZ4() {
  return (
    <>
      <ModalNote />
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle>Request changes from Maria Lopez</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Notes">
            <Textarea
              rows={5}
              placeholder="Tell Maria what needs to be fixed before approval…"
              defaultValue="Please upload a clearer headshot — the current photo is too dark. Also confirm the routing number; it appears to be 9 digits instead of 9."
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost">Cancel</Button>
            <Button className="bg-orange-600 hover:bg-orange-700">
              Send &amp; Move to Needs Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ---------- Z5 Decline ----------

function ScreenZ5() {
  return (
    <>
      <ModalNote />
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle>Decline Maria Lopez</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Reason for declining (sent to applicant)">
            <Textarea
              rows={4}
              defaultValue="Thanks for your interest. We're not moving forward at this time."
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Decline</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ---------- Z6 Notifications card ----------

function ScreenZ6() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4" /> Notifications
        </CardTitle>
        <CardDescription>Who gets notified about activity on this lead.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border">
          <li className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium">John Smith</div>
              <div className="text-xs text-muted-foreground">RA, referrer</div>
            </div>
            <Badge variant="outline" className="text-gray-500 border-gray-300">auto</Badge>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium">Zuirrae McKinney</div>
              <div className="text-xs text-muted-foreground">admin</div>
            </div>
            <Badge variant="outline" className="text-gray-500 border-gray-300">auto</Badge>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <div className="text-sm">sales@divigner.com</div>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <div className="text-sm">peter@clientcompany.com</div>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </li>
        </ul>
        <div className="mt-3">
          <Button variant="outline" size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add person
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Z7 Add subscriber dialog ----------

function ScreenZ7() {
  return (
    <>
      <ModalNote />
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle>Add notification subscriber</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <SectionHeading>Internal teammate</SectionHeading>
            <Select>
              <SelectTrigger><SelectValue placeholder="Choose teammate" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="jae">Jae McKinney</SelectItem>
                <SelectItem value="zuirrae">Zuirrae McKinney</SelectItem>
                <SelectItem value="other">Other admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div>
            <SectionHeading>External contact</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input placeholder="Full name" />
              </Field>
              <Field label="Email">
                <Input type="email" placeholder="name@company.com" />
              </Field>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost">Cancel</Button>
            <Button>Add subscriber</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ---------- Onboarding card status chip ----------

function SavedChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Saved
    </span>
  )
}

function NeedsUpdateChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      <AlertTriangle className="h-3 w-3" /> Needs update
    </span>
  )
}

// ---------- R1 Onboarding ----------

function PhotoCard({ rightChip }: { rightChip?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle>Your photo</CardTitle>
        {rightChip}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <Button variant="outline" size="sm">Upload photo</Button>
            <p className="text-xs text-muted-foreground">JPG or PNG. Min 400×400.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ContactInfoCard({ rightChip }: { rightChip?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle>Contact information</CardTitle>
        {rightChip}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <Input defaultValue="Maria Lopez" />
          </Field>
          <Field label="Phone">
            <Input defaultValue="(415) 555-0142" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email">
              <Input defaultValue="maria.lopez@example.com" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Bio">
              <Textarea
                rows={3}
                defaultValue="Healthcare consultant with 12 years bridging providers and digital health platforms."
              />
            </Field>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm">Save</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function BankingCard({ rightChip }: { rightChip?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle>Banking information</CardTitle>
        {rightChip}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Bank name">
            <Input defaultValue="Bank of America" />
          </Field>
          <Field label="Account holder name">
            <Input defaultValue="Maria E. Lopez" />
          </Field>
          <Field label="Routing number">
            <Input defaultValue="123456789" />
          </Field>
          <Field label="Account number">
            <Input defaultValue="9876543210" />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Used for commission payouts via ACH. Encrypted at rest. You can change this later, but
          changes require re-verification.
        </p>
        <div className="flex justify-end">
          <Button size="sm">Save</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ScreenR1() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Welcome, Maria — let's get you set up</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete all four sections below to submit your account for verification. We'll review and
          activate your account within 1–2 business days.
        </p>
      </div>
      <PhotoCard rightChip={<SavedChip />} />
      <ContactInfoCard rightChip={<SavedChip />} />
      <BankingCard rightChip={<SavedChip />} />
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost">Save &amp; finish later</Button>
        <Button size="lg">Submit for verification</Button>
      </div>
    </div>
  )
}

// ---------- R2 Submitted ----------

function ScreenR2() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <Clock className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Submitted for review</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We're reviewing your information. You'll receive an email once your account is approved
        (usually within 1–2 business days). Until then, your referral link is not active.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">Submitted May 18, 2026 at 3:42 PM</p>
    </div>
  )
}

// ---------- R3 Needs changes ----------

function ScreenR3() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <div className="font-semibold">Zuirrae has requested some changes</div>
          <p className="mt-1 text-sm">
            Please upload a clearer headshot — the current photo is too dark. Also confirm the
            routing number; it appears to be 9 digits instead of 9. Update the items below and
            re-submit.
          </p>
        </div>
      </div>
      <PhotoCard rightChip={<NeedsUpdateChip />} />
      <ContactInfoCard rightChip={<SavedChip />} />
      <BankingCard rightChip={<NeedsUpdateChip />} />
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost">Save &amp; finish later</Button>
        <Button size="lg">Re-submit for verification</Button>
      </div>
    </div>
  )
}

// ---------- R4 Active dashboard ----------

const PIPELINE = [
  { company: "Acme Health", contact: "Aria Petrov", intent: "sold" as const, stage: "New Submission", date: "May 17 2026" },
  { company: "Northwind Pharma", contact: "Daniel Cho", intent: "interested" as const, stage: "Discovery Scheduled", date: "May 12 2026" },
  { company: "Quantum Diagnostics", contact: "Sara Whyte", intent: "learning" as const, stage: "Proposal Sent", date: "Apr 28 2026" },
]

function ScreenR4() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Maria's Dashboard</h2>

      <Card className="border-2 border-primary/50 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardDescription>Your unique referral link</CardDescription>
          <CardTitle className="flex flex-wrap items-center gap-3 text-base">
            <code className="rounded bg-muted px-2 py-1 text-sm">
              portal.divigner.com/refer/maria-lopez
            </code>
            <Button size="sm" variant="outline">
              <Copy className="mr-1 h-4 w-4" /> Copy
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Share this link to start earning commissions.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Page Views", value: "47" },
          { label: "Total Submissions", value: "3" },
          { label: "Active Clients", value: "1" },
          { label: "Lifetime Earnings", value: "$1,050" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-2">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Your pipeline</h3>
          <Badge variant="outline" className="text-muted-foreground">Read-only</Badge>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PIPELINE.map((p) => (
                <TableRow key={p.company}>
                  <TableCell className="font-medium">{p.company}</TableCell>
                  <TableCell className="text-muted-foreground">{p.contact}</TableCell>
                  <TableCell>{intentBadge(p.intent)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.stage}</TableCell>
                  <TableCell className="text-muted-foreground">{p.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

// ---------- R5 Edit landing page ----------

function ScreenR5() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Edit your landing page</h2>
      <Card>
        <CardHeader>
          <CardTitle>Photo &amp; Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <Button variant="outline" size="sm">Upload photo</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <Input defaultValue="Maria Lopez" />
            </Field>
            <Field label="Phone">
              <Input defaultValue="(415) 555-0142" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email">
                <Input defaultValue="maria.lopez@example.com" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Bio">
                <Textarea
                  rows={3}
                  defaultValue="Healthcare consultant with 12 years bridging providers and digital health platforms."
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm">Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banking information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Banking edits require re-verification by Zuirrae. To request a change, click below.
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bank name">
              <Input readOnly defaultValue="Bank of America" />
            </Field>
            <Field label="Account holder name">
              <Input readOnly defaultValue="Maria E. Lopez" />
            </Field>
            <Field label="Routing number">
              <Input readOnly defaultValue="•••• ••5678" />
            </Field>
            <Field label="Account number">
              <Input readOnly defaultValue="•••• ••4321" />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm">Request banking change</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- R6 RA pipeline read-only ----------

function ScreenR6() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle>Leads</CardTitle>
          <CardDescription>Track the status of every prospect you've referred.</CardDescription>
        </div>
        <Badge variant="outline" className="text-muted-foreground">
          Filtered: your referrals
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-12 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PIPELINE.map((p) => (
                <TableRow key={p.company}>
                  <TableCell className="font-medium">{p.company}</TableCell>
                  <TableCell className="text-muted-foreground">{p.contact}</TableCell>
                  <TableCell>{intentBadge(p.intent)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.stage}</TableCell>
                  <TableCell className="text-muted-foreground">{p.date}</TableCell>
                  <TableCell className="text-right">
                    <Eye className="ml-auto h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- R7 Declined ----------

function ScreenR7() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <XCircle className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Account declined</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your referral associate application was not approved. If you believe this is an error,
        please contact Zuirrae McKinney at zuirrae@divigner.com.
      </p>
    </div>
  )
}

// ---------- P1 Public landing ----------

function ScreenP1() {
  return (
    <div className="space-y-10">
      {/* Brand bar */}
      <div className="-mx-6 -mt-6 rounded-t-lg bg-slate-900 px-6 py-4 text-white">
        <div className="text-xl font-bold tracking-widest">DIVIGNER</div>
      </div>

      {/* Hero */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">
            Meet Divigner — your AI website concierge
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Talk to your visitors before they bounce.
          </p>
          <Button size="lg" className="mt-5">Watch the demo</Button>
        </div>
        <div className="aspect-video grid place-items-center rounded-xl border bg-muted text-sm text-muted-foreground">
          Avatar Demo
        </div>
      </div>

      <Separator />

      {/* Referred by */}
      <div>
        <h3 className="mb-4 text-xl font-semibold">Referred by Maria Lopez</h3>
        <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-5 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="text-lg font-semibold">Maria Lopez</div>
            <p className="text-sm text-muted-foreground">
              Healthcare consultant with 12 years bridging providers and digital health platforms.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>(415) 555-0142</span>
              <span>maria.lopez@example.com</span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Form */}
      <div>
        <h3 className="mb-1 text-xl font-semibold">Request a consultation</h3>
        <p className="mb-6 text-sm text-muted-foreground">
          Tell us a little about you and we'll be in touch.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your name *">
            <Input />
          </Field>
          <Field label="Company name *">
            <Input />
          </Field>
          <Field label="Email *">
            <Input type="email" />
          </Field>
          <Field label="Phone *">
            <Input type="tel" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Industry">
              <Select>
                <SelectTrigger><SelectValue placeholder="Select an industry" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="pharma">Pharma</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Label className="text-sm font-medium">How can we help you today?</Label>
            <div className="mt-2 space-y-2">
              {[
                { id: "learning", label: "Just learning about Divigner", selected: false },
                { id: "interested", label: "Interested — I'd like to know more", selected: false },
                { id: "sold", label: "Sold — let's get started", selected: true },
              ].map((opt) => (
                <div
                  key={opt.id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-3",
                    opt.selected && "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border",
                      opt.selected ? "border-emerald-600" : "border-muted-foreground"
                    )}
                  >
                    {opt.selected && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
                  </span>
                  <span className="text-sm">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <Field label="Anything else we should know?">
              <Textarea rows={3} />
            </Field>
          </div>
        </div>
        <div className="mt-6">
          <Button size="lg" className="w-full sm:w-auto">Request consultation</Button>
        </div>
      </div>
    </div>
  )
}

// ---------- P2 Thank you ----------

function ScreenP2() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Thank you — we'll be in touch shortly.</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Maria has been notified of your interest and our team will reach out within one business
        day.
      </p>
    </div>
  )
}

// ---------- Page ----------

export function RaStoryboard() {
  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-semibold">RA Storyboard — Visual Preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All screens are static mockups. No data is loaded or saved.
        </p>
      </div>

      <Tabs defaultValue="admin" className="w-full">
        <TabsList>
          <TabsTrigger value="admin">Zuirrae (Admin)</TabsTrigger>
          <TabsTrigger value="ra">Referral Associate</TabsTrigger>
          <TabsTrigger value="public">Public / Prospect</TabsTrigger>
        </TabsList>

        {/* ---------- ADMIN ---------- */}
        <TabsContent value="admin" className="mt-6 space-y-12">
          <ScreenFrame
            id="Z1"
            title="Settings → Team → Referral Associates list"
            when="Admin lands here from Settings → Team → Referral Associates tab."
          >
            <ScreenZ1 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="Z2"
            title="Add Referral Associate dialog"
            when="Admin clicks '+ Add Referral Associate' from the list."
            size="mobile"
          >
            <ScreenZ2 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="Z3"
            title="Pending Verification — queue detail"
            when="Admin opens an RA in 'Pending Verification' status to review banking + profile."
          >
            <ScreenZ3 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="Z4"
            title="Request Changes dialog"
            when="Admin clicks 'Request Changes' from the verification queue."
            size="mobile"
          >
            <ScreenZ4 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="Z5"
            title="Decline dialog"
            when="Admin clicks 'Decline' from the verification queue."
            size="mobile"
          >
            <ScreenZ5 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="Z6"
            title="Lead / Deal Notifications card"
            when="Shown on any lead or deal detail page — controls who gets notified of activity."
          >
            <ScreenZ6 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="Z7"
            title="Add subscriber dialog"
            when="Admin clicks '+ Add person' from the Notifications card."
            size="mobile"
          >
            <ScreenZ7 />
          </ScreenFrame>
        </TabsContent>

        {/* ---------- RA ---------- */}
        <TabsContent value="ra" className="mt-6 space-y-12">
          <ScreenFrame
            id="R1"
            title="First-time onboarding (pending)"
            when="RA logs in for the first time after accepting their invite."
          >
            <ScreenR1 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="R2"
            title="Submitted — holding screen"
            when="RA has clicked 'Submit for verification' and is waiting on Zuirrae."
            size="mobile"
          >
            <ScreenR2 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="R3"
            title="Onboarding with 'needs changes' banner"
            when="Zuirrae has requested changes; the RA returns to fix items and re-submit."
          >
            <ScreenR3 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="R4"
            title="Active RA dashboard"
            when="RA is approved and active — this is the home page after login."
          >
            <ScreenR4 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="R5"
            title="Edit my landing page"
            when="RA self-service editing of public profile; banking is locked."
          >
            <ScreenR5 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="R6"
            title="RA pipeline (read-only)"
            when="RA opens the Leads page — filtered to their own referrals, no write actions."
          >
            <ScreenR6 />
          </ScreenFrame>
          <Separator className="my-12" />

          <ScreenFrame
            id="R7"
            title="Declined / Account locked"
            when="RA was declined during verification; they see this on next login."
            size="mobile"
          >
            <ScreenR7 />
          </ScreenFrame>
        </TabsContent>

        {/* ---------- PUBLIC ---------- */}
        <TabsContent value="public" className="mt-6 space-y-12">
          <section className="space-y-3">
            <div className="space-y-1">
              <ScreenLabel id="P1" title="Public RA landing page" />
              <p className="text-sm text-muted-foreground">
                Prospect visits portal.divigner.com/refer/maria-lopez — Maria's referral URL.
              </p>
            </div>
            <div className="max-w-5xl rounded-lg border bg-card p-6 shadow-sm">
              <ScreenP1 />
            </div>
          </section>
          <Separator className="my-12" />

          <ScreenFrame
            id="P2"
            title="Form submitted — thank-you state"
            when="Prospect submits the consultation form; this replaces the form area."
            size="mobile"
          >
            <ScreenP2 />
          </ScreenFrame>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RaStoryboard
