import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentsSection } from "@/components/DocumentsSection"
import { DocumentQueueInput } from "@/components/DocumentQueueInput"
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
  createCompany,
  listCompanies,
  listContacts,
  listDeals,
  listTeamMembers,
  updateCompany,
  uploadDocument,
  type CompanyInput,
} from "@/lib/data"
import { supabase } from "@/lib/supabase"
import type { Company, Contact, Deal, TeamMember } from "@/types/db"
import { RelatedRecordsBar, type RelatedRecord } from "@/components/RelatedRecordsBar"
import { cn } from "@/lib/utils"
import { useRole } from "@/hooks/useRole"
import { useAuth } from "@/contexts/AuthContext"
import { SelectWithOther } from "@/components/SelectWithOther"

const NONE = "__none__"

const ACCOUNT_TYPE_OPTIONS = [
  "Analyst", "Competitor", "Customer", "Distributor", "Integrator",
  "Investor", "Partner", "Press", "Prospect", "Reseller", "Other",
] as const

const INDUSTRY_OPTIONS = [
  "Technology", "Finance", "Manufacturing", "Healthcare", "Biotech",
  "Retail", "Real Estate", "Education", "Other",
] as const

const RATING_OPTIONS = ["Hot", "Warm", "Cold"] as const

const OWNERSHIP_OPTIONS = ["Public", "Private", "Subsidiary", "Other"] as const

const schema = z.object({
  owner_id: z.string().refine((v) => v !== NONE && v.trim().length > 0, {
    message: "Account Owner is required",
  }),
  name: z.string().min(1, "Account name is required"),
  account_site: z.string().optional(),
  parent_account: z.string().optional(),
  account_number: z.string().optional(),
  account_type: z.string().optional(),
  industry: z.string().optional(),
  annual_revenue: z.string().optional(),
  rating: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  website: z.string().optional(),
  ticker_symbol: z.string().optional(),
  ownership: z.string().optional(),
  employees: z.string().optional(),
  sic_code: z.string().optional(),
  billing_street: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_zip: z.string().optional(),
  billing_country: z.string().optional(),
  shipping_street: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_state: z.string().optional(),
  shipping_zip: z.string().optional(),
  shipping_country: z.string().optional(),
  linkedin: z.string().optional(),
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  youtube: z.string().optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function emptyDefaults(): FormValues {
  return {
    owner_id: NONE, name: "", account_site: "", parent_account: "",
    account_number: "", account_type: NONE, industry: NONE,
    annual_revenue: "", rating: NONE, phone: "", fax: "", website: "",
    ticker_symbol: "", ownership: NONE, employees: "", sic_code: "",
    billing_street: "", billing_city: "", billing_state: "", billing_zip: "",
    billing_country: "", shipping_street: "", shipping_city: "",
    shipping_state: "", shipping_zip: "", shipping_country: "",
    linkedin: "", instagram: "", twitter: "", youtube: "",
    description: "",
  }
}

function fromCompany(c: Company): FormValues {
  return {
    owner_id: c.owner_id ?? NONE,
    name: c.name,
    account_site: c.account_site ?? "",
    parent_account: "",
    account_number: c.account_number ?? "",
    account_type: c.account_type ?? NONE,
    industry: c.industry ?? NONE,
    annual_revenue: c.annual_revenue != null ? String(c.annual_revenue) : "",
    rating: c.rating ?? NONE,
    phone: c.phone ?? "",
    fax: c.fax ?? "",
    website: c.website ?? "",
    ticker_symbol: c.ticker_symbol ?? "",
    ownership: c.ownership ?? NONE,
    employees: c.employees != null ? String(c.employees) : "",
    sic_code: c.sic_code ?? "",
    billing_street: c.billing_street ?? "",
    billing_city: c.billing_city ?? "",
    billing_state: c.billing_state ?? "",
    billing_zip: c.billing_zip ?? "",
    billing_country: c.billing_country ?? "",
    shipping_street: c.shipping_street ?? "",
    shipping_city: c.shipping_city ?? "",
    shipping_state: c.shipping_state ?? "",
    shipping_zip: c.shipping_zip ?? "",
    shipping_country: c.shipping_country ?? "",
    linkedin: c.linkedin ?? "",
    instagram: c.instagram ?? "",
    twitter: c.twitter ?? "",
    youtube: c.youtube ?? "",
    description: c.description ?? "",
  }
}

function pickOrNull(s: string | undefined): string | null {
  if (!s || s === NONE) return null
  const t = s.trim()
  return t === "" ? null : t
}

function toInput(v: FormValues): CompanyInput {
  const revenue = v.annual_revenue?.trim()
  const parsedRevenue = revenue ? Number(revenue) : null
  const emp = v.employees?.trim()
  const parsedEmp = emp ? Number(emp) : null
  return {
    name: v.name.trim(),
    account_site: v.account_site?.trim() || null,
    account_number: v.account_number?.trim() || null,
    account_type: pickOrNull(v.account_type),
    industry: pickOrNull(v.industry),
    annual_revenue: parsedRevenue !== null && !Number.isNaN(parsedRevenue) ? parsedRevenue : null,
    rating: pickOrNull(v.rating),
    phone: v.phone?.trim() || null,
    fax: v.fax?.trim() || null,
    website: v.website?.trim() || null,
    ticker_symbol: v.ticker_symbol?.trim() || null,
    ownership: pickOrNull(v.ownership),
    employees: parsedEmp !== null && !Number.isNaN(parsedEmp) ? parsedEmp : null,
    sic_code: v.sic_code?.trim() || null,
    billing_street: v.billing_street?.trim() || null,
    billing_city: v.billing_city?.trim() || null,
    billing_state: v.billing_state?.trim() || null,
    billing_zip: v.billing_zip?.trim() || null,
    billing_country: v.billing_country?.trim() || null,
    shipping_street: v.shipping_street?.trim() || null,
    shipping_city: v.shipping_city?.trim() || null,
    shipping_state: v.shipping_state?.trim() || null,
    shipping_zip: v.shipping_zip?.trim() || null,
    shipping_country: v.shipping_country?.trim() || null,
    linkedin: v.linkedin?.trim() || null,
    instagram: v.instagram?.trim() || null,
    twitter: v.twitter?.trim() || null,
    youtube: v.youtube?.trim() || null,
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

export function AccountForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { role } = useRole()
  const { user } = useAuth()
  const isLimitedRole = role === "bd" || role === "partner"

  const [team, setTeam] = useState<TeamMember[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [queuedFiles, setQueuedFiles] = useState<File[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults(),
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [t, companies, cts, ds] = await Promise.all([
          listTeamMembers(),
          isEdit ? listCompanies() : Promise.resolve([] as Company[]),
          isEdit ? listContacts() : Promise.resolve([] as Contact[]),
          isEdit ? listDeals() : Promise.resolve([] as Deal[]),
        ])
        if (!alive) return
        setTeam(t.filter((m) => m.status === "active"))
        setContacts(cts)
        setDeals(ds)

        if (isEdit && id) {
          const company = companies.find((c) => c.id === id)
          if (!company) {
            toast.error("Account not found")
            navigate("/accounts", { replace: true })
            return
          }
          form.reset(fromCompany(company))
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

  function copyBillingToShipping() {
    const v = form.getValues()
    form.setValue("shipping_street", v.billing_street ?? "")
    form.setValue("shipping_city", v.billing_city ?? "")
    form.setValue("shipping_state", v.billing_state ?? "")
    form.setValue("shipping_zip", v.billing_zip ?? "")
    form.setValue("shipping_country", v.billing_country ?? "")
  }

  async function save(values: FormValues): Promise<Company> {
    const input = toInput(values)
    if (isEdit && id) {
      const c = await updateCompany(id, input)
      toast.success("Account updated")
      return c
    }
    const c = await createCompany(input)
    toast.success("Account created")
    return c
  }

  async function onSubmit(values: FormValues) {
    try {
      const entity = await save(values)
      if (queuedFiles.length > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          for (const file of queuedFiles) {
            await uploadDocument("account", entity.id, file, user.id)
          }
        }
      }
      navigate("/accounts")
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

  const relatedRecords = useMemo<RelatedRecord[]>(() => {
    if (!isEdit || !id) return []
    const out: RelatedRecord[] = []
    contacts
      .filter((c) => c.company_id === id)
      .forEach((c) => {
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ")
        out.push({ kind: "contact", id: c.id, label: name, sublabel: c.title ?? undefined })
      })
    deals
      .filter((d) => d.company_id === id)
      .forEach((d) => {
        const amt = d.amount != null
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(d.amount)
          : undefined
        out.push({ kind: "deal", id: d.id, label: d.title, sublabel: amt })
      })
    return out
  }, [isEdit, id, contacts, deals])

  return (
    <div className="-m-4 md:-m-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-6">
            <h1 className="text-lg font-semibold sm:text-xl whitespace-nowrap">
              {isEdit ? "Edit Account" : "Create Account"}
            </h1>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate("/accounts")} disabled={submitting}>
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
                <FormSection title="Account Information">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                    {/* Left column */}
                    <FormField control={form.control} name="owner_id" render={({ field }) => (
                      <Row label={<RequiredLabel>Account Owner</RequiredLabel>}>
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

                    {/* Right column: Rating */}
                    <FormField control={form.control} name="rating" render={({ field }) => (
                      <Row label="Rating">
                        <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="-None-" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE}>-None-</SelectItem>
                            {RATING_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="name" render={({ field }) => (
                      <Row label={<RequiredLabel>Account Name</RequiredLabel>}>
                        <FormControl><Input placeholder="e.g. Acme Corp" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <Row label="Phone">
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="account_site" render={({ field }) => (
                      <Row label="Account Site">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="fax" render={({ field }) => (
                      <Row label="Fax">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="parent_account" render={({ field }) => (
                      <Row label="Parent Account">
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

                    <FormField control={form.control} name="linkedin" render={({ field }) => (
                      <Row label="LinkedIn">
                        <FormControl><Input type="url" placeholder="https://www.linkedin.com/company/..." {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="instagram" render={({ field }) => (
                      <Row label="Instagram">
                        <FormControl><Input placeholder="@handle or URL" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="twitter" render={({ field }) => (
                      <Row label="Twitter / X">
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

                    <FormField control={form.control} name="account_number" render={({ field }) => (
                      <Row label="Account Number">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="ticker_symbol" render={({ field }) => (
                      <Row label="Ticker Symbol">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="account_type" render={({ field }) => (
                      <Row label="Account Type">
                        <SelectWithOther
                          options={ACCOUNT_TYPE_OPTIONS}
                          value={field.value ?? NONE}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="ownership" render={({ field }) => (
                      <Row label="Ownership">
                        <SelectWithOther
                          options={OWNERSHIP_OPTIONS}
                          value={field.value ?? NONE}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="industry" render={({ field }) => (
                      <Row label="Industry">
                        <SelectWithOther
                          options={INDUSTRY_OPTIONS}
                          value={field.value ?? NONE}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="employees" render={({ field }) => (
                      <Row label="Employees">
                        <FormControl><Input type="number" min="0" step="1" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="annual_revenue" render={({ field }) => (
                      <Row label="Annual Revenue">
                        <FormControl><Input type="number" min="0" step="1" placeholder="$" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="sic_code" render={({ field }) => (
                      <Row label="SIC Code">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />
                  </div>
                </FormSection>

                <FormSection
                  title="Address Information"
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={copyBillingToShipping}>
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copy Billing to Shipping
                    </Button>
                  }
                >
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                    <FormField control={form.control} name="billing_street" render={({ field }) => (
                      <Row label="Billing Street">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="shipping_street" render={({ field }) => (
                      <Row label="Shipping Street">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="billing_city" render={({ field }) => (
                      <Row label="Billing City">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="shipping_city" render={({ field }) => (
                      <Row label="Shipping City">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="billing_state" render={({ field }) => (
                      <Row label="Billing State">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="shipping_state" render={({ field }) => (
                      <Row label="Shipping State">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="billing_zip" render={({ field }) => (
                      <Row label="Billing Code">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="shipping_zip" render={({ field }) => (
                      <Row label="Shipping Code">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="billing_country" render={({ field }) => (
                      <Row label="Billing Country">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="shipping_country" render={({ field }) => (
                      <Row label="Shipping Country">
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

                {!isEdit && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Documents</h3>
                    <DocumentQueueInput files={queuedFiles} onChange={setQueuedFiles} />
                  </div>
                )}
                {isEdit && id && (
                  <DocumentsSection entityType="account" entityId={id} />
                )}
              </div>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}
