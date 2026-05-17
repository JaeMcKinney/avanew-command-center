import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  createContact,
  listCompanies,
  listContacts,
  listDeals,
  listTeamMembers,
  updateContact,
  type ContactInput,
} from "@/lib/data"
import type { Company, Contact, Deal, TeamMember } from "@/types/db"
import { RelatedRecordsBar, type RelatedRecord } from "@/components/RelatedRecordsBar"
import { cn } from "@/lib/utils"
import { useRole } from "@/hooks/useRole"
import { useAuth } from "@/contexts/AuthContext"
import { SelectWithOther } from "@/components/SelectWithOther"

const NONE = "__none__"

const LEAD_SOURCE_OPTIONS = [
  "Cold call", "Email", "Referral", "Web", "Trade show", "Partner", "Other",
] as const

const schema = z.object({
  owner_id: z.string().refine((v) => v !== NONE && v.trim().length > 0, {
    message: "Contact Owner is required",
  }),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  company_id: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  department: z.string().optional(),
  lead_source: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  assistant: z.string().optional(),
  date_of_birth: z.string().optional(),
  asst_phone: z.string().optional(),
  email_opt_out: z.boolean().optional(),
  skype_id: z.string().optional(),
  secondary_email: z.union([z.string().email(), z.literal("")]).optional(),
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
  instagram: z.string().optional(),
  youtube: z.string().optional(),
  fax: z.string().optional(),
  website: z.string().optional(),
  mailing_street: z.string().optional(),
  mailing_city: z.string().optional(),
  mailing_state: z.string().optional(),
  mailing_zip: z.string().optional(),
  mailing_country: z.string().optional(),
  other_street: z.string().optional(),
  other_city: z.string().optional(),
  other_state: z.string().optional(),
  other_zip: z.string().optional(),
  other_country: z.string().optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function emptyDefaults(): FormValues {
  return {
    owner_id: NONE, first_name: "", last_name: "", company_id: NONE,
    title: "", phone: "", mobile: "", department: "", lead_source: NONE,
    email: "", assistant: "", date_of_birth: "", asst_phone: "",
    email_opt_out: false, skype_id: "", secondary_email: "",
    linkedin: "", twitter: "", instagram: "", youtube: "",
    fax: "", website: "", mailing_street: "", mailing_city: "",
    mailing_state: "", mailing_zip: "", mailing_country: "",
    other_street: "", other_city: "", other_state: "", other_zip: "",
    other_country: "", description: "",
  }
}

function fromContact(c: Contact): FormValues {
  return {
    owner_id: c.owner_id ?? NONE,
    first_name: c.first_name,
    last_name: c.last_name ?? "",
    company_id: c.company_id ?? NONE,
    title: c.title ?? "",
    phone: c.phone ?? "",
    mobile: c.mobile ?? "",
    department: c.department ?? "",
    lead_source: c.lead_source ?? NONE,
    email: c.email ?? "",
    assistant: c.assistant ?? "",
    date_of_birth: c.date_of_birth ?? "",
    asst_phone: c.asst_phone ?? "",
    email_opt_out: c.email_opt_out,
    skype_id: c.skype_id ?? "",
    secondary_email: c.secondary_email ?? "",
    linkedin: c.linkedin ?? "",
    twitter: c.twitter ?? "",
    instagram: c.instagram ?? "",
    youtube: c.youtube ?? "",
    fax: c.fax ?? "",
    website: c.website ?? "",
    mailing_street: c.mailing_street ?? "",
    mailing_city: c.mailing_city ?? "",
    mailing_state: c.mailing_state ?? "",
    mailing_zip: c.mailing_zip ?? "",
    mailing_country: c.mailing_country ?? "",
    other_street: c.other_street ?? "",
    other_city: c.other_city ?? "",
    other_state: c.other_state ?? "",
    other_zip: c.other_zip ?? "",
    other_country: c.other_country ?? "",
    description: c.description ?? "",
  }
}

function pickOrNull(s: string | undefined): string | null {
  if (!s || s === NONE) return null
  const t = s.trim()
  return t === "" ? null : t
}

function toInput(v: FormValues): ContactInput {
  return {
    first_name: v.first_name.trim(),
    last_name: v.last_name?.trim() || null,
    company_id: pickOrNull(v.company_id),
    title: v.title?.trim() || null,
    phone: v.phone?.trim() || null,
    mobile: v.mobile?.trim() || null,
    department: v.department?.trim() || null,
    lead_source: pickOrNull(v.lead_source),
    email: v.email?.trim() || null,
    assistant: v.assistant?.trim() || null,
    date_of_birth: v.date_of_birth?.trim() || null,
    asst_phone: v.asst_phone?.trim() || null,
    email_opt_out: v.email_opt_out ?? false,
    skype_id: v.skype_id?.trim() || null,
    secondary_email: v.secondary_email?.trim() || null,
    linkedin: v.linkedin?.trim() || null,
    twitter: v.twitter?.trim() || null,
    instagram: v.instagram?.trim() || null,
    youtube: v.youtube?.trim() || null,
    fax: v.fax?.trim() || null,
    website: v.website?.trim() || null,
    mailing_street: v.mailing_street?.trim() || null,
    mailing_city: v.mailing_city?.trim() || null,
    mailing_state: v.mailing_state?.trim() || null,
    mailing_zip: v.mailing_zip?.trim() || null,
    mailing_country: v.mailing_country?.trim() || null,
    other_street: v.other_street?.trim() || null,
    other_city: v.other_city?.trim() || null,
    other_state: v.other_state?.trim() || null,
    other_zip: v.other_zip?.trim() || null,
    other_country: v.other_country?.trim() || null,
    description: v.description?.trim() || null,
  }
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <FormLabel className="flex items-center gap-1">
      {children}
      <span aria-hidden className="text-destructive">*</span>
    </FormLabel>
  )
}

function FormSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <FormItem className={cn("grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4", className)}>
      {typeof label === "string" ? (
        <FormLabel className="text-sm text-muted-foreground sm:text-right">{label}</FormLabel>
      ) : (
        <div className="text-sm text-muted-foreground sm:text-right">{label}</div>
      )}
      <div className="min-w-0">{children}</div>
    </FormItem>
  )
}

export function ContactForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { role } = useRole()
  const { user } = useAuth()
  const isLimitedRole = role === "bd" || role === "partner"

  const [team, setTeam] = useState<TeamMember[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults(),
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [t, co, contacts, ds] = await Promise.all([
          listTeamMembers(),
          listCompanies(),
          isEdit ? listContacts() : Promise.resolve([] as Contact[]),
          isEdit ? listDeals() : Promise.resolve([] as Deal[]),
        ])
        if (!alive) return
        setTeam(t.filter((m) => m.status === "active"))
        setCompanies(co)
        setDeals(ds)

        if (isEdit && id) {
          const contact = contacts.find((c) => c.id === id)
          if (!contact) {
            toast.error("Contact not found")
            navigate("/contacts", { replace: true })
            return
          }
          form.reset(fromContact(contact))
        } else {
          form.reset(emptyDefaults())
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function copyMailingToOther() {
    const v = form.getValues()
    form.setValue("other_street", v.mailing_street ?? "")
    form.setValue("other_city", v.mailing_city ?? "")
    form.setValue("other_state", v.mailing_state ?? "")
    form.setValue("other_zip", v.mailing_zip ?? "")
    form.setValue("other_country", v.mailing_country ?? "")
  }

  async function save(values: FormValues): Promise<Contact> {
    const input = toInput(values)
    if (isEdit && id) {
      const c = await updateContact(id, input)
      toast.success("Contact updated")
      return c
    }
    const c = await createContact(input)
    toast.success("Contact created")
    return c
  }

  async function onSubmit(values: FormValues) {
    try {
      await save(values)
      navigate("/contacts")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  async function onSaveAndNew() {
    const ok = await form.trigger()
    if (!ok) return
    try {
      await save(form.getValues())
      form.reset(emptyDefaults())
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  const submitting = form.formState.isSubmitting
  const watchCompanyId = form.watch("company_id")

  const relatedRecords = useMemo<RelatedRecord[]>(() => {
    if (!isEdit || !id) return []
    const out: RelatedRecord[] = []
    if (watchCompanyId && watchCompanyId !== NONE) {
      const co = companies.find((c) => c.id === watchCompanyId)
      if (co) out.push({ kind: "account", id: co.id, label: co.name })
    }
    deals
      .filter((d) => d.contact_id === id)
      .forEach((d) => {
        const amt = d.amount != null
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(d.amount)
          : undefined
        out.push({ kind: "deal", id: d.id, label: d.title, sublabel: amt })
      })
    return out
  }, [isEdit, id, watchCompanyId, companies, deals])

  return (
    <div className="-m-4 md:-m-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-6">
            <h1 className="text-lg font-semibold sm:text-xl whitespace-nowrap">
              {isEdit ? "Edit Contact" : "Create Contact"}
            </h1>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate("/contacts")} disabled={submitting}>
                Cancel
              </Button>
              {!isEdit && (
                <Button type="button" variant="outline" onClick={onSaveAndNew} disabled={submitting} className="hidden sm:flex">
                  Save and New
                </Button>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <RelatedRecordsBar records={relatedRecords} />
          </div>

          <div className="px-4 py-6 md:px-6">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="space-y-8">
                <FormSection title="Contact Information">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                    <FormField control={form.control} name="owner_id" render={({ field }) => (
                      <Row label={<RequiredLabel>Contact Owner</RequiredLabel>}>
                        <Select value={field.value && field.value !== NONE ? field.value : ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select an owner" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(isLimitedRole ? team.filter((m) => m.id === user?.id) : team).map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                      <Row label="Date of Birth">
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="first_name" render={({ field }) => (
                      <Row label={<RequiredLabel>First Name</RequiredLabel>}>
                        <FormControl><Input placeholder="First name" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="asst_phone" render={({ field }) => (
                      <Row label="Asst Phone">
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="last_name" render={({ field }) => (
                      <Row label="Last Name">
                        <FormControl><Input placeholder="Last name" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="email_opt_out" render={({ field }) => (
                      <Row label="Email Opt Out">
                        <FormControl>
                          <Checkbox
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="company_id" render={({ field }) => (
                      <Row label="Account Name">
                        <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            {companies.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="skype_id" render={({ field }) => (
                      <Row label="Skype ID">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="title" render={({ field }) => (
                      <Row label="Title">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="secondary_email" render={({ field }) => (
                      <Row label="Secondary Email">
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <Row label="Phone">
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="linkedin" render={({ field }) => (
                      <Row label="LinkedIn">
                        <FormControl><Input type="url" placeholder="https://www.linkedin.com/in/..." {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="twitter" render={({ field }) => (
                      <Row label="Twitter / X">
                        <FormControl><Input placeholder="@handle or URL" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="instagram" render={({ field }) => (
                      <Row label="Instagram">
                        <FormControl><Input placeholder="@handle or URL" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="youtube" render={({ field }) => (
                      <Row label="YouTube">
                        <FormControl><Input type="url" placeholder="https://youtube.com/..." {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="mobile" render={({ field }) => (
                      <Row label="Mobile">
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="fax" render={({ field }) => (
                      <Row label="Fax">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="department" render={({ field }) => (
                      <Row label="Department">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="website" render={({ field }) => (
                      <Row label="Website">
                        <FormControl><Input type="url" placeholder="https://" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="lead_source" render={({ field }) => (
                      <Row label="Lead Source">
                        <SelectWithOther
                          options={LEAD_SOURCE_OPTIONS}
                          value={field.value ?? NONE}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="email" render={({ field }) => (
                      <Row label="Email">
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="assistant" render={({ field }) => (
                      <Row label="Assistant">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />
                  </div>
                </FormSection>

                <FormSection
                  title="Address Information"
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={copyMailingToOther}>
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copy Mailing to Other
                    </Button>
                  }
                >
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                    <FormField control={form.control} name="mailing_street" render={({ field }) => (
                      <Row label="Mailing Street">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="other_street" render={({ field }) => (
                      <Row label="Other Street">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="mailing_city" render={({ field }) => (
                      <Row label="Mailing City">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="other_city" render={({ field }) => (
                      <Row label="Other City">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="mailing_state" render={({ field }) => (
                      <Row label="Mailing State">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="other_state" render={({ field }) => (
                      <Row label="Other State">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="mailing_zip" render={({ field }) => (
                      <Row label="Mailing Zip">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="other_zip" render={({ field }) => (
                      <Row label="Other Zip">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="mailing_country" render={({ field }) => (
                      <Row label="Mailing Country">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="other_country" render={({ field }) => (
                      <Row label="Other Country">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />
                  </div>
                </FormSection>

                <FormSection title="Description Information">
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <Row label="Description">
                      <FormControl><Textarea rows={4} {...field} /></FormControl>
                      <FormMessage />
                    </Row>
                  )} />
                </FormSection>
              </div>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}
