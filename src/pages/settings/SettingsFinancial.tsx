import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Landmark, ExternalLink, Percent, Save, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/PageHeader"
import {
  DEFAULT_COMMISSION_CONFIG,
  getCommissionConfig,
  saveCommissionConfig,
} from "@/lib/data"
import { describeOneTime, describeRecurring } from "@/lib/commissions"
import type { CommissionConfig, CommissionMode } from "@/types/db"
import { toast } from "sonner"

type DurationKind = "indefinite" | "months"

export function SettingsFinancial() {
  const [cfg, setCfg] = useState<CommissionConfig>(DEFAULT_COMMISSION_CONFIG)
  const [durationKind, setDurationKind] = useState<DurationKind>("indefinite")
  const [durationMonths, setDurationMonths] = useState<number>(12)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCommissionConfig().then((loaded) => {
      setCfg(loaded)
      setDurationKind(loaded.recurring_duration.kind)
      if (loaded.recurring_duration.kind === "months") {
        setDurationMonths(loaded.recurring_duration.months)
      }
    })
  }, [])

  function update<K extends keyof CommissionConfig>(key: K, value: CommissionConfig[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const recurring_duration: CommissionConfig["recurring_duration"] =
        durationKind === "indefinite"
          ? { kind: "indefinite" }
          : { kind: "months", months: Math.max(1, Math.floor(durationMonths || 1)) }
      const saved = await saveCommissionConfig({ ...cfg, recurring_duration })
      setCfg(saved)
      setDirty(false)
      toast.success("Commission settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setCfg(DEFAULT_COMMISSION_CONFIG)
    setDurationKind(DEFAULT_COMMISSION_CONFIG.recurring_duration.kind)
    setDurationMonths(12)
    setDirty(true)
  }

  const previewCfg: CommissionConfig = {
    ...cfg,
    recurring_duration:
      durationKind === "indefinite" ? { kind: "indefinite" } : { kind: "months", months: durationMonths || 1 },
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Financial Settings"
        description="Manage bank connections, sync credentials, and commission structure."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Referral Commission Structure
          </CardTitle>
          <CardDescription>
            Drives commission display across admin views, RA dashboards, the public referral page, and the
            signed Referral Associate Agreement. Bump the agreement version when these terms change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Live preview */}
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
            <p className="font-medium text-foreground text-[13px]">Live preview</p>
            <p className="text-muted-foreground">
              <span className="text-foreground">One-time:</span> {describeOneTime(previewCfg)}
            </p>
            <p className="text-muted-foreground">
              <span className="text-foreground">Recurring:</span> {describeRecurring(previewCfg)}
            </p>
            <p className="text-muted-foreground">
              <span className="text-foreground">Attribution window:</span>{" "}
              {previewCfg.attribution_window_days} days
            </p>
          </div>

          {/* One-time */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">One-time referral commission</h4>
              <Badge variant="outline" className="text-[10px]">
                Per qualified referral
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="one_time_mode" className="text-xs">Type</Label>
                <Select
                  value={cfg.one_time_mode}
                  onValueChange={(v) => update("one_time_mode", v as CommissionMode)}
                >
                  <SelectTrigger id="one_time_mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat amount ($)</SelectItem>
                    <SelectItem value="percent">Percent of implementation fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="one_time_value" className="text-xs">
                  {cfg.one_time_mode === "flat" ? "Amount ($)" : "Percent (%)"}
                </Label>
                <Input
                  id="one_time_value"
                  type="number"
                  min={0}
                  step={cfg.one_time_mode === "flat" ? 50 : 0.5}
                  value={cfg.one_time_value}
                  onChange={(e) => update("one_time_value", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="implementation_fee" className="text-xs">Implementation fee base ($)</Label>
                <Input
                  id="implementation_fee"
                  type="number"
                  min={0}
                  step={100}
                  value={cfg.implementation_fee}
                  onChange={(e) => update("implementation_fee", Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Recurring */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Recurring monthly commission</h4>
              <Badge variant="outline" className="text-[10px]">
                Per active client
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="recurring_mode" className="text-xs">Type</Label>
                <Select
                  value={cfg.recurring_mode}
                  onValueChange={(v) => update("recurring_mode", v as CommissionMode)}
                >
                  <SelectTrigger id="recurring_mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat amount ($/mo)</SelectItem>
                    <SelectItem value="percent">Percent of monthly service fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recurring_value" className="text-xs">
                  {cfg.recurring_mode === "flat" ? "Amount ($/mo)" : "Percent (%)"}
                </Label>
                <Input
                  id="recurring_value"
                  type="number"
                  min={0}
                  step={cfg.recurring_mode === "flat" ? 5 : 0.5}
                  value={cfg.recurring_value}
                  onChange={(e) => update("recurring_value", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monthly_service_fee" className="text-xs">Monthly service fee base ($)</Label>
                <Input
                  id="monthly_service_fee"
                  type="number"
                  min={0}
                  step={25}
                  value={cfg.monthly_service_fee}
                  onChange={(e) => update("monthly_service_fee", Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="duration_kind" className="text-xs">Duration</Label>
                <Select
                  value={durationKind}
                  onValueChange={(v) => {
                    setDurationKind(v as DurationKind)
                    setDirty(true)
                  }}
                >
                  <SelectTrigger id="duration_kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indefinite">Indefinite (life of engagement)</SelectItem>
                    <SelectItem value="months">Fixed number of months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {durationKind === "months" && (
                <div className="space-y-1.5">
                  <Label htmlFor="duration_months" className="text-xs">Months</Label>
                  <Input
                    id="duration_months"
                    type="number"
                    min={1}
                    step={1}
                    value={durationMonths}
                    onChange={(e) => {
                      setDurationMonths(Number(e.target.value))
                      setDirty(true)
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Operational */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="text-sm font-medium">Attribution & program thresholds</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="attribution_window_days" className="text-xs">
                  Attribution window (days)
                </Label>
                <Input
                  id="attribution_window_days"
                  type="number"
                  min={1}
                  step={1}
                  value={cfg.attribution_window_days}
                  onChange={(e) => update("attribution_window_days", Number(e.target.value))}
                />
                <p className="text-[11px] text-muted-foreground/80">
                  Submitted leads stay attributed for this many days.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="annual_minimum_referrals" className="text-xs">
                  Annual minimum qualified referrals
                </Label>
                <Input
                  id="annual_minimum_referrals"
                  type="number"
                  min={0}
                  step={1}
                  value={cfg.annual_minimum_referrals}
                  onChange={(e) => update("annual_minimum_referrals", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checkin_warning_days" className="text-xs">
                  Quarterly check-in warning (days)
                </Label>
                <Input
                  id="checkin_warning_days"
                  type="number"
                  min={1}
                  step={1}
                  value={cfg.checkin_warning_days}
                  onChange={(e) => update("checkin_warning_days", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checkin_suspension_days" className="text-xs">
                  Recurring suspension (days)
                </Label>
                <Input
                  id="checkin_suspension_days"
                  type="number"
                  min={1}
                  step={1}
                  value={cfg.checkin_suspension_days}
                  onChange={(e) => update("checkin_suspension_days", Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Version */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="text-sm font-medium">Agreement version</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="agreement_version" className="text-xs">Current version tag</Label>
                <Input
                  id="agreement_version"
                  type="text"
                  value={cfg.agreement_version}
                  onChange={(e) => update("agreement_version", e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground/80">
                  Bumping this prompts active RAs to re-accept the agreement on next login.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to defaults
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Bank Integrations
          </CardTitle>
          <CardDescription>
            Connect Mercury or Plaid to automatically sync transactions into Cashflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Manage Connections</p>
              <p className="text-xs text-muted-foreground">Add Mercury or Plaid-linked bank accounts.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/cashflow/bank-connections">
                Open Bank Connections
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground text-[13px]">Required environment variables</p>
            <div className="space-y-1.5 font-mono">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">Mercury</Badge>
                <span><code>MERCURY_API_KEY</code> — read-only API token from Mercury Settings › API</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">Plaid</Badge>
                <span>
                  <code>PLAID_CLIENT_ID</code>, <code>PLAID_SECRET</code>, <code>PLAID_ENV</code>{" "}
                  (sandbox | development | production)
                </span>
              </div>
            </div>
            <p className="pt-1 text-[11px]">
              Set these in Supabase Dashboard › Edge Functions › Secrets. They are never exposed to the frontend.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync Settings</CardTitle>
          <CardDescription>Configure how frequently transactions are fetched and how far back to sync.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10 rounded-lg border border-dashed border-border">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Sync schedule and history window</p>
              <p className="text-xs text-muted-foreground/60">Coming soon</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
