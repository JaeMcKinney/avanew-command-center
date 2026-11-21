// Glass Health usage totals. Kept apart from api.ts so the sums can be tested without a database.

export type GlassTotals = { questions: number; failed: number; input_tokens: number; output_tokens: number; duration_ms: number; cost_cents: number | null }

/** Adds rows up. The cost stays empty unless at least one row has one. */
export function sumGlass(rows: Iterable<GlassTotals>): GlassTotals {
  const total: GlassTotals = { questions: 0, failed: 0, input_tokens: 0, output_tokens: 0, duration_ms: 0, cost_cents: null }
  for (const r of rows) {
    total.questions += r.questions
    total.failed += r.failed
    total.input_tokens += r.input_tokens
    total.output_tokens += r.output_tokens
    total.duration_ms += r.duration_ms
    if (r.cost_cents != null) total.cost_cents = (total.cost_cents ?? 0) + r.cost_cents
  }
  return total
}
