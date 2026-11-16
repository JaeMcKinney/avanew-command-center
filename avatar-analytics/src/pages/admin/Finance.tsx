import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { TrendingDown, TrendingUp } from "lucide-react"
import { ChartCard, Columns, DataTable, Donut, RankedBars, SignedColumns } from "@/components/Charts"
import { DateRangeControl, type RangeState } from "@/components/DateRangeControl"
import { PageHeader } from "@/components/PageHeader"
import { Stat } from "@/components/Stat"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { TableScroll } from "@/components/TableScroll"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { getFinance, saveFinanceCosts, type Finance as FinanceData } from "@/lib/api"
import { seriesColor } from "@/lib/chartColors"
import { browserToday, formatRange, presetRange } from "@/lib/dates"
import { count, money, percent } from "@/lib/format"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const monthName = (iso: string, long = true) => `${long ? MONTHS[Number(iso.slice(5, 7)) - 1] : MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${iso.slice(0, 4)}`
const th = "px-4 py-2.5 font-semibold tracking-wide"

function CostsForm({ data }: { data: FinanceData }) {
  const id = useId()
  const queryClient = useQueryClient()
  const [perMinute, setPerMinute] = useState((data.cost_per_minute_cents / 100).toString())
  const [fixed, setFixed] = useState((data.fixed_monthly_cost_cents / 100).toString())
  const [problem, setProblem] = useState("")
  const save = useMutation({
    mutationFn: () => saveFinanceCosts(Math.round(Number(perMinute) * 100 * 100) / 100, Math.round(Number(fixed) * 100)),
    onSuccess: () => { toast.success("Costs saved"); void queryClient.invalidateQueries({ queryKey: ["finance"] }) },
    onError: (err) => toast.error((err as Error).message),
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!(Number(perMinute) >= 0) || !(Number(fixed) >= 0) || perMinute === "" || fixed === "") return setProblem("Enter both costs in dollars, for example 0.31 and 397.")
    setProblem("")
    save.mutate()
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-minute`}>What a minute of talk time costs you (US dollars)</Label>
          <Input id={`${id}-minute`} inputMode="decimal" value={perMinute} onChange={(e) => setPerMinute(e.target.value)} className="min-h-11 max-w-40" aria-describedby={`${id}-minute-help`} />
          <p id={`${id}-minute-help`} className="text-xs text-muted-foreground">Your Tavus price per minute. Multiplied by the minutes clients used.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-fixed`}>Fixed costs each month (US dollars)</Label>
          <Input id={`${id}-fixed`} inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} className="min-h-11 max-w-40" aria-describedby={`${id}-fixed-help`} />
          <p id={`${id}-fixed-help`} className="text-xs text-muted-foreground">Platform plans and tools you pay whatever the usage. Counted in each month that has revenue or usage.</p>
        </div>
      </div>
      {problem && <p role="alert" className="text-sm font-medium text-bad">{problem}</p>}
      <div><Button type="submit" className="min-h-10" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save costs"}</Button></div>
    </form>
  )
}

/** What clients have paid, what it cost to serve them, and what is left. */
export default function Finance() {
  const { can } = useAuth()
  const today = browserToday()
  const [state, setState] = useState<RangeState>({ preset: "year", range: presetRange("year", today) })
  const finance = useQuery({ queryKey: ["finance", state.range.from, state.range.to], queryFn: () => getFinance(state.range) })

  const body = () => {
    if (finance.isPending) return <LoadingBlock label="Loading finances" />
    if (finance.isError) return <ErrorBlock error={finance.error} onRetry={() => void finance.refetch()} />
    const f = finance.data
    const months = f.months.filter((m) => m.month.slice(0, 7) <= today.slice(0, 7))
    const total = (pick: (m: FinanceData["months"][number]) => number) => months.reduce((n, m) => n + Number(pick(m)), 0)
    const subscription = total((m) => m.subscription_cents)
    const extra = total((m) => m.extra_cents)
    const addons = total((m) => m.addon_cents)
    const revenue = subscription + extra + addons
    const usageCost = total((m) => m.usage_cost_cents)
    const fixedCost = total((m) => m.fixed_cost_cents)
    const profit = revenue - usageCost - fixedCost
    const costsSet = f.cost_per_minute_cents > 0 || f.fixed_monthly_cost_cents > 0
    const revenueOf = (m: FinanceData["months"][number]) => Number(m.subscription_cents) + Number(m.extra_cents) + Number(m.addon_cents)
    const columns = months.map((m) => ({ key: m.month, label: monthName(m.month, false).slice(0, 3), longLabel: monthName(m.month), value: Math.round(revenueOf(m) / 100) }))

    const minutesUsed = total((m) => m.minutes)
    const paying = f.clients.filter((c) => Number(c.subscription_cents) + Number(c.extra_cents) > 0)
    const margin = revenue > 0 ? percent(profit, revenue) : "0%"
    const dollars = (cents: number) => Math.round(cents / 100)
    const profitColumns = months.map((m) => ({ key: m.month, label: monthName(m.month, false).slice(0, 3), longLabel: monthName(m.month), value: dollars(revenueOf(m) - Number(m.usage_cost_cents) - Number(m.fixed_cost_cents)) }))

    return (
      <>
        {/* The answer first: are we making money? */}
        <section aria-labelledby="verdict" className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-5 sm:p-6">
          <span aria-hidden="true" className={`grid size-14 shrink-0 place-items-center rounded-full ${!costsSet ? "bg-muted text-muted-foreground" : profit >= 0 ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
            {costsSet && profit < 0 ? <TrendingDown className="size-7" /> : <TrendingUp className="size-7" />}
          </span>
          <div className="min-w-0 flex-1 basis-72">
            <h2 id="verdict" className="text-2xl font-semibold sm:text-3xl">
              {!costsSet ? `${money(revenue)} came in` : profit >= 0 ? `Profitable: ${money(profit)} profit` : `Losing money: ${money(-profit)} loss`}
            </h2>
            <p className="text-muted-foreground">
              {!costsSet
                ? "Enter your costs at the bottom of this page to see whether that is a profit."
                : `${money(revenue)} of revenue against ${money(usageCost + fixedCost)} of costs, a ${margin} margin. ${formatRange(state.range)}.`}
            </p>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Revenue" value={money(revenue)} note={formatRange(state.range)} />
          <Stat label="Costs" value={costsSet ? money(usageCost + fixedCost) : "—"} note={costsSet ? `${money(usageCost)} usage · ${money(fixedCost)} fixed` : "Not entered yet"} />
          <Stat label="Profit" value={costsSet ? money(profit) : "—"} note={costsSet ? (profit >= 0 ? "After all costs" : "Costs are higher than revenue") : "Needs your costs"} highlight={costsSet} />
          <Stat label="Margin" value={costsSet ? margin : "—"} note="Profit as a share of revenue" />
          <Stat label="Recurring each month" value={money(f.mrr_cents)} note={`${count(f.subscribers)} subscribing client${f.subscribers === 1 ? "" : "s"}${f.ending_mrr_cents > 0 ? ` · ${money(f.ending_mrr_cents)} ending` : ""}`} />
          <Stat label="Average per paying client" value={paying.length ? money(revenue / paying.length) : "—"} note={`${count(paying.length)} paying client${paying.length === 1 ? "" : "s"} in this period`} />
          <Stat label="Earned per minute" value={minutesUsed > 0 ? money(revenue / minutesUsed) : "—"} note={f.cost_per_minute_cents > 0 ? `Each minute costs you ${money(f.cost_per_minute_cents)}` : `${count(minutesUsed)} minutes used`} />
          <Stat label="Payments to chase" value={count(f.past_due)} note={f.past_due === 0 ? "Nobody is behind" : "Clients with a failed or late payment"} />
        </div>

        {revenue === 0 && minutesUsed === 0 ? (
          <EmptyState title="Nothing in this period yet">Revenue appears here as Stripe confirms each payment. Choose a longer period to look further back.</EmptyState>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Where revenue came from"
                subtitle={formatRange(state.range)}
                chart={<Donut unit="" centerValue={money(revenue)} centerLabel="revenue" slices={[
                  { id: "subscription", label: "Packages", value: dollars(subscription), color: seriesColor(0) },
                  { id: "extra", label: "Extra minutes", value: dollars(extra), color: seriesColor(1) },
                  { id: "addons", label: "Add-ons", value: dollars(addons), color: seriesColor(2) },
                ]} />}
                table={<DataTable caption="Revenue by source" head={["Source", "Revenue", "Share"]} rows={[
                  ["Monthly packages (including setup fees)", money(subscription), percent(subscription, revenue)],
                  ["Extra minutes", money(extra), percent(extra, revenue)],
                  ["Add-ons (not sold yet)", money(addons), percent(addons, revenue)],
                ]} />}
              />
              {costsSet && profit >= 0 ? (
                <ChartCard
                  title="Where each dollar went"
                  subtitle="Revenue split into costs and what is left"
                  chart={<Donut unit="" centerValue={margin} centerLabel="margin" slices={[
                    { id: "profit", label: "Profit", value: dollars(profit), color: seriesColor(2) },
                    { id: "usage", label: "Usage cost", value: dollars(usageCost), color: seriesColor(1) },
                    { id: "fixed", label: "Fixed costs", value: dollars(fixedCost), color: seriesColor(3) },
                  ]} />}
                  table={<DataTable caption="Where each dollar went" head={["Part", "Amount", "Share of revenue"]} rows={[
                    ["Profit", money(profit), percent(profit, revenue)],
                    ["Usage cost", money(usageCost), percent(usageCost, revenue)],
                    ["Fixed costs", money(fixedCost), percent(fixedCost, revenue)],
                  ]} />}
                />
              ) : (
                <section aria-labelledby="dollar-went" className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:p-5">
                  <h3 id="dollar-went" className="font-sans text-base font-semibold">Where each dollar went</h3>
                  <p className="text-sm text-muted-foreground">
                    {costsSet ? `Costs of ${money(usageCost + fixedCost)} are higher than revenue of ${money(revenue)}, so there is no profit to show as a share.` : "Enter your costs at the bottom of this page to see how each dollar splits between costs and profit."}
                  </p>
                </section>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Revenue by month"
                subtitle="In dollars, when Stripe received each payment"
                chart={<Columns columns={columns} unit="dollars" color={seriesColor(0)} label="Revenue by month" />}
                table={<DataTable caption="Revenue by month" head={["Month", "Revenue"]} rows={months.map((m) => [monthName(m.month), money(revenueOf(m))])} />}
              />
              {costsSet ? (
                <ChartCard
                  title="Profit by month"
                  subtitle="Above the line is profit; below it is a loss"
                  chart={<SignedColumns columns={profitColumns} label="Profit by month" format={(v) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US")}`} />}
                  table={<DataTable caption="Profit by month" head={["Month", "Revenue", "Costs", "Profit"]} rows={months.map((m) => [monthName(m.month), money(revenueOf(m)), money(Number(m.usage_cost_cents) + Number(m.fixed_cost_cents)), money(revenueOf(m) - Number(m.usage_cost_cents) - Number(m.fixed_cost_cents))])} />}
                />
              ) : (
                <section aria-labelledby="profit-month" className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:p-5">
                  <h3 id="profit-month" className="font-sans text-base font-semibold">Profit by month</h3>
                  <p className="text-sm text-muted-foreground">Enter your costs at the bottom of this page to see profit for each month.</p>
                </section>
              )}
            </div>

            {f.clients.length > 0 && (
              <section aria-labelledby="client-bars" className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
                <div>
                  <h3 id="client-bars" className="font-sans text-base font-semibold">Revenue by client</h3>
                  <p className="text-sm text-muted-foreground">Who pays the most in this period{f.cost_per_minute_cents > 0 ? ", with each client's margin after usage cost" : ""}.</p>
                </div>
                <RankedBars
                  label="Revenue by client" color={seriesColor(0)}
                  bars={f.clients.map((c) => {
                    const paid = Number(c.subscription_cents) + Number(c.extra_cents)
                    return { id: c.id, label: c.name, value: paid, display: money(paid), detail: f.cost_per_minute_cents > 0 && paid > 0 ? `${percent(paid - Number(c.usage_cost_cents), paid)} margin` : `${count(c.minutes)} min used` }
                  })}
                />
              </section>
            )}

            <h2 className="text-xl font-semibold">The detail</h2>
            <section aria-labelledby="by-month" className="flex flex-col gap-3">
              <h3 id="by-month" className="text-lg font-semibold">Month by month</h3>
              <TableScroll label="Month by month table" className="rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <caption className="sr-only">Revenue, cost and profit for each month</caption>
                  <thead>
                    <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                      <th scope="col" className={th}>Month</th>
                      <th scope="col" className={`${th} text-right`}>Packages</th>
                      <th scope="col" className={`${th} text-right`}>Extra minutes</th>
                      <th scope="col" className={`${th} text-right`}>Add-ons</th>
                      <th scope="col" className={`${th} text-right`}>Revenue</th>
                      <th scope="col" className={`${th} text-right`}>Minutes used</th>
                      <th scope="col" className={`${th} text-right`}>Costs</th>
                      <th scope="col" className={`${th} text-right`}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...months].reverse().map((m) => {
                      const cost = Number(m.usage_cost_cents) + Number(m.fixed_cost_cents)
                      return (
                        <tr key={m.month} className="border-b last:border-0">
                          <th scope="row" className="px-4 py-3 text-left font-medium whitespace-nowrap">{monthName(m.month)}</th>
                          <td className="tabular px-4 py-3 text-right">{money(m.subscription_cents)}</td>
                          <td className="tabular px-4 py-3 text-right">{money(m.extra_cents)}</td>
                          <td className="tabular px-4 py-3 text-right">{money(m.addon_cents)}</td>
                          <td className="tabular px-4 py-3 text-right font-semibold">{money(revenueOf(m))}</td>
                          <td className="tabular px-4 py-3 text-right">{count(m.minutes)}</td>
                          <td className="tabular px-4 py-3 text-right">{costsSet ? money(cost) : "—"}</td>
                          <td className="tabular px-4 py-3 text-right font-semibold">{costsSet ? money(revenueOf(m) - cost) : "—"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/40 font-semibold">
                      <th scope="row" className="px-4 py-3 text-left">Total</th>
                      <td className="tabular px-4 py-3 text-right">{money(subscription)}</td>
                      <td className="tabular px-4 py-3 text-right">{money(extra)}</td>
                      <td className="tabular px-4 py-3 text-right">{money(addons)}</td>
                      <td className="tabular px-4 py-3 text-right">{money(revenue)}</td>
                      <td className="tabular px-4 py-3 text-right">{count(total((m) => m.minutes))}</td>
                      <td className="tabular px-4 py-3 text-right">{costsSet ? money(usageCost + fixedCost) : "—"}</td>
                      <td className="tabular px-4 py-3 text-right">{costsSet ? money(profit) : "—"}</td>
                    </tr>
                  </tfoot>
                </table>
              </TableScroll>
            </section>

            <section aria-labelledby="by-client" className="flex flex-col gap-3">
              <h3 id="by-client" className="text-lg font-semibold">Client by client</h3>
              <TableScroll label="Client by client table" className="rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <caption className="sr-only">Revenue, usage cost and margin for each client in this period</caption>
                  <thead>
                    <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                      <th scope="col" className={th}>Client</th>
                      <th scope="col" className={`${th} text-right`}>Packages</th>
                      <th scope="col" className={`${th} text-right`}>Extra minutes</th>
                      <th scope="col" className={`${th} text-right`}>Revenue</th>
                      <th scope="col" className={`${th} text-right`}>Minutes used</th>
                      <th scope="col" className={`${th} text-right`}>Usage cost</th>
                      <th scope="col" className={`${th} text-right`}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.clients.map((c) => {
                      const paid = Number(c.subscription_cents) + Number(c.extra_cents)
                      return (
                        <tr key={c.id} className="border-b last:border-0">
                          <th scope="row" className="px-4 py-3 text-left font-medium"><Link to={`/admin/clients/${c.slug}`} className="text-primary-text hover:underline">{c.name}</Link></th>
                          <td className="tabular px-4 py-3 text-right">{money(c.subscription_cents)}</td>
                          <td className="tabular px-4 py-3 text-right">{money(c.extra_cents)}</td>
                          <td className="tabular px-4 py-3 text-right font-semibold">{money(paid)}</td>
                          <td className="tabular px-4 py-3 text-right">{count(c.minutes)}</td>
                          <td className="tabular px-4 py-3 text-right">{f.cost_per_minute_cents > 0 ? money(c.usage_cost_cents) : "—"}</td>
                          <td className="tabular px-4 py-3 text-right">{f.cost_per_minute_cents > 0 && paid > 0 ? percent(paid - Number(c.usage_cost_cents), paid) : "—"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableScroll>
              <p className="text-xs text-muted-foreground">Client margins count usage cost only. Fixed costs are taken off in the monthly totals above.</p>
            </section>
          </>
        )}

        <section aria-labelledby="costs" className="flex flex-col gap-3">
          <h2 id="costs" className="text-lg font-semibold">Your costs</h2>
          {can("settings.manage") ? <CostsForm key={`${f.cost_per_minute_cents}-${f.fixed_monthly_cost_cents}`} data={f} /> : (
            <p className="text-sm text-muted-foreground">{money(f.cost_per_minute_cents)} a minute and {money(f.fixed_monthly_cost_cents)} a month in fixed costs. Only people who can change settings can edit these.</p>
          )}
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Finance" description="Whether we are making money: revenue, costs, profit and margin for the period you choose. Figures come from payments Stripe has confirmed." />
      <DateRangeControl value={state} onChange={setState} today={today} />
      {body()}
    </>
  )
}
