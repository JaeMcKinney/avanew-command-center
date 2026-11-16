import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import type { ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import { CopyId } from "@/components/CopyId"
import { PageHeader } from "@/components/PageHeader"
import { ErrorBlock, LoadingBlock } from "@/components/States"
import { DeploymentStatusPill, StatusPill, WebhookStatusPill } from "@/components/StatusPill"
import { Button } from "@/components/ui/button"
import { getPalDetail, type PalDetail, type TavusPart } from "@/lib/api"
import { formatDateTime } from "@/lib/dates"
import { count } from "@/lib/format"

type Json = Record<string, unknown>
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null)
const pretty = (value: unknown) => JSON.stringify(value, null, 2)
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone

function Section({ id, title, count: n, children }: { id: string; title: string; count?: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
      <h2 id={id} className="text-lg font-semibold">{title}{typeof n === "number" && <span className="font-sans text-sm font-normal text-muted-foreground"> ({count(n)})</span>}</h2>
      {children}
    </section>
  )
}

/** Long text exactly as written in Tavus, scrollable and selectable. */
function Verbatim({ label, value }: { label: string; value: string }) {
  return <pre tabIndex={0} aria-label={label} className="max-h-[32rem] overflow-auto rounded-md border bg-muted p-3 font-sans text-sm whitespace-pre-wrap">{value}</pre>
}

function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  const shown = rows.filter(([, value]) => value !== null && value !== undefined && value !== "")
  if (shown.length === 0) return null
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(9rem,max-content)_1fr]">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Unavailable({ what, part }: { what: string; part: TavusPart<unknown> }) {
  if (part.ok) return null
  return <p className="flex items-start gap-2 text-sm text-warn"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{what} could not be read from Tavus: {part.error}</p>
}

function Raw({ summary, value }: { summary: string; value: unknown }) {
  return (
    <details className="text-sm">
      <summary className="min-h-8 cursor-pointer text-primary-text">{summary}</summary>
      <pre tabIndex={0} aria-label={summary} className="mt-2 max-h-96 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs">{pretty(value)}</pre>
    </details>
  )
}

function Detail({ d }: { d: PalDetail }) {
  const pal = d.pal
  const layers = (pal.layers ?? {}) as Record<string, Json>
  const face = d.face?.ok ? d.face.data : null
  const tools = d.tools.ok ? d.tools.data : []
  const legacyTools = Array.isArray(layers.llm?.tools) ? (layers.llm.tools as Json[]) : []
  const skills = d.skills.ok ? Object.entries(d.skills.data) : []
  const objective = d.objectives?.ok ? ((d.objectives.data.data ?? d.objectives.data) as Json) : null
  const objectiveList = Array.isArray(objective?.objectives) ? (objective!.objectives as Json[]) : objective ? [objective] : []
  const prompt = text(pal.system_prompt)

  return (
    <>
      <Section id="ids" title="Identifiers">
        <div className="flex flex-col gap-1.5">
          <CopyId label="PAL ID" value={pal.pal_id} />
          <CopyId label="Face ID" value={text(pal.default_face_id)} />
          {text(layers.tts?.voice_id) && <CopyId label="Voice ID" value={text(layers.tts?.voice_id)} />}
          {text(pal.objectives_id) && <CopyId label="Objectives ID" value={text(pal.objectives_id)} />}
        </div>
        <Facts rows={[
          ["Linked to", d.linked?.clients ? <Link to={`/admin/clients/${d.linked.clients.slug}`} className="text-primary-text underline">{d.linked.clients.name}</Link> : "No client yet"],
          ["Shown to the client as", d.linked ? `${d.linked.display_name}${d.linked.role_label ? ` · ${d.linked.role_label}` : ""}` : null],
          ["Call reporting", d.linked ? <WebhookStatusPill status={d.linked.webhook_status} /> : null],
          ["Created in Tavus", text(pal.created_at) ? formatDateTime(text(pal.created_at), zone) : null],
          ["Last changed in Tavus", text(pal.updated_at) ? formatDateTime(text(pal.updated_at), zone) : null],
        ]} />
      </Section>

      <Section id="prompt" title="System prompt">
        {prompt ? <Verbatim label="System prompt" value={prompt} /> : <p className="text-sm text-muted-foreground">This avatar has no system prompt in Tavus.</p>}
        <Facts rows={[
          ["Greeting", text(pal.greeting) ?? (pal.dynamic_greeting ? "Written fresh for each call" : "None: the avatar waits for the visitor")],
          ["AI disclosure", text(pal.disclosure_type)],
          ["Spoken disclosure", text(pal.verbal_disclosure)],
          ["On-screen disclosure", text(pal.visual_disclosure)],
        ]} />
      </Section>

      <Section id="knowledge" title="Knowledge base" count={d.documents.length}>
        {d.documents.length === 0 && d.document_tags.length === 0 && <p className="text-sm text-muted-foreground">No documents are attached to this avatar.</p>}
        {d.document_tags.length > 0 && <p className="text-sm">Also uses every document tagged: {d.document_tags.map((t) => <code key={t} className="mr-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs">{t}</code>)}</p>}
        <ul className="flex flex-col gap-2">
          {d.documents.map((doc) => (
            <li key={doc.id} className="rounded-md border p-3 text-sm">
              {doc.ok ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{text(doc.data.document_name) ?? "Untitled document"}</p>
                    {doc.data.status === "ready" ? <StatusPill tone="ok" icon={<CheckCircle2 />}>Ready</StatusPill> : <StatusPill tone={doc.data.status === "error" ? "bad" : "info"} icon={<AlertTriangle />}>{text(doc.data.status) ?? "Unknown"}</StatusPill>}
                  </div>
                  {text(doc.data.document_url) && <p className="break-all text-muted-foreground">{text(doc.data.document_url)}</p>}
                  <CopyId label="Document ID" value={doc.id} />
                  {text(doc.data.last_crawled_at) && <p className="text-xs text-muted-foreground">Last read by Tavus {formatDateTime(text(doc.data.last_crawled_at), zone)}</p>}
                </div>
              ) : (
                <><CopyId label="Document ID" value={doc.id} /><Unavailable what="This document" part={doc} /></>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="guardrails" title="Guardrails" count={d.guardrails.length}>
        {d.guardrails.length === 0 && d.guardrail_tags.length === 0 && <p className="text-sm text-muted-foreground">No guardrails are attached to this avatar.</p>}
        {d.guardrail_tags.length > 0 && <p className="text-sm">Also follows every guardrail tagged: {d.guardrail_tags.map((t) => <code key={t} className="mr-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs">{t}</code>)}</p>}
        <ul className="flex flex-col gap-2">
          {d.guardrails.map((g) => (
            <li key={g.id} className="flex flex-col gap-1.5 rounded-md border p-3 text-sm">
              {g.ok ? (
                <>
                  <p className="font-medium">{text(g.data.guardrail_name) ?? "Guardrail"}{text(g.data.modality) && <span className="font-normal text-muted-foreground"> · {text(g.data.modality)}</span>}</p>
                  {text(g.data.guardrail_prompt) && <p className="whitespace-pre-wrap">{text(g.data.guardrail_prompt)}</p>}
                  {!text(g.data.guardrail_prompt) && <Raw summary="Show what Tavus returned" value={g.data} />}
                </>
              ) : <Unavailable what="This guardrail" part={g} />}
              <CopyId label="Guardrail ID" value={g.id} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="objectives" title="Objectives" count={objectiveList.length}>
        {d.objectives && !d.objectives.ok && <Unavailable what="The objectives" part={d.objectives} />}
        {objectiveList.length === 0 && (!d.objectives || d.objectives.ok) && <p className="text-sm text-muted-foreground">No objectives are attached to this avatar.</p>}
        <ol className="flex flex-col gap-2">
          {objectiveList.map((o, i) => (
            <li key={i} className="flex flex-col gap-1.5 rounded-md border p-3 text-sm">
              <p className="font-medium">{text(o.objective_name) ?? `Objective ${i + 1}`}</p>
              {text(o.objective_prompt) && <p className="whitespace-pre-wrap">{text(o.objective_prompt)}</p>}
              <Facts rows={[
                ["Confirmed", text(o.confirmation_mode)],
                ["Collects", Array.isArray(o.output_variables) && o.output_variables.length ? (o.output_variables as string[]).join(", ") : null],
                ["Then", text(o.next_required_objective)],
              ]} />
            </li>
          ))}
        </ol>
      </Section>

      <Section id="tools" title="Tool calls" count={tools.length + legacyTools.length}>
        <Unavailable what="The tools" part={d.tools} />
        {d.tools.ok && tools.length + legacyTools.length === 0 && <p className="text-sm text-muted-foreground">This avatar has no tools.</p>}
        <ul className="flex flex-col gap-2">
          {tools.map((tool) => {
            const delivery = (tool.delivery ?? {}) as Json
            const api = (delivery.api ?? null) as Json | null
            return (
              <li key={String(tool.tool_id)} className="flex flex-col gap-1.5 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono font-medium">{text(tool.name) ?? String(tool.tool_id)}</p>
                  <StatusPill tone="neutral">{tool.is_system_tool ? "Built in" : text(tool.trigger_type) === "post_call" ? "After the call" : "During the call"}</StatusPill>
                </div>
                {text(tool.description) && <p>{text(tool.description)}</p>}
                <Facts rows={[["Sends to", api ? `${text(api.method) ?? "POST"} ${text(api.url) ?? ""}` : delivery.app_message ? "The website the avatar is on" : null]]} />
                {!tool.is_system_tool && <Raw summary={`Show the settings for ${text(tool.name) ?? "this tool"}`} value={tool} />}
              </li>
            )
          })}
          {legacyTools.map((tool, i) => (
            <li key={`legacy-${i}`} className="rounded-md border p-3 text-sm"><p className="font-medium">Older-style tool</p><Raw summary="Show its settings" value={tool} /></li>
          ))}
        </ul>
        {skills.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <h3 className="text-sm font-semibold">Built-in skills ({skills.length})</h3>
            <ul className="flex flex-col gap-2">
              {skills.map(([name, settings]) => (
                <li key={name} className="rounded-md border p-3 text-sm"><p className="font-mono font-medium">{name}</p><Raw summary={`Show the settings for ${name}`} value={settings} /></li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section id="face" title="Face, voice and models">
        {d.face && <Unavailable what="The face" part={d.face} />}
        <Facts rows={[
          ["Face", face ? `${text(face.face_name) ?? "Unnamed"}${text(face.model_name) ? ` · ${text(face.model_name)}` : ""}${text(face.status) ? ` · ${text(face.status)}` : ""}` : null],
          ["Language model", text(layers.llm?.model)],
          ["Own language-model address", text(layers.llm?.base_url)],
          ["Voice engine", text(layers.tts?.tts_engine)],
          ["Voice", text(layers.tts?.voice_id) ?? text(layers.tts?.external_voice_id)],
          ["Speech recognition", text(layers.stt?.stt_engine)],
          ["Words to listen for", text(layers.stt?.hotwords)],
          ["Vision model", text(layers.perception?.perception_model)],
          ["Meeting email", text(pal.conferencing_email)],
        ]} />
      </Section>

      <Section id="deployments" title="Deployments" count={d.deployments.length}>
        {d.deployments.length === 0 && <p className="text-sm text-muted-foreground">This avatar has no deployments.</p>}
        <ul className="flex flex-col gap-2">
          {d.deployments.map((dep) => (
            <li key={dep.deployment_id} className="flex flex-col gap-1.5 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{dep.name || dep.channel}<span className="font-normal text-muted-foreground"> · {dep.channel}</span></p>
                <DeploymentStatusPill status={dep.status} />
              </div>
              <CopyId label="Deployment ID" value={dep.deployment_id} />
              {dep.allowed_origins.length > 0 && <p className="break-all text-muted-foreground">Allowed on: {dep.allowed_origins.join(", ")}</p>}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="everything" title="Everything Tavus returned">
        <p className="text-sm text-muted-foreground">The complete record for this avatar, for anything not laid out above. Keys and passwords are hidden.</p>
        <Raw summary="Show the full record" value={d.pal} />
      </Section>
    </>
  )
}

/** One avatar, with everything Tavus holds about it, so staff rarely need to open Tavus. */
export default function AvatarDetail() {
  const { palId = "" } = useParams()
  const detail = useQuery({ queryKey: ["pal-detail", palId], queryFn: () => getPalDetail(palId), staleTime: 60_000 })
  const name = detail.data ? (text(detail.data.pal.pal_name) ?? "Avatar") : "Avatar"
  return (
    <>
      <PageHeader
        back={{ to: "/admin/avatars", label: "Avatars" }}
        title={name}
        description={detail.data ? `Read from Tavus ${formatDateTime(detail.data.fetched_at, zone)}. Nothing here can be changed from this page.` : "Reading this avatar from Tavus."}
        actions={<Button variant="outline" className="min-h-10" onClick={() => void detail.refetch()} disabled={detail.isFetching}><RefreshCw aria-hidden="true" />{detail.isFetching ? "Reading…" : "Read again"}</Button>}
      />
      {detail.isPending ? <LoadingBlock label="Reading from Tavus" /> : detail.isError ? <ErrorBlock error={detail.error} onRetry={() => void detail.refetch()} /> : <Detail d={detail.data} />}
    </>
  )
}
