import type { CommissionConfig, CommissionMode } from "@/types/db"

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n)
}

/** Returns the actual dollar amount earned for a single qualified referral's one-time commission. */
export function calcOneTimeCommission(cfg: CommissionConfig): number {
  return cfg.one_time_mode === "flat"
    ? cfg.one_time_value
    : (cfg.implementation_fee * cfg.one_time_value) / 100
}

/** Returns the per-month recurring commission per active client. */
export function calcRecurringCommissionPerMonth(cfg: CommissionConfig): number {
  return cfg.recurring_mode === "flat"
    ? cfg.recurring_value
    : (cfg.monthly_service_fee * cfg.recurring_value) / 100
}

/** Human-readable label for the one-time commission (e.g. "$1,000" or "35% of $6,000 = $2,100"). */
export function describeOneTime(cfg: CommissionConfig): string {
  const amount = calcOneTimeCommission(cfg)
  if (cfg.one_time_mode === "flat") return formatMoney(amount)
  return `${cfg.one_time_value}% of ${formatMoney(cfg.implementation_fee)} = ${formatMoney(amount)}`
}

/** Human-readable label for the recurring commission. */
export function describeRecurring(cfg: CommissionConfig): string {
  const amount = calcRecurringCommissionPerMonth(cfg)
  const base =
    cfg.recurring_mode === "flat"
      ? `${formatMoney(amount)}/mo`
      : `${cfg.recurring_value}% of ${formatMoney(cfg.monthly_service_fee)}/mo = ${formatMoney(amount)}/mo`
  return cfg.recurring_duration.kind === "indefinite"
    ? `${base} · life of engagement`
    : `${base} · ${cfg.recurring_duration.months} months`
}

export function describeCommissionMode(mode: CommissionMode): string {
  return mode === "flat" ? "Flat amount" : "Percent of base"
}
