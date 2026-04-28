import { useCallback, useEffect, useRef, useState } from "react"
import * as XLSX from "xlsx"
import Papa from "papaparse"
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createCompany,
  createContact,
  createDeal,
  createLead,
  createTask,
  listCompanies,
  listContacts,
  listStages,
  type CompanyInput,
  type ContactInput,
  type DealInput,
  type LeadInput,
  type TaskInput,
} from "@/lib/data"
import type { Company, Contact, PipelineStage } from "@/types/db"
import { cn } from "@/lib/utils"

export type ImportEntity = "contacts" | "leads" | "accounts" | "deals" | "tasks"

interface Props {
  entity: ImportEntity
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

type Step = "upload" | "preview" | "done"

interface FieldDef {
  header: string
  required?: boolean
  valueType?: "number" | "boolean"
  lookup?: "companies" | "contacts" | "stages"
}

const FIELD_DEFS: Record<ImportEntity, Record<string, FieldDef>> = {
  contacts: {
    first_name:   { header: "first_name", required: true },
    last_name:    { header: "last_name" },
    email:        { header: "email" },
    phone:        { header: "phone" },
    mobile:       { header: "mobile" },
    title:        { header: "title" },
    company_id:   { header: "account_name", lookup: "companies" },
    department:   { header: "department" },
    lead_source:  { header: "lead_source" },
    description:  { header: "description" },
  },
  leads: {
    first_name:       { header: "first_name", required: true },
    last_name:        { header: "last_name" },
    company:          { header: "company" },
    email:            { header: "email" },
    phone:            { header: "phone" },
    mobile:           { header: "mobile" },
    title:            { header: "title" },
    lead_status:      { header: "lead_status" },
    lead_source:      { header: "lead_source" },
    industry:         { header: "industry" },
    annual_revenue:   { header: "annual_revenue", valueType: "number" },
    no_of_employees:  { header: "no_of_employees", valueType: "number" },
    rating:           { header: "rating" },
    description:      { header: "description" },
  },
  accounts: {
    name:           { header: "name", required: true },
    industry:       { header: "industry" },
    domain:         { header: "domain" },
    phone:          { header: "phone" },
    website:        { header: "website" },
    annual_revenue: { header: "annual_revenue", valueType: "number" },
    employees:      { header: "employees", valueType: "number" },
    description:    { header: "description" },
  },
  deals: {
    title:               { header: "title", required: true },
    stage_id:            { header: "stage", required: true, lookup: "stages" },
    amount:              { header: "amount", valueType: "number" },
    company_id:          { header: "account_name", lookup: "companies" },
    contact_id:          { header: "contact_name", lookup: "contacts" },
    expected_close_date: { header: "expected_close_date" },
    probability:         { header: "probability", valueType: "number" },
    lead_source:         { header: "lead_source" },
    description:         { header: "description" },
  },
  tasks: {
    subject:     { header: "subject", required: true },
    status:      { header: "status" },
    priority:    { header: "priority" },
    due_date:    { header: "due_date" },
    contact_id:  { header: "contact_name", lookup: "contacts" },
    company_id:  { header: "account_name", lookup: "companies" },
    description: { header: "description" },
  },
}

const ENTITY_LABELS: Record<ImportEntity, string> = {
  contacts: "Contacts",
  leads: "Leads",
  accounts: "Accounts",
  deals: "Deals",
  tasks: "Tasks",
}

type RawRow = Record<string, string>

interface ParsedRow {
  raw: RawRow
  errors: string[]
}

interface RefData {
  companies: Company[]
  contacts: Contact[]
  stages: PipelineStage[]
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "_")
}

function parseFile(file: File): Promise<RawRow[]> {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: normalizeHeader,
        complete: (r) => resolve(r.data),
        error: reject,
      })
    })
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), {
          type: "array",
        })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<RawRow>(ws, {
          defval: "",
          raw: false,
        })
        const normalized = json.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [normalizeHeader(k), String(v)])
          )
        )
        resolve(normalized)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function validateRows(
  entity: ImportEntity,
  rawRows: RawRow[],
  refs: RefData
): ParsedRow[] {
  const defs = FIELD_DEFS[entity]
  const companyByName = new Map(
    refs.companies.map((c) => [c.name.toLowerCase(), c.id])
  )
  const contactByName = new Map(
    refs.contacts.map((c) => [
      `${c.first_name} ${c.last_name ?? ""}`.trim().toLowerCase(),
      c.id,
    ])
  )
  const stageByName = new Map(
    refs.stages.map((s) => [s.name.toLowerCase(), s.id])
  )

  return rawRows.map((raw) => {
    const errors: string[] = []
    for (const [, def] of Object.entries(defs)) {
      const val = (raw[def.header] ?? "").trim()
      if (def.required && !val) {
        errors.push(`${def.header} is required`)
        continue
      }
      if (!val) continue
      if (def.lookup === "stages" && !stageByName.has(val.toLowerCase())) {
        errors.push(`stage "${val}" not found`)
      }
    }
    return { raw, errors }
  })
}

function buildInput(
  entity: ImportEntity,
  row: RawRow,
  refs: RefData
):
  | ContactInput
  | LeadInput
  | CompanyInput
  | DealInput
  | TaskInput {
  const defs = FIELD_DEFS[entity]
  const companyByName = new Map(
    refs.companies.map((c) => [c.name.toLowerCase(), c.id])
  )
  const contactByName = new Map(
    refs.contacts.map((c) => [
      `${c.first_name} ${c.last_name ?? ""}`.trim().toLowerCase(),
      c.id,
    ])
  )
  const stageByName = new Map(
    refs.stages.map((s) => [s.name.toLowerCase(), s.id])
  )

  const result: Record<string, unknown> = {}
  for (const [field, def] of Object.entries(defs)) {
    const raw = (row[def.header] ?? "").trim()
    if (!raw) {
      result[field] = null
      continue
    }
    if (def.lookup === "companies") {
      result[field] = companyByName.get(raw.toLowerCase()) ?? null
    } else if (def.lookup === "contacts") {
      result[field] = contactByName.get(raw.toLowerCase()) ?? null
    } else if (def.lookup === "stages") {
      result[field] = stageByName.get(raw.toLowerCase()) ?? null
    } else if (def.valueType === "number") {
      const n = Number(raw.replace(/[,$]/g, ""))
      result[field] = Number.isFinite(n) ? n : null
    } else if (def.valueType === "boolean") {
      result[field] = raw.toLowerCase() === "true" || raw === "1"
    } else {
      result[field] = raw
    }
  }
  return result as ContactInput & LeadInput & CompanyInput & DealInput
}

async function importRow(
  entity: ImportEntity,
  input: ReturnType<typeof buildInput>
) {
  if (entity === "contacts") return createContact(input as ContactInput)
  if (entity === "leads") return createLead(input as LeadInput)
  if (entity === "accounts") return createCompany(input as CompanyInput)
  if (entity === "tasks") return createTask(input as TaskInput)
  return createDeal(input as DealInput)
}

function makeTemplate(entity: ImportEntity): string {
  const headers = Object.values(FIELD_DEFS[entity])
    .map((d) => d.header)
    .join(",")
  return headers + "\n"
}

export function ImportDialog({ entity, open, onOpenChange, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload")
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{
    imported: number
    failed: number
    errors: string[]
  } | null>(null)
  const [refs, setRefs] = useState<RefData>({
    companies: [],
    contacts: [],
    stages: [],
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setStep("upload")
    setParsedRows([])
    setResults(null)
    Promise.all([listCompanies(), listContacts(), listStages()])
      .then(([companies, contacts, stages]) =>
        setRefs({ companies, contacts, stages })
      )
      .catch(() => {})
  }, [open])

  const processFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
        toast.error("Only CSV, XLSX, and XLS files are supported")
        return
      }
      setParsing(true)
      try {
        const rawRows = await parseFile(file)
        if (rawRows.length === 0) {
          toast.error("The file appears to be empty")
          return
        }
        const validated = validateRows(entity, rawRows, refs)
        setParsedRows(validated)
        setStep("preview")
      } catch {
        toast.error("Failed to parse file")
      } finally {
        setParsing(false)
      }
    },
    [entity, refs]
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void processFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void processFile(file)
    e.target.value = ""
  }

  function downloadTemplate() {
    const csv = makeTemplate(entity)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${entity}_import_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function runImport() {
    const validRows = parsedRows.filter((r) => r.errors.length === 0)
    setImporting(true)
    let imported = 0
    const errors: string[] = []
    for (let i = 0; i < validRows.length; i++) {
      try {
        const input = buildInput(entity, validRows[i].raw, refs)
        await importRow(entity, input)
        imported++
      } catch (err) {
        errors.push(
          `Row ${i + 1}: ${err instanceof Error ? err.message : "failed"}`
        )
      }
    }
    setResults({ imported, failed: errors.length, errors })
    setStep("done")
    setImporting(false)
    if (imported > 0) onComplete()
  }

  const validCount = parsedRows.filter((r) => r.errors.length === 0).length
  const invalidCount = parsedRows.length - validCount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {ENTITY_LABELS[entity]}</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onFileChange}
              />
              {parsing ? (
                <p className="text-sm text-muted-foreground">Parsing file…</p>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-muted grid place-items-center">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      Drop your file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports CSV, XLSX, and XLS
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border px-4 py-3 bg-muted/40">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Not sure about the format?
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={downloadTemplate}
              >
                <Download className="h-4 w-4" />
                Download template
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium">{parsedRows.length} rows found</span>
              {validCount > 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {validCount} valid
                </span>
              )}
              {invalidCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-4 w-4" />
                  {invalidCount} with errors
                </span>
              )}
            </div>

            <div className="max-h-64 overflow-auto rounded-md border text-xs">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">
                      #
                    </th>
                    {Object.values(FIELD_DEFS[entity])
                      .slice(0, 5)
                      .map((d) => (
                        <th
                          key={d.header}
                          className="px-3 py-2 text-left font-medium text-muted-foreground"
                        >
                          {d.header}
                        </th>
                      ))}
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedRows.slice(0, 20).map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row.errors.length > 0 ? "bg-destructive/5" : ""
                      }
                    >
                      <td className="px-3 py-2 text-muted-foreground">
                        {i + 1}
                      </td>
                      {Object.values(FIELD_DEFS[entity])
                        .slice(0, 5)
                        .map((d) => (
                          <td
                            key={d.header}
                            className="px-3 py-2 max-w-[140px] truncate"
                          >
                            {row.raw[d.header] || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ))}
                      <td className="px-3 py-2">
                        {row.errors.length === 0 ? (
                          <span className="text-green-600 dark:text-green-400">
                            ✓
                          </span>
                        ) : (
                          <span
                            className="text-destructive"
                            title={row.errors.join("; ")}
                          >
                            ✗ {row.errors[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 20 && (
                <p className="px-3 py-2 text-muted-foreground text-xs border-t">
                  …and {parsedRows.length - 20} more rows
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("upload")}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={validCount === 0 || importing}
                onClick={runImport}
              >
                {importing
                  ? "Importing…"
                  : `Import ${validCount} ${validCount === 1 ? "record" : "records"}`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && results && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="h-14 w-14 rounded-full bg-primary/15 grid place-items-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">
                  {results.imported}{" "}
                  {results.imported === 1 ? "record" : "records"} imported
                </p>
                {results.failed > 0 && (
                  <p className="text-sm text-destructive mt-0.5">
                    {results.failed} rows failed
                  </p>
                )}
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="max-h-32 overflow-auto rounded-md border bg-muted/40 p-3 text-xs text-destructive space-y-1">
                {results.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("upload")
                  setParsedRows([])
                  setResults(null)
                }}
              >
                Import more
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
