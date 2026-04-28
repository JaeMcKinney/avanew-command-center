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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { createCompany, updateCompany, type CompanyInput } from "@/lib/data"
import type { Company } from "@/types/db"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  domain: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function toInput(values: FormValues): CompanyInput {
  const trim = (v?: string) => (v && v.trim() !== "" ? v.trim() : null)
  return {
    name: values.name.trim(),
    domain: trim(values.domain),
    industry: trim(values.industry),
    notes: trim(values.notes),
  }
}

export function CompanyDialog({
  open,
  onOpenChange,
  company,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  company?: Company | null
  onSaved: () => void
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", domain: "", industry: "", notes: "" },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: company?.name ?? "",
        domain: company?.domain ?? "",
        industry: company?.industry ?? "",
        notes: company?.notes ?? "",
      })
    }
  }, [open, company, form])

  const isEdit = Boolean(company)
  const submitting = form.formState.isSubmitting

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit && company) {
        await updateCompany(company.id, toInput(values))
        toast.success("Company updated")
      } else {
        await createCompany(toInput(values))
        toast.success("Company created")
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
          <DialogTitle>{isEdit ? "Edit company" : "New company"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this company's details."
              : "Add an organization to your CRM."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain</FormLabel>
                    <FormControl>
                      <Input placeholder="example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Manufacturing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : isEdit ? "Save changes" : "Create company"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
