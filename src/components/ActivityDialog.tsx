import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { createActivity, updateActivity, type ActivityInput } from "@/lib/data"
import type { Activity, ActivityType, Company, Contact, Deal } from "@/types/db"

const NONE = "__none__"

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "task", label: "Task" },
]

const schema = z.object({
  type: z.enum(["call", "email", "meeting", "note", "task"]),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().optional(),
  contact_id: z.string().optional(),
  company_id: z.string().optional(),
  deal_id: z.string().optional(),
  due_at: z.string().optional(),
  completed: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

function noneToNull(v?: string) {
  return !v || v === NONE ? null : v
}

function toInput(values: FormValues): ActivityInput {
  return {
    type: values.type,
    subject: values.subject.trim(),
    body: values.body && values.body.trim() ? values.body.trim() : null,
    contact_id: noneToNull(values.contact_id),
    company_id: noneToNull(values.company_id),
    deal_id: noneToNull(values.deal_id),
    due_at:
      values.due_at && values.due_at.trim()
        ? new Date(values.due_at).toISOString()
        : null,
    completed_at: values.completed ? new Date().toISOString() : null,
  }
}

function toLocalDateInput(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  // yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ActivityDialog({
  open,
  onOpenChange,
  activity,
  contacts,
  companies,
  deals,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity?: Activity | null
  contacts: Contact[]
  companies: Company[]
  deals: Deal[]
  onSaved: () => void
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "note",
      subject: "",
      body: "",
      contact_id: NONE,
      company_id: NONE,
      deal_id: NONE,
      due_at: "",
      completed: false,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        type: activity?.type ?? "note",
        subject: activity?.subject ?? "",
        body: activity?.body ?? "",
        contact_id: activity?.contact_id ?? NONE,
        company_id: activity?.company_id ?? NONE,
        deal_id: activity?.deal_id ?? NONE,
        due_at: toLocalDateInput(activity?.due_at),
        completed: Boolean(activity?.completed_at),
      })
    }
  }, [open, activity, form])

  const isEdit = Boolean(activity)
  const submitting = form.formState.isSubmitting
  const watchType = form.watch("type")
  const isTask = watchType === "task" || watchType === "meeting"

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit && activity) {
        await updateActivity(activity.id, toInput(values))
        toast.success("Activity updated")
      } else {
        await createActivity(toInput(values))
        toast.success("Activity logged")
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit activity" : "Log activity"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this activity."
              : "Record a call, email, note, meeting, or task."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="sm:col-span-1">
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="What happened?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Details..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
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
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {deals.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {isTask && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="due_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="completed"
                  render={({ field }) => (
                    <FormItem className="flex items-end gap-2">
                      <label className="inline-flex items-center gap-2 text-sm font-medium select-none cursor-pointer pb-2.5">
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                        Mark completed
                      </label>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : isEdit
                    ? "Save changes"
                    : "Log activity"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
