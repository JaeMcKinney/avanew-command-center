import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
  createLead,
  listLeads,
  listTeamMembers,
  updateLead,
  type LeadInput,
} from "@/lib/data"
import type { Lead, TeamMember } from "@/types/db"
import { cn } from "@/lib/utils"

const NONE = "__none__"

const LEAD_SOURCE_OPTIONS = [
  "Cold call", "Email", "Referral", "Web", "Trade show", "Partner", "Other",
] as const

const INDUSTRY_OPTIONS = [
  "Technology", "Finance", "Manufacturing", "Healthcare", "Biotech",
  "Retail", "Real Estate", "Education", "Other",
] as const

const LEAD_STATUS_OPTIONS = [
  "New", "Contacted", "Working", "Unqualified", "Qualified", "Converted",
] as const

const RATING_OPTIONS = ["Hot", "Warm", "Cold"] as const

const schema = z.object({
  owner_id: z.string().optional(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  lead_source: z.string().optional(),
  industry: z.string().optional(),
  annual_revenue: z.string().optional(),
  email_opt_out: z.boolean().optional(),
  company: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  fax: z.string().optional(),
  website: z.string().optional(),
  lead_status: z.string().optional(),
  no_of_employees: z.string().optional(),
  rating: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  country: z.string().optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function emptyDefaults(): FormValues {
  return {
    owner_id: NONE, first_name: "", last_name: "", title: "",
    phone: "", mobile: "", lead_source: NONE, industry: NONE,
    annual_revenue: "", email_opt_out: false,
    company: "", email: "", fax: "", website: "",
    lead_status: "New", no_of_employees: "", rating: NONE,
    street: "", city: "", state: "", zip_code: "", country: "",
    description: "",
  }
}

function fromLead(l: Lead): FormValues {
  return {
    owner_id: l.owner_id ?? NONE,
    first_name: l.first_name,
    last_name: l.last_name ?? "",
    title: l.title ?? "",
    phone: l.phone ?? "",
    mobile: l.mobile ?? "",
    lead_source: l.lead_source ?? NONE,
    industry: l.industry ?? NONE,
    annual_revenue: l.annual_revenue != null ? String(l.annual_revenue) : "",
    email_opt_out: l.email_opt_out,
    company: l.company ?? "",
    email: l.email ?? "",
    fax: l.fax ?? "",
    website: l.website ?? "",
    lead_status: l.lead_status ?? "New",
    no_of_employees: l.no_of_employees != null ? String(l.no_of_employees) : "",
    rating: l.rating ?? NONE,
    street: l.street ?? "",
    city: l.city ?? "",
    state: l.state ?? "",
    zip_code: l.zip_code ?? "",
    country: l.country ?? "",
    description: l.description ?? "",
  }
}

function pickOrNull(s: string | undefined): string | null {
  if (!s || s === NONE) return null
  const t = s.trim()
  return t === "" ? null : t
}

function toInput(v: FormValues): LeadInput {
  const revenue = v.annual_revenue?.trim()
  const parsedRevenue = revenue ? Number(revenue) : null
  const emp = v.no_of_employees?.trim()
  const parsedEmp = emp ? Number(emp) : null
  return {
    owner_id: pickOrNull(v.owner_id),
    first_name: v.first_name.trim(),
    last_name: v.last_name?.trim() || null,
    title: v.title?.trim() || null,
    phone: v.phone?.trim() || null,
    mobile: v.mobile?.trim() || null,
    lead_source: pickOrNull(v.lead_source),
    industry: pickOrNull(v.industry),
    annual_revenue: parsedRevenue !== null && !Number.isNaN(parsedRevenue) ? parsedRevenue : null,
    email_opt_out: v.email_opt_out ?? false,
    company: v.company?.trim() || null,
    email: v.email?.trim() || null,
    fax: v.fax?.trim() || null,
    website: v.website?.trim() || null,
    lead_status: v.lead_status?.trim() || null,
    no_of_employees: parsedEmp !== null && !Number.isNaN(parsedEmp) ? parsedEmp : null,
    rating: pickOrNull(v.rating),
    street: v.street?.trim() || null,
    city: v.city?.trim() || null,
    state: v.state?.trim() || null,
    zip_code: v.zip_code?.trim() || null,
    country: v.country?.trim() || null,
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

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
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

export function LeadForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults(),
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [t, leads] = await Promise.all([
          listTeamMembers(),
          isEdit ? listLeads() : Promise.resolve([] as Lead[]),
        ])
        if (!alive) return
        setTeam(t.filter((m) => m.status === "active"))

        if (isEdit && id) {
          const lead = leads.find((l) => l.id === id)
          if (!lead) {
            toast.error("Lead not found")
            navigate("/leads", { replace: true })
            return
          }
          form.reset(fromLead(lead))
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

  async function save(values: FormValues): Promise<Lead> {
    const input = toInput(values)
    if (isEdit && id) {
      const l = await updateLead(id, input)
      toast.success("Lead updated")
      return l
    }
    const l = await createLead(input)
    toast.success("Lead created")
    return l
  }

  async function onSubmit(values: FormValues) {
    try {
      await save(values)
      navigate("/leads")
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

  return (
    <div className="-m-4 md:-m-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-6">
            <h1 className="text-lg font-semibold sm:text-xl">
              {isEdit ? "Edit Lead" : "Create Lead"}
            </h1>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate("/leads")} disabled={submitting}>
                Cancel
              </Button>
              {!isEdit && (
                <Button type="button" variant="outline" onClick={onSaveAndNew} disabled={submitting}>
                  Save and New
                </Button>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div className="px-4 py-6 md:px-6">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="space-y-8">
                <FormSection title="Lead Information">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                    {/* Left column */}
                    <FormField control={form.control} name="owner_id" render={({ field }) => (
                      <Row label="Lead Owner">
                        <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE}>Unassigned</SelectItem>
                            {team.map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    {/* Right column */}
                    <FormField control={form.control} name="company" render={({ field }) => (
                      <Row label="Company">
                        <FormControl><Input placeholder="Company name" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="first_name" render={({ field }) => (
                      <Row label={<RequiredLabel>First Name</RequiredLabel>}>
                        <FormControl><Input placeholder="First name" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="email" render={({ field }) => (
                      <Row label="Email">
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="last_name" render={({ field }) => (
                      <Row label="Last Name">
                        <FormControl><Input placeholder="Last name" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="fax" render={({ field }) => (
                      <Row label="Fax">
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

                    <FormField control={form.control} name="website" render={({ field }) => (
                      <Row label="Website">
                        <FormControl><Input type="url" placeholder="https://" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <Row label="Phone">
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="lead_status" render={({ field }) => (
                      <Row label="Lead Status">
                        <Select value={field.value ?? "New"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="New" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEAD_STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="mobile" render={({ field }) => (
                      <Row label="Mobile">
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="no_of_employees" render={({ field }) => (
                      <Row label="No. of Employees">
                        <FormControl><Input type="number" min="0" step="1" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="lead_source" render={({ field }) => (
                      <Row label="Lead Source">
                        <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="-None-" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE}>-None-</SelectItem>
                            {LEAD_SOURCE_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

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

                    <FormField control={form.control} name="industry" render={({ field }) => (
                      <Row label="Industry">
                        <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="-None-" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE}>-None-</SelectItem>
                            {INDUSTRY_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="annual_revenue" render={({ field }) => (
                      <Row label="Annual Revenue">
                        <FormControl><Input type="number" min="0" step="1" placeholder="$" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="email_opt_out" render={({ field }) => (
                      <Row label="Email Opt Out">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value ?? false}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="h-4 w-4 cursor-pointer"
                          />
                        </FormControl>
                        <FormMessage />
                      </Row>
                    )} />
                  </div>
                </FormSection>

                <FormSection title="Address Information">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                    <FormField control={form.control} name="street" render={({ field }) => (
                      <Row label="Street">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="zip_code" render={({ field }) => (
                      <Row label="Zip Code">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="city" render={({ field }) => (
                      <Row label="City">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="country" render={({ field }) => (
                      <Row label="Country">
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="state" render={({ field }) => (
                      <Row label="State">
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
