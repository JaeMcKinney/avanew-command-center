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
  createTask,
  listCompanies,
  listContacts,
  listDeals,
  listLeads,
  listTasks,
  listTeamMembers,
  updateTask,
  uploadDocument,
  type TaskInput,
} from "@/lib/data"
import { supabase } from "@/lib/supabase"
import type { Company, Contact, Deal, Lead, Task, TeamMember } from "@/types/db"
import { cn } from "@/lib/utils"
import { DocumentsSection } from "@/components/DocumentsSection"
import { DocumentQueueInput } from "@/components/DocumentQueueInput"

const NONE = "__none__"

const STATUS_OPTIONS = [
  "Not Started", "In Progress", "Completed", "Waiting for Input", "Deferred",
] as const

const PRIORITY_OPTIONS = [
  "Highest", "High", "Normal", "Low", "Lowest",
] as const

const schema = z.object({
  owner_id: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  status: z.string().optional(),
  priority: z.string().optional(),
  due_date: z.string().optional(),
  contact_id: z.string().optional(),
  company_id: z.string().optional(),
  deal_id: z.string().optional(),
  lead_id: z.string().optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function emptyDefaults(): FormValues {
  return {
    owner_id: NONE,
    subject: "",
    status: "Not Started",
    priority: "Normal",
    due_date: "",
    contact_id: NONE,
    company_id: NONE,
    deal_id: NONE,
    lead_id: NONE,
    description: "",
  }
}

function fromTask(t: Task): FormValues {
  return {
    owner_id: t.owner_id ?? NONE,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date ?? "",
    contact_id: t.contact_id ?? NONE,
    company_id: t.company_id ?? NONE,
    deal_id: t.deal_id ?? NONE,
    lead_id: t.lead_id ?? NONE,
    description: t.description ?? "",
  }
}

function pickOrNull(s: string | undefined): string | null {
  if (!s || s === NONE) return null
  const t = s.trim()
  return t === "" ? null : t
}

function toInput(v: FormValues): TaskInput {
  return {
    subject: v.subject.trim(),
    status: v.status || "Not Started",
    priority: v.priority || "Normal",
    owner_id: pickOrNull(v.owner_id),
    contact_id: pickOrNull(v.contact_id),
    company_id: pickOrNull(v.company_id),
    deal_id: pickOrNull(v.deal_id),
    lead_id: pickOrNull(v.lead_id),
    due_date: v.due_date?.trim() || null,
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

export function TaskForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [team, setTeam] = useState<TeamMember[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
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
        const [t, co, comp, d, l, tasks] = await Promise.all([
          listTeamMembers(),
          listContacts(),
          listCompanies(),
          listDeals(),
          listLeads(),
          isEdit ? listTasks() : Promise.resolve([] as Task[]),
        ])
        if (!alive) return
        setTeam(t.filter((m) => m.status === "active"))
        setContacts(co)
        setCompanies(comp)
        setDeals(d)
        setLeads(l)

        if (isEdit && id) {
          const task = tasks.find((tk) => tk.id === id)
          if (!task) {
            toast.error("Task not found")
            navigate("/tasks", { replace: true })
            return
          }
          form.reset(fromTask(task))
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

  async function save(values: FormValues): Promise<Task> {
    const input = toInput(values)
    if (isEdit && id) {
      const tk = await updateTask(id, input)
      toast.success("Task updated")
      return tk
    }
    const tk = await createTask(input)
    toast.success("Task created")
    return tk
  }

  async function onSubmit(values: FormValues) {
    try {
      const entity = await save(values)
      if (queuedFiles.length > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          for (const file of queuedFiles) {
            await uploadDocument("task", entity.id, file, user.id)
          }
        }
      }
      navigate("/tasks")
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
            <h1 className="text-lg font-semibold sm:text-xl whitespace-nowrap">
              {isEdit ? "Edit Task" : "Create Task"}
            </h1>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate("/tasks")} disabled={submitting}>
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

          <div className="px-4 py-6 md:px-6">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="space-y-8">
                <FormSection title="Task Information">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
                    {/* Left column */}
                    <FormField control={form.control} name="owner_id" render={({ field }) => (
                      <Row label="Task Owner">
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
                    <FormField control={form.control} name="contact_id" render={({ field }) => (
                      <Row label="Contact">
                        <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            {contacts.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.first_name} {c.last_name ?? ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="subject" render={({ field }) => (
                      <Row label={<RequiredLabel>Subject</RequiredLabel>}>
                        <FormControl><Input placeholder="e.g. Follow up with Acme" {...field} /></FormControl>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="company_id" render={({ field }) => (
                      <Row label="Account">
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

                    <FormField control={form.control} name="status" render={({ field }) => (
                      <Row label="Status">
                        <Select value={field.value ?? "Not Started"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Not Started" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="deal_id" render={({ field }) => (
                      <Row label="Deal">
                        <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            {deals.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="priority" render={({ field }) => (
                      <Row label="Priority">
                        <Select value={field.value ?? "Normal"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Normal" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="lead_id" render={({ field }) => (
                      <Row label="Lead">
                        <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            {leads.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {l.first_name} {l.last_name ?? ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </Row>
                    )} />

                    <FormField control={form.control} name="due_date" render={({ field }) => (
                      <Row label="Due Date">
                        <FormControl><Input type="date" {...field} /></FormControl>
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
                  <DocumentsSection entityType="task" entityId={id} />
                )}
              </div>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}
