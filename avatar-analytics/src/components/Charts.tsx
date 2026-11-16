// The two charts on the dashboards: who used the talk time (a ring), and how
// it was spread over time (columns). Each has a legend or title, hover
// details, and a "Show as table" view, so nothing depends on colour or on a
// mouse.

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { TableScroll } from "@/components/TableScroll"
import { Button } from "@/components/ui/button"
import type { Column } from "@/lib/buckets"
import { percent } from "@/lib/format"
import { niceScale } from "@/lib/scale"

export type Slice = { id: string; label: string; value: number; color: string }

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/** A card with a chart and a button that swaps it for the same data as a table. */
export function ChartCard({
  title,
  subtitle,
  chart,
  table,
}: {
  title: string
  subtitle?: string
  chart: ReactNode
  table: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={headingId} className="font-sans text-base font-semibold">{title}</h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Button variant="ghost" size="sm" className="min-h-9 text-primary-text" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show as chart" : "Show as table"}
        </Button>
      </div>
      {asTable ? <TableScroll label={`${title}, as a table`}>{table}</TableScroll> : chart}
    </section>
  )
}

type Tip = { x: number; y: number; title: string; lines: string[] } | null

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <p className="font-semibold whitespace-nowrap">{tip.title}</p>
      {tip.lines.map((line) => (
        <p key={line} className="tabular whitespace-nowrap text-muted-foreground">{line}</p>
      ))}
    </div>
  )
}

// ── Ring: share of talk time by avatar ───────────────────────────────────────

function arc(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number): string {
  const point = (r: number, a: number) => `${cx + r * Math.sin(a)} ${cy - r * Math.cos(a)}`
  const large = end - start > Math.PI ? 1 : 0
  return [
    `M ${point(rOuter, start)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${point(rOuter, end)}`,
    `L ${point(rInner, end)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${point(rInner, start)}`,
    "Z",
  ].join(" ")
}

export function Donut({
  slices,
  centerValue,
  centerLabel,
  unit,
}: {
  slices: Slice[]
  centerValue: string
  centerLabel: string
  unit: string
}) {
  const [tip, setTip] = useState<Tip>(null)
  const [active, setActive] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const size = 184
  const c = size / 2
  const rOuter = 84
  const rInner = 56
  // A 2px gap in the surface colour separates neighbours.
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 2 / ((rOuter + rInner) / 2) : 0

  const visible = slices.filter((s) => s.value > 0)
  const paths = visible.map((s, i) => {
      const before = visible.slice(0, i).reduce((sum, v) => sum + v.value, 0)
      const angle = (before / total) * Math.PI * 2
      const sweep = (s.value / total) * Math.PI * 2
      const start = angle + gap / 2
      const end = Math.max(start + 0.001, angle + sweep - gap / 2)
      // A full circle cannot be drawn as one arc.
      const d = sweep >= Math.PI * 2 - 0.0001
        ? arc(c, c, rOuter, rInner, 0, Math.PI) + " " + arc(c, c, rOuter, rInner, Math.PI, Math.PI * 2)
        : arc(c, c, rOuter, rInner, start, end)
      return { slice: s, d }
    })

  const summary = total
    ? slices.filter((s) => s.value > 0).map((s) => `${s.label} ${Math.round(s.value)} ${unit}, ${percent(s.value, total)}`).join("; ")
    : "No talk time in this period"

  function show(e: React.MouseEvent, s: Slice) {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    setActive(s.id)
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title: s.label, lines: [`${Math.round(s.value).toLocaleString("en-US")} ${unit} · ${percent(s.value, total)}`] })
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div ref={wrapRef} className="relative shrink-0" onMouseLeave={() => { setTip(null); setActive(null) }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Talk time by avatar. ${summary}`}>
          {total === 0 && <circle cx={c} cy={c} r={(rOuter + rInner) / 2} fill="none" stroke="var(--chart-grid)" strokeWidth={rOuter - rInner} />}
          {paths.map(({ slice, d }) => (
            <path
              key={slice.id}
              d={d}
              fill={slice.color}
              opacity={active && active !== slice.id ? 0.45 : 1}
              onMouseMove={(e) => show(e, slice)}
            />
          ))}
          <text x={c} y={c - 2} textAnchor="middle" className="fill-foreground font-display text-[28px] font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {centerValue}
          </text>
          <text x={c} y={c + 18} textAnchor="middle" className="fill-muted-foreground text-[12px]">
            {centerLabel}
          </text>
        </svg>
        <Tooltip tip={tip} />
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-2 text-sm" aria-label="Legend">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2" onMouseEnter={() => setActive(s.id)} onMouseLeave={() => setActive(null)}>
            <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="tabular text-muted-foreground">
              {Math.round(s.value).toLocaleString("en-US")} {unit} · {percent(s.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Columns: talk time over time ─────────────────────────────────────────────

export function Columns({ columns, unit, color }: { columns: Column[]; unit: string; color: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hovered, setHover] = useState<number | null>(null)
  const hover = hovered != null && hovered < columns.length ? hovered : null
  const height = 220
  const margin = { top: 20, right: 8, bottom: 26, left: 40 }
  const innerW = Math.max(0, width - margin.left - margin.right)
  const innerH = height - margin.top - margin.bottom
  const max = Math.max(0, ...columns.map((col) => col.value))
  const { top, step } = niceScale(max)
  const band = columns.length ? innerW / columns.length : 0
  // Thin marks: never wider than 24px, always leaving air between neighbours.
  const barW = Math.max(2, Math.min(24, band - 2))
  const y = (v: number) => margin.top + innerH - (v / top) * innerH
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const peak = max > 0 ? columns.findIndex((col) => col.value === max) : -1

  // Room for about one label every 56px.
  const every = Math.max(1, Math.ceil(columns.length / Math.max(1, Math.floor(innerW / 56))))
  const total = columns.reduce((sum, col) => sum + col.value, 0)
  const fmt = (v: number) => (v < 10 && v % 1 !== 0 ? v.toFixed(1) : Math.round(v).toLocaleString("en-US"))

  const tip: Tip =
    hover != null && columns[hover]
      ? {
          x: margin.left + band * hover + band / 2,
          y: y(columns[hover].value),
          title: columns[hover].longLabel,
          lines: [`${fmt(columns[hover].value)} ${unit}`],
        }
      : null

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Talk time over time. ${fmt(total)} ${unit} in total${peak >= 0 ? `; the most was ${fmt(max)} ${unit} on ${columns[peak].longLabel}` : ""}.`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={margin.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {t.toLocaleString("en-US")}
              </text>
            </g>
          ))}
          {columns.map((col, i) => {
            const x = margin.left + band * i + (band - barW) / 2
            const h = col.value > 0 ? Math.max(2, (col.value / top) * innerH) : 0
            const r = Math.min(4, barW / 2, h)
            const yTop = margin.top + innerH - h
            return (
              <g key={col.key}>
                {h > 0 && (
                  // Rounded at the data end, square on the baseline.
                  <path
                    d={`M ${x} ${yTop + h} V ${yTop + r} Q ${x} ${yTop} ${x + r} ${yTop} H ${x + barW - r} Q ${x + barW} ${yTop} ${x + barW} ${yTop + r} V ${yTop + h} Z`}
                    fill={color}
                    opacity={hover != null && hover !== i ? 0.5 : 1}
                  />
                )}
                {i === peak && (
                  <text x={x + barW / 2} y={yTop - 6} textAnchor="middle" className="fill-foreground text-[11px] font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmt(col.value)}
                  </text>
                )}
                {(i % every === 0) && (
                  <text x={margin.left + band * i + band / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {col.label}
                  </text>
                )}
                {/* The hover target is the whole band, not just the thin bar. */}
                <rect x={margin.left + band * i} y={margin.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
              </g>
            )
          })}
          <line x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} stroke="var(--input)" strokeWidth={1} />
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  )
}

export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: Array<Array<string | number>> }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground uppercase">
          {head.map((h, i) => (
            <th key={h} scope="col" className={`px-2 py-2 font-semibold tracking-wide ${i > 0 ? "text-right" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row[0])} className="border-b last:border-0">
            {row.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row" className="px-2 py-2 text-left font-normal">{cell}</th>
              ) : (
                <td key={i} className="tabular px-2 py-2 text-right">{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
