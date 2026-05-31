import { useState } from "react"
import type { FormEvent } from "react"
import { ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { saveRaBanking } from "@/lib/data"
import type { RaAssociate } from "@/types/db"

type Props = {
  ra: RaAssociate
  onComplete: (updated: Partial<RaAssociate>) => void
}

export function BankingStep({ ra, onComplete }: Props) {
  const [holder, setHolder] = useState(ra.ach_account_holder ?? "")
  const [bankName, setBankName] = useState(ra.ach_bank_name ?? "")
  const [routing, setRouting] = useState(ra.ach_routing ?? "")
  const [account, setAccount] = useState(ra.ach_account ?? "")
  const [showRouting, setShowRouting] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [saving, setSaving] = useState(false)

  const routingValid = /^\d{9}$/.test(routing)
  const accountValid = /^\d{4,17}$/.test(account)

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(160,190,215,.18)",
    borderRadius: "8px",
    color: "#EAF2F9",
    padding: "10px 14px",
    fontSize: "15px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "'Manrope', sans-serif",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#A2B6C9",
    marginBottom: "6px",
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!routingValid) { toast.error("Routing number must be exactly 9 digits"); return }
    if (!accountValid) { toast.error("Account number must be 4–17 digits"); return }
    setSaving(true)
    try {
      await saveRaBanking(ra.id, {
        ach_account_holder: holder.trim(),
        ach_bank_name: bankName.trim(),
        ach_routing: routing.trim(),
        ach_account: account.trim(),
      })
      onComplete({
        ach_account_holder: holder.trim(),
        ach_bank_name: bankName.trim(),
        ach_routing: routing.trim(),
        ach_account: account.trim(),
        banking_completed: true,
      })
      toast.success("Banking details saved!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(95,227,210,.7)" }}>
          Step 3 of 4
        </p>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 600, color: "#EAF2F9" }}>
          Banking details
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "#A2B6C9", lineHeight: 1.6 }}>
          Your earnings are paid via ACH direct deposit. Provide your bank account details below.
        </p>
      </div>

      {/* Security callout */}
      <div style={{
        display: "flex", gap: "12px", alignItems: "flex-start",
        background: "rgba(52,214,194,.07)", border: "1px solid rgba(52,214,194,.2)",
        borderRadius: "10px", padding: "14px 16px",
      }}>
        <ShieldCheck style={{ width: 16, height: 16, color: "#34D6C2", flexShrink: 0, marginTop: "1px" }} />
        <p style={{ margin: 0, fontSize: "12px", color: "#A2B6C9", lineHeight: 1.6 }}>
          Your banking info is <strong style={{ color: "#EAF2F9" }}>encrypted at rest</strong> and only visible to Divigner administrators. It is never shared with third parties or displayed publicly.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div>
          <label style={labelStyle}>Account holder name <span style={{ color: "#f87171" }}>*</span></label>
          <input
            type="text"
            required
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="Full legal name on the account"
            style={inputStyle}
            autoComplete="name"
          />
        </div>

        <div>
          <label style={labelStyle}>Bank name <span style={{ color: "#f87171" }}>*</span></label>
          <input
            type="text"
            required
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g. Chase, Wells Fargo, Bank of America"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Routing number <span style={{ color: "#f87171" }}>*</span></label>
          <div style={{ position: "relative" }}>
            <input
              type={showRouting ? "text" : "password"}
              required
              value={routing}
              onChange={(e) => setRouting(e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="9-digit ABA routing number"
              style={{
                ...inputStyle,
                paddingRight: "42px",
                border: routing && !routingValid ? "1px solid rgba(248,113,113,.6)" : inputStyle.border,
              }}
              inputMode="numeric"
            />
            <button type="button" onClick={() => setShowRouting(!showRouting)}
              style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6E8499", padding: 0, display: "flex" }}>
              {showRouting ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
          {routing && !routingValid && (
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#f87171" }}>Must be exactly 9 digits</p>
          )}
        </div>

        <div>
          <label style={labelStyle}>Account number <span style={{ color: "#f87171" }}>*</span></label>
          <div style={{ position: "relative" }}>
            <input
              type={showAccount ? "text" : "password"}
              required
              value={account}
              onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, 17))}
              placeholder="Checking or savings account number"
              style={{
                ...inputStyle,
                paddingRight: "42px",
                border: account && !accountValid ? "1px solid rgba(248,113,113,.6)" : inputStyle.border,
              }}
              inputMode="numeric"
            />
            <button type="button" onClick={() => setShowAccount(!showAccount)}
              style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6E8499", padding: 0, display: "flex" }}>
              {showAccount ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
          {account && !accountValid && (
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#f87171" }}>Must be 4–17 digits</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || !routingValid || !accountValid}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          background: saving || !routingValid || !accountValid ? "rgba(52,214,194,.35)" : "linear-gradient(135deg,#18B9A6,#34D6C2)",
          border: "none", borderRadius: "10px", padding: "13px",
          fontSize: "15px", fontWeight: 700, color: "#06101D",
          cursor: saving || !routingValid || !accountValid ? "not-allowed" : "pointer",
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        {saving
          ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Saving…</>
          : "Save & continue →"}
      </button>
    </form>
  )
}
