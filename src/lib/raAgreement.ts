import type { CommissionConfig } from "@/types/db"
import {
  calcOneTimeCommission,
  calcRecurringCommissionPerMonth,
  formatMoney,
} from "@/lib/commissions"

/**
 * Divigner Referral Associate Agreement — source text.
 *
 * Section bodies use `{{tokens}}` that are interpolated against the active
 * CommissionConfig at render time so admin views, the public referral page,
 * and the signed PDF all reference the same numbers.
 *
 * Bump `agreement_version` on the config when section text changes — existing
 * RAs will be prompted to re-accept the new version on next sign-in.
 */

export type AgreementSection = {
  id: string
  number: string         // "Recitals" / "Section 1" / "Signatures"
  title: string
  body: string[]         // paragraphs (markdown not parsed — kept plain for legal clarity)
}

const RAW_SECTIONS: AgreementSection[] = [
  {
    id: "recitals",
    number: "Recitals",
    title: "Recitals",
    body: [
      'Divigner Group ("Divigner" or "Company") operates an AI platform and consulting practice that deploys interactive AI avatar solutions for clients in healthcare, life sciences, insurance, financial services, and related industries. Divigner offers its services to clients at a one-time implementation fee of {{implementation_fee}} and a monthly service fee of {{monthly_service_fee}}.',
      'The individual identified by their electronic signature below ("Referral Associate" or "Associate") wishes to participate in the Divigner Referral Associate Program (the "Program") by referring prospective clients to Divigner in exchange for commission compensation as set forth in this Agreement.',
      "The parties therefore agree as follows.",
    ],
  },
  {
    id: "s1",
    number: "Section 1",
    title: "Definitions",
    body: [
      "Active Client — A referred client who has paid the full {{implementation_fee}} Implementation Fee and whose monthly {{monthly_service_fee}} service fee is current and not paused or cancelled.",
      "Active Referral — A referral submission that has been approved by Divigner and for which a Deal record has been created in the Divigner Portal.",
      "Calendar Year — January 1 through December 31 of any given year.",
      "Commission Reserve Account — A dedicated Mercury Bank sub-account maintained by Divigner solely for the purpose of funding Referral Associate commission payments.",
      "Deal — An active opportunity record in the Divigner Portal created upon approval of a Referral Associate's lead submission.",
      "Divigner Portal — The internal platform operated by Divigner used to manage Associate records, lead submissions, deal stages, commission tracking, and program administration.",
      "Implementation Fee — The one-time fee of {{implementation_fee}} charged by Divigner to a new client for platform setup and deployment.",
      "Monthly Service Fee — The recurring fee of {{monthly_service_fee}} per month charged by Divigner to active clients for platform hosting, support, and maintenance.",
      "Program Administrator — Zuirrae McKinney, Divigner Group, who oversees all Referral Program operations, approvals, and commission disbursements.",
      "Qualified Referral — A prospective client submitted by a Referral Associate who (a) has not previously appeared in Divigner's pipeline, (b) has been approved by the Program Administrator, and (c) has executed a service agreement with Divigner and paid the full Implementation Fee.",
      "W-9 — IRS Form W-9, Request for Taxpayer Identification Number and Certification, required for tax reporting purposes.",
    ],
  },
  {
    id: "s2",
    number: "Section 2",
    title: "Program Eligibility and Onboarding",
    body: [
      "2.1 Application. To participate in the Program, an individual must submit a complete application through the designated form at divigner.com. Submission of an application does not guarantee acceptance. All applications are reviewed and approved or declined at the sole discretion of the Program Administrator.",
      "2.2 Onboarding Requirements. Upon approval of an application, the Associate must complete all three of the following steps before their account is activated: (a) execute this Referral Associate Agreement via electronic signature; (b) submit a completed and signed IRS Form W-9 by downloading the form from the Associate portal, completing it offline, and uploading the signed PDF through the portal; and (c) submit ACH banking details (routing number and account number) through the secure Associate portal for the purpose of commission disbursements via Mercury Bank. Associate accounts will not be activated, and no referral links will be issued, until all three requirements are confirmed by the Program Administrator.",
      "2.3 US-Based Associates Only. The Program is open to US-based individuals only. Associates must have a valid US Social Security Number or Employer Identification Number and a US-based bank account eligible for ACH transfers.",
      "2.4 Independent Contractor Status. Referral Associates are independent contractors. Nothing in this Agreement creates an employment relationship, partnership, joint venture, or agency between the Associate and Divigner. Associates are solely responsible for their own taxes, expenses, and legal compliance. Divigner shall not withhold income taxes, Social Security, Medicare, or any other employment-related taxes from commission payments.",
    ],
  },
  {
    id: "s3",
    number: "Section 3",
    title: "Referral Submission and Qualification",
    body: [
      "3.1 Submission Process. Upon activation, each Referral Associate is issued a dedicated referral URL hosted within the Divigner platform. This personalized page includes a demonstration of Divigner's interactive AI avatar and website concierge solution, along with a contact form for prospects to request a consultation. Referrals enter the program exclusively through this dedicated URL. A prospect may complete the contact form themselves after viewing the demonstration, or the Associate may complete it on the prospect's behalf. Either method of submission is permitted. Each submission must include the prospect's full name, company name, email address, phone number, industry, and any relevant context. All submissions are automatically attributed to the Associate whose dedicated URL was used and are logged immediately in the Divigner Portal.",
      "3.2 Duplicate Check and Disqualification. Upon submission, the Divigner Portal performs an automatic duplicate check against existing pipeline records. Submissions that match an existing contact or company record by email address or company name will be marked Duplicate — Not Eligible. The Associate will be notified by email and provided with the original pipeline entry date as confirmation. No commission is payable on duplicate submissions. Divigner's determination of duplicate status is final.",
      "3.3 Approval Outcomes. The Program Administrator will review each submission and assign one of the following statuses: Approved (Deal record created), Declined (submission does not meet qualification criteria), Duplicate (prospect already in Divigner's pipeline), or More Information Needed.",
      "3.4 Attribution Window. Referral credit is valid for {{attribution_window_days}} days from the date of submission approval. If a referred prospect does not execute a service agreement with Divigner within {{attribution_window_days}} days of submission approval, the submission expires and the referral link associated with that prospect is no longer attributed to the Associate. The Associate must re-submit to re-establish attribution.",
    ],
  },
  {
    id: "s4",
    number: "Section 4",
    title: "One-Time Referral Commission",
    body: [
      "4.1 Commission Amount. Upon full collection of the {{implementation_fee}} Implementation Fee from a Qualified Referral, the Associate is eligible to receive a one-time referral commission of {{one_time_commission}}, paid from the Commission Reserve Account.",
      "4.2 Payment Condition — Full Collection Required. One-time commissions are earned only upon confirmed receipt of the full {{implementation_fee}} Implementation Fee. No commission is payable on the deposit alone. Both payment events must be recorded in the Divigner Portal before commission eligibility is triggered. The Program Administrator will manually approve each commission in the Divigner Portal prior to disbursement.",
      "4.3 Cancellation Policy. Clients may cancel their agreement within five (5) business days of execution for a partial refund of the deposit. Cancellations must be submitted in writing. If a client cancels within the cancellation window, the full deposit is refunded and no commission is owed to the Associate. If a client cancels after the cancellation window but before full payment, Divigner retains $500 of the deposit as a cancellation processing fee. This $500 is not shared with the Associate. No commission is owed to the Associate in any cancellation scenario.",
      "4.4 No Clawback. All one-time commissions that have been paid to an Associate are earned and final. Divigner will not seek repayment of commissions previously disbursed, regardless of subsequent client cancellation, non-payment, or any other circumstance.",
    ],
  },
  {
    id: "s5",
    number: "Section 5",
    title: "Recurring Monthly Commission",
    body: [
      "5.1 Recurring Commission Rate. In addition to the one-time commission described in Section 4, Associates who maintain eligibility as described in Section 6 shall receive a recurring commission of {{recurring_commission}} for each Active Client, beginning the calendar month following full collection of the {{implementation_fee}} Implementation Fee. {{recurring_duration_clause}}",
      "5.2 Client Pause. If an Active Client pauses their Monthly Service Fee, the associated recurring commission pauses for the same month(s). Paused months do not count toward commission totals and are not backdated when service resumes. Commission resumes the same month the client's Monthly Service Fee resumes.",
      "5.3 Client Cancellation. If an Active Client permanently cancels their service agreement with Divigner, recurring commissions cease effective the month of cancellation. No clawback of previously paid recurring commissions is required.",
    ],
  },
  {
    id: "s6",
    number: "Section 6",
    title: "Annual Referral Minimum and Program Eligibility",
    body: [
      "6.1 Annual Minimum Requirement. Continued participation in the Program, including the right to submit new referrals and receive all commissions described in this Agreement, requires the Associate to refer a minimum of {{annual_minimum_referrals}} new Qualified Referrals that result in paying clients in each Calendar Year. The minimum is measured from January 1 through December 31 of each Calendar Year. An Associate who fails to meet this minimum is at risk of suspension from the Program in its entirety, not merely suspension of recurring commissions.",
      "6.2 Partial Year Exemption. Associates activated after July 1 of any Calendar Year are exempt from the annual minimum for that partial year. Their first full annual minimum period begins January 1 of the following Calendar Year.",
      "6.3 Failure to Meet Minimum — Notice and Grace Period. Associates who do not meet the annual minimum by December 31 shall receive written notice from Divigner by January 15 of the following year. Associates will have a ninety (90) day grace period ending March 31 to meet the minimum threshold. If the threshold is not met by March 31, the Associate's account will be suspended and all recurring commissions will cease effective April 1.",
      "6.4 Reinstatement. A suspended Associate may apply for reinstatement by notifying the Program Administrator in writing and demonstrating that the minimum has been met. Reinstatement is subject to Program Administrator approval. Commissions reinstate the calendar month following approved reinstatement. Suspended months are not backdated or compensated.",
      "6.5 No Cap on Referrals or Commissions. There is no maximum limit on the number of referrals an Associate may submit or the total commissions an Associate may earn.",
    ],
  },
  {
    id: "s7",
    number: "Section 7",
    title: "Quarterly Client Check-In Requirement",
    body: [
      "7.1 Check-In Obligation. As a condition of receiving recurring commissions described in Section 5, Associates must log a verified client check-in for each Active Client at least once every {{checkin_interval_days}} days. Check-ins must be logged through the Associate portal and must include the client name, date, time, method of contact (phone call, video call, in-person meeting, or email), and brief notes summarizing the interaction.",
      "7.2 Purpose. The quarterly check-in requirement serves to maintain the Associate's relationship with referred clients, surface potential service issues or cancellation risk for Divigner's attention, and ensure that recurring commissions reflect an ongoing and active referral relationship.",
      "7.3 Missed Check-In — Warning and Suspension. If a check-in is not logged within {{checkin_warning_days}} days of the prior logged check-in, the Associate will receive an automated warning email. If the check-in remains unlogged {{checkin_suspension_minus_warning}} days after the warning ({{checkin_suspension_days}} days total), the recurring commission for that specific client will be suspended. Commission for a suspended client reinstates the following month after the overdue check-in is logged. Two consecutive missed check-in periods for the same client may result in permanent termination of that client's recurring commission at Divigner's discretion.",
      "7.4 Random Verification. Divigner reserves the right to randomly verify logged check-ins by contacting the referenced client to confirm the interaction occurred. Logged check-ins that cannot be verified may result in commission suspension or termination of the Associate's participation in the Program.",
      "7.5 Reporting Obligation. Associates must promptly notify the Program Administrator of any client complaints, expressed dissatisfaction, or cancellation intent communicated to the Associate. This obligation applies throughout the term of the Associate's participation in the Program.",
    ],
  },
  {
    id: "s8",
    number: "Section 8",
    title: "Payment Terms and Method",
    body: [
      "8.1 One-Time Commission Payment. Approved one-time commissions shall be paid within fifteen (15) business days of Divigner's confirmed receipt of the full {{implementation_fee}} Implementation Fee from the referred client, as verified by payment confirmation recorded in the Divigner Portal.",
      "8.2 Recurring Commission Payment — Monthly Cycle. Recurring commissions are aggregated across all of the Associate's Active Clients and disbursed as a single ACH transfer on the 15th of each calendar month. If the 15th falls on a weekend or federal holiday, payment will be made on the next business day. The payout calculation is finalized on the 13th of each month. Recurring commissions earned in a given month are paid on the 15th of the following month.",
      "8.3 Client Payment Methods. Divigner accepts client payments for both the Implementation Fee and the Monthly Service Fee via Stripe, ACH bank transfer, check, or wire transfer. The method of client payment does not affect commission eligibility, provided that full payment is confirmed and recorded in the Divigner Portal.",
      "8.4 Associate Payment Method. All commission payments to Associates are made via ACH bank transfer from Divigner's Commission Reserve Account at Mercury Bank to the Associate's bank account on file. Associates are responsible for maintaining current and accurate ACH banking information in the Associate portal. Divigner is not responsible for failed transfers resulting from incorrect banking information provided by the Associate.",
      "8.5 Payment Disputes. Associates who believe a commission payment is incorrect must submit a written dispute to the Program Administrator within thirty (30) days of the payment date. Disputes submitted after thirty (30) days will not be considered. Divigner's records in the Divigner Portal are the authoritative source for commission calculations.",
      "8.6 Single-Tier Program. The Program is a single-tier program. Associates may not recruit, sponsor, or earn commissions from the referral activity of other Associates. Any attempt to create a sub-referral or multi-level structure constitutes a material breach of this Agreement and shall result in immediate termination from the Program.",
    ],
  },
  {
    id: "s9",
    number: "Section 9",
    title: "Tax Obligations",
    body: [
      "9.1 W-9 Requirement. Associates must submit a valid, completed, and signed IRS Form W-9 prior to account activation. No commission payments of any kind will be made to an Associate who has not submitted a W-9. Associates are responsible for notifying Divigner of any changes to their tax identification information.",
      "9.2 1099-NEC Reporting. Divigner will issue IRS Form 1099-NEC to any Associate who receives $600 or more in total commission payments during a calendar year, in accordance with applicable federal tax reporting requirements. Associates are solely responsible for reporting all commission income received from Divigner on their federal, state, and local tax returns and for paying all applicable taxes thereon.",
      "9.3 No Withholding. Divigner will not withhold federal or state income taxes, Social Security taxes, Medicare taxes, or any other taxes from commission payments. Associates are solely responsible for making estimated tax payments as required by law.",
    ],
  },
  {
    id: "s10",
    number: "Section 10",
    title: "Associate as Client",
    body: [
      "Should a Referral Associate elect to become a Divigner client, the following pricing adjustments apply: Implementation Fee — {{implementation_fee}} standard, {{associate_implementation_fee}} for Associates ($1,000 discount). Monthly Service Fee — {{monthly_service_fee}}/month standard, {{associate_monthly_fee}}/month for Associates ($50 credit applied as ongoing referral commission). The credit applies for as long as the Associate remains both an active client and an active Referral Associate in good standing. If the Associate's Program participation is suspended or terminated, the monthly credit ceases and the full Monthly Service Fee applies. The Implementation Fee discount and monthly credit are non-transferable and may not be combined with other offers. An Associate may not refer themselves and may not earn a referral commission on their own client engagement.",
    ],
  },
  {
    id: "s11",
    number: "Section 11",
    title: "Program Governance and Conduct",
    body: [
      "11.1 Non-Competing Referrals. While actively participating in this Program, Associates may not refer any Active Client to a third-party provider of interactive AI avatar solutions designed for website deployment, including but not limited to AI-powered website concierge, digital human concierge, or interactive avatar chat solutions. This restriction applies only during the period in which the Associate holds an active account in the Program. Upon termination or resignation from the Program for any reason, this restriction expires immediately and the former Associate is free to engage with any provider or platform of their choosing without limitation. This Section does not restrict Associates from referring prospects to providers of unrelated AI services, such as general-purpose chatbots, AI writing tools, or AI analytics platforms that do not offer interactive avatar or digital human concierge experiences.",
      "11.2 Non-Disparagement. Associates agree not to make any false, misleading, or disparaging statements about Divigner or its products, services, employees, or clients, whether publicly or privately, during or after the term of this Agreement.",
      "11.3 Confidentiality. Associates acknowledge that through their participation in the Program they may receive access to confidential information including but not limited to client names, deal terms, pricing, commission structures, and internal processes. Associates agree to keep all such information strictly confidential and not to disclose it to any third party without Divigner's prior written consent.",
      "11.4 Program Changes. Divigner reserves the right to modify commission rates, minimum requirements, program terms, or to discontinue the Program entirely, with thirty (30) days written notice to Active Associates. Any referrals submitted and approved prior to the effective date of a modification shall be governed by the terms in effect at the time of submission.",
    ],
  },
  {
    id: "s12",
    number: "Section 12",
    title: "Termination",
    body: [
      "12.1 Termination by Divigner. Divigner may terminate this Agreement and an Associate's participation in the Program immediately and without notice for any of the following: (a) material breach of any provision of this Agreement; (b) submission of false or fraudulent referrals or check-in logs; (c) conduct that is harmful to Divigner's reputation or client relationships; (d) attempt to create a multi-level or sub-referral structure; or (e) failure to meet the annual minimum requirement following the grace period.",
      "12.2 Termination by Associate. Associates may terminate their participation in the Program at any time by providing written notice to the Program Administrator. Upon termination by the Associate, all pending one-time commissions that have been approved but not yet paid will be disbursed on the next scheduled payment date. Recurring commissions cease upon the effective date of termination.",
      "12.3 Effect of Termination. Upon termination for any reason, the Associate's portal access will be revoked, their referral links will be deactivated, and no further commissions will accrue. Divigner has no further payment obligations to a terminated Associate except for commissions formally approved in the Divigner Portal prior to the termination date. If the Associate is also a Divigner client, the monthly credit described in Section 10 ceases and the full Monthly Service Fee applies from the following billing cycle.",
    ],
  },
  {
    id: "s13",
    number: "Section 13",
    title: "General Provisions",
    body: [
      "13.1 Entire Agreement. This Agreement constitutes the entire agreement between the parties with respect to the Divigner Referral Associate Program and supersedes all prior negotiations, representations, warranties, and understandings of the parties with respect thereto.",
      "13.2 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of New Jersey, without regard to its conflict of law provisions.",
      "13.3 Dispute Resolution. Any dispute arising under this Agreement shall be resolved through the following sequential process. First, the disputing party must submit the dispute in writing to the Program Administrator, and the parties shall attempt to resolve it through good-faith negotiation within thirty (30) days of submission. If the dispute is not resolved through negotiation, it shall be submitted to binding arbitration administered by JAMS or the American Arbitration Association (AAA) under their then-current Commercial Arbitration Rules, with a single arbitrator, conducted in New Jersey. The arbitrator's decision shall be final and binding and may be entered as a judgment in any court of competent jurisdiction. Each party shall bear its own costs and attorneys' fees unless the arbitrator determines otherwise. Litigation in court is available only to enforce an arbitration award or to seek emergency injunctive relief pending arbitration. Notwithstanding the foregoing, Divigner's determination on matters of commission eligibility, duplicate status, and check-in verification is final and not subject to arbitration.",
      "13.4 Severability. If any provision of this Agreement is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that this Agreement shall otherwise remain in full force and effect.",
      "13.5 No Waiver. Failure by either party to enforce any provision of this Agreement shall not constitute a waiver of that party's right to enforce such provision in the future.",
      "13.6 Amendment. No amendment to this Agreement shall be binding unless made in writing and signed by both parties, except as provided in Section 11.4 with respect to program-wide changes.",
      "13.7 Electronic Signature. The parties agree that electronic signatures are legally binding and have the same legal effect as handwritten signatures. By accepting this Agreement and providing your typed full legal name in the portal, you intend to be bound to the same extent as if you had signed a printed copy with a pen.",
    ],
  },
]

function tokens(cfg: CommissionConfig): Record<string, string> {
  const oneTime = calcOneTimeCommission(cfg)
  const recurring = calcRecurringCommissionPerMonth(cfg)
  const oneTimeStr =
    cfg.one_time_mode === "flat"
      ? formatMoney(oneTime)
      : `${cfg.one_time_value}% of the Implementation Fee (${formatMoney(oneTime)})`
  const recurringStr =
    cfg.recurring_mode === "flat"
      ? `${formatMoney(recurring)} per month`
      : `${cfg.recurring_value}% of the Monthly Service Fee (${formatMoney(recurring)} per month)`
  const durationClause =
    cfg.recurring_duration.kind === "indefinite"
      ? "Recurring commissions are paid for the life of the client's engagement with Divigner, subject to the eligibility conditions in this Agreement."
      : `Recurring commissions are paid for ${cfg.recurring_duration.months} consecutive months following the first qualifying month, subject to the eligibility conditions in this Agreement.`

  return {
    implementation_fee: formatMoney(cfg.implementation_fee),
    monthly_service_fee: formatMoney(cfg.monthly_service_fee),
    one_time_commission: oneTimeStr,
    recurring_commission: recurringStr,
    recurring_duration_clause: durationClause,
    attribution_window_days: String(cfg.attribution_window_days),
    annual_minimum_referrals: String(cfg.annual_minimum_referrals),
    checkin_interval_days: String(cfg.checkin_interval_days),
    checkin_warning_days: String(cfg.checkin_warning_days),
    checkin_suspension_days: String(cfg.checkin_suspension_days),
    checkin_suspension_minus_warning: String(
      Math.max(0, cfg.checkin_suspension_days - cfg.checkin_warning_days)
    ),
    associate_implementation_fee: formatMoney(Math.max(0, cfg.implementation_fee - 1000)),
    associate_monthly_fee: formatMoney(Math.max(0, cfg.monthly_service_fee - 50)),
  }
}

function interpolate(text: string, map: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => map[key] ?? `{{${key}}}`)
}

export function getAgreementSections(cfg: CommissionConfig): AgreementSection[] {
  const map = tokens(cfg)
  return RAW_SECTIONS.map((s) => ({
    ...s,
    body: s.body.map((p) => interpolate(p, map)),
  }))
}
