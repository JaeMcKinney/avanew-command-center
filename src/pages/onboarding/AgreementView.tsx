import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Download, Loader2, Printer } from "lucide-react"
import { getCommissionConfig } from "@/lib/data"
import { getAgreementSections } from "@/lib/raAgreement"
import type { CommissionConfig } from "@/types/db"

/**
 * Standalone, printer-friendly view of the Referral Associate Agreement.
 *
 * Opened in a new tab from the onboarding Agreement step so RAs can read the
 * full document outside the cramped 420px scroll box. `?print=1` auto-opens
 * the browser print dialog (used by the "Download PDF" button) — users pick
 * "Save as PDF" as the destination.
 */
export function AgreementView() {
  const [cfg, setCfg] = useState<CommissionConfig | null>(null)
  const [params] = useSearchParams()
  const autoPrint = params.get("print") === "1"

  useEffect(() => {
    getCommissionConfig().then(setCfg)
  }, [])

  useEffect(() => {
    if (cfg && autoPrint) {
      const t = setTimeout(() => window.print(), 300)
      return () => clearTimeout(t)
    }
  }, [cfg, autoPrint])

  useEffect(() => {
    document.title = "Divigner Referral Associate Agreement"
  }, [])

  const sections = useMemo(() => (cfg ? getAgreementSections(cfg) : []), [cfg])

  if (!cfg) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#06101D",
      }}>
        <Loader2 style={{ color: "#34D6C2", width: 28, height: 28, animation: "spin 1s linear infinite" }} />
      </div>
    )
  }

  return (
    <div className="agreement-view">
      <style>{`
        .agreement-view {
          min-height: 100vh;
          background: #06101D;
          color: #C8D5E0;
          font-family: 'Manrope', sans-serif;
          padding: 32px 20px 80px;
        }
        .agreement-view__toolbar {
          position: sticky;
          top: 0;
          z-index: 10;
          max-width: 820px;
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(6,16,29,.92);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(160,190,215,.15);
          border-radius: 12px;
        }
        .agreement-view__toolbar-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(95,227,210,.7);
        }
        .agreement-view__toolbar-actions {
          display: flex;
          gap: 8px;
        }
        .agreement-view__btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg,#18B9A6,#34D6C2);
          color: #06101D;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Manrope', sans-serif;
        }
        .agreement-view__btn--ghost {
          background: transparent;
          color: #A2B6C9;
          border: 1px solid rgba(160,190,215,.25);
        }
        .agreement-view__doc {
          max-width: 820px;
          margin: 0 auto;
          background: rgba(0,0,0,.18);
          border: 1px solid rgba(160,190,215,.15);
          border-radius: 14px;
          padding: 48px 56px;
          font-size: 14px;
          line-height: 1.75;
        }
        .agreement-view__header {
          text-align: center;
          margin-bottom: 36px;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(160,190,215,.15);
        }
        .agreement-view__eyebrow {
          margin: 0 0 6px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #5FE3D2;
        }
        .agreement-view__title {
          margin: 0 0 6px;
          font-size: 26px;
          font-weight: 600;
          color: #EAF2F9;
          font-family: 'Fraunces', serif;
        }
        .agreement-view__version {
          margin: 0;
          font-size: 12px;
          color: #6E8499;
        }
        .agreement-view__section {
          margin-bottom: 26px;
        }
        .agreement-view__section-title {
          margin: 0 0 10px;
          font-size: 15px;
          font-weight: 700;
          color: #EAF2F9;
          letter-spacing: 0.02em;
        }
        .agreement-view__section p {
          margin: 0 0 12px;
          color: #C8D5E0;
        }
        .agreement-view__footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid rgba(160,190,215,.15);
          font-size: 13px;
          color: #6E8499;
        }
        .agreement-view__footer strong {
          color: #A2B6C9;
        }

        @media print {
          .agreement-view {
            background: #ffffff !important;
            color: #1a1a1a !important;
            padding: 0 !important;
          }
          .agreement-view__toolbar { display: none !important; }
          .agreement-view__doc {
            max-width: none !important;
            margin: 0 !important;
            background: #ffffff !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 24px 0 !important;
            font-size: 11pt !important;
          }
          .agreement-view__header { border-bottom-color: #999 !important; }
          .agreement-view__eyebrow { color: #555 !important; }
          .agreement-view__title { color: #000 !important; font-family: 'Fraunces', Georgia, serif !important; }
          .agreement-view__version { color: #555 !important; }
          .agreement-view__section-title { color: #000 !important; }
          .agreement-view__section p { color: #1a1a1a !important; }
          .agreement-view__footer { border-top-color: #999 !important; color: #333 !important; }
          .agreement-view__footer strong { color: #000 !important; }
          .agreement-view__section { page-break-inside: avoid; }
        }
      `}</style>

      <div className="agreement-view__toolbar">
        <span className="agreement-view__toolbar-label">Divigner Group · {cfg.agreement_version}</span>
        <div className="agreement-view__toolbar-actions">
          <button
            type="button"
            className="agreement-view__btn agreement-view__btn--ghost"
            onClick={() => window.close()}
          >
            Close tab
          </button>
          <button
            type="button"
            className="agreement-view__btn"
            onClick={() => window.print()}
          >
            <Printer style={{ width: 13, height: 13 }} />
            Print
          </button>
          <button
            type="button"
            className="agreement-view__btn"
            onClick={() => window.print()}
            title="Use 'Save as PDF' as the print destination"
          >
            <Download style={{ width: 13, height: 13 }} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="agreement-view__doc">
        <div className="agreement-view__header">
          <p className="agreement-view__eyebrow">Divigner Group</p>
          <h1 className="agreement-view__title">Referral Associate Agreement</h1>
          <p className="agreement-view__version">
            Divigner Referral Associate Program · {cfg.agreement_version}
          </p>
        </div>

        {sections.map((s) => (
          <div key={s.id} className="agreement-view__section">
            <h2 className="agreement-view__section-title">
              {s.number !== s.title ? `${s.number} — ${s.title}` : s.title}
            </h2>
            {s.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ))}

        <div className="agreement-view__footer">
          By signing the agreement in the Divigner Associate Portal, both parties agree to be bound
          by the terms and conditions of this Referral Associate Agreement. On behalf of Divigner
          Group: <strong>Jae McKinney, Founder &amp; Chief AI Strategist</strong>.
        </div>
      </div>
    </div>
  )
}
