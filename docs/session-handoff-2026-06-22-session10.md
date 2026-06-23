# Session Handoff — 2026-06-22 (RA Platform, "10th" session)

Follow-up to `session-handoff-2026-06-22.md` (session 9). Everything below
is **committed, pushed to `main`, deploying on Vercel**. Migration
`20260622040000` is **applied to production**. Edge functions
`transfer-archived-leads` and `hard-delete-archive` are **deployed**.

User explicitly approved the push at end of session.

## Commits this session (newest first)
- `6dc2e05` — feat(ra): permanent delete + lead transfer for archived RAs
- `cbced9d` — feat(ra): W-9 self-service change-request form
- `58ab0a4` — feat(ra): lifetime earnings hero on RA dashboard
- `ba9ba33` — style(sidebar): loosen collapsed-rail spacing across all sidebars
- `c27a0e8` — feat(ra): per-row Individual/Company picker in bulk invite
- `8d5712b` — feat(ra): make /demo/ the primary share link in admin UI

---

## What shipped

### A. `/demo/<slug>` is the canonical share link (`8d5712b`)
The refer URL no longer appears in CRM admin UI; prospects reach the refer
form via the public demo page's "Get in touch" CTA only.

Surfaces flipped from `/refer/<slug>` → `/demo/<slug>`:
- `InviteRaModal.tsx` — single-invite success dialog
- `SettingsRADetail.tsx` — header + "Public page" button (now "Demo page")
- `SettingsRAReview.tsx` — header + approved-RA modal
- `RaVerificationDialog.tsx` — review dialog
- `RaSection.tsx` — slug column in the admin list table
- `LeadDetail.tsx` — "Referred by" breadcrumb
- `SettingsRAArchive.tsx` — restore confirmation + detail-view subtitle

The RA dashboard's two-card layout (Demo + Refer, demo primary) is unchanged.

### B. Bulk-invite per-row type picker (`c27a0e8`)
Old behavior: a single Individual/Company toggle at the bottom of the modal
applied to ALL rows. New behavior:
- Manual entry — each row gets its own compact `Indiv / Co` toggle
- CSV — optional `ra_type` column (accepts `individual` / `company` /
  short forms like `ind` / `co` / `org` / `business`); defaults to individual
- Paste list — optional 5th column for type
- Validation preview — Individual/Company badge per row
- Footer — replaced toggle with per-batch summary
  (e.g. "3 individual · 2 company")
- `sendAll` invokes `inviteRa({ ..., ra_type: r.ra_type })` per row

### C. Sidebar breathing-room pass (`ba9ba33`)
All three sidebars (main `AppSidebar`, RA portal `RaSidebar`, Settings
sub-sidebar in `SettingsLayout`) use a consistent looser sizing when
collapsed:
- Icon buttons 36 → 40px (`h-9` → `h-10`)
- Vertical gaps `space-y-1` → `space-y-1.5`; section dividers `my-2`
  → `my-3`, `w-6` → `w-8`
- Double-arrow collapse button 28 → 32px (`h-7 w-7` → `h-8 w-8`) with
  `h-5` chevrons and primary-tinted hover
- Collapsed rail widths: main + RA 64 → 72px (`md:w-[72px]`),
  settings 56 → 64px (`w-16`)
- Settings sub-sidebar now uses the same `mx-auto h-10 w-10` cell as the
  main rail instead of its tighter `p-2`

### D. RA dashboard Lifetime Earnings hero (`58ab0a4`)
New hero card above the existing earnings card:
- Large all-time paid total with `ShieldCheck` icon, primary-tinted gradient
- Copy: "Every commission paid to you, in full. This number never goes
  down — earned commissions stay yours."
- Right-side side card with current MRR + active-client count
The existing breakdown (interval selector + 3-column grid + client list)
stays below as the drill-down, relabeled "Earnings breakdown."

### E. W-9 self-service change-request (`cbced9d`)
The backend already supported `request_type='w9'` (table, email, admin
review). The only gap was the RA-side form, which now exists in
`RaSettings.tsx`:
- File picker (PDF, max 10 MB) + IRS blank-form link + optional note
- "Submit W-9 for review" — uploads via `uploadRaW9ForReview` to the
  ra-w9 bucket under `<user_id>/pending-<timestamp>.pdf` (does NOT mutate
  `ra_associates`), then creates the `ra_change_requests` row
- Program Admin email + Pending Change Requests card already wired
- On approval, `reviewRaChangeRequest` applies the new url to
  `ra_associates.w9_document_url` and flips `w9_completed = true`
- Pending-W-9 amber banner mirrors pending-banking

### F. Archive: transfer + permanent delete (`6dc2e05`)
Closes the archive lifecycle. Archive was previously restore-only.

**Migration `20260622040000_archive_transfer_and_hard_delete.sql`** —
two `SECURITY DEFINER` RPCs:
- `transfer_archived_ra_leads(p_archive_id, p_target_user_id)`
  Re-points live `leads.referred_by_ra_id` / `deals.referred_by_ra_id` to
  the target. Guarded by `IS NULL` on the live row — never clobbers a
  record Restore (or a previous Transfer) already reassigned. Target must
  be an active RA in the archive's org.
- `hard_delete_archived_ra(p_archive_id)`
  Drops the `archived_ra_associates` row; CASCADE wipes the six
  `archived_*` child tables. After this, recovery is backups-only.

**Edge functions** (both deployed, super_user OR program_admin gated):
- `transfer-archived-leads` — body `{ archive_id, target_user_id }`,
  pre-validates target is in the org so the caller gets a friendly error,
  returns `{ leads_transferred, deals_transferred, target_display_name }`
- `hard-delete-archive` — body `{ archive_id, confirm_name? }`,
  validates confirm_name matches the archived display_name

**UI in `SettingsRAArchive.tsx`:**
- New `TransferRaLeadsModal` — typeahead picker over active RAs
  (filters out declined/terminated); shows lead/deal counts; confirms
  with archive name → target name
- New `HardDeleteControl` — typed-confirmation alert dialog; warns when
  live leads still exist and haven't been transferred ("transfer first,
  this is permanent")
- Detail view: Restore + Transfer leads + Delete archive in the header
- List view: each row gets a "Manage" link that jumps into detail
- Transfer-success toast shows the moved counts and target

---

## Deployment state
| Thing | Status |
|---|---|
| Front-end (`main` → Vercel) | ✅ Pushed `6dc2e05`, auto-deploying |
| Migration `20260622040000` | ✅ Applied (verified via `supabase db push` → "up to date") |
| `transfer-archived-leads` edge fn | ✅ Deployed |
| `hard-delete-archive` edge fn | ✅ Deployed |
| `notify-ra-checkin-due` edge fn | ✅ Deployed last session — still needs cron schedule |

---

## ⚠️ Manual steps remaining

### 1. Schedule the check-in reminder cron (carried over from session 9)
User said "I'll come back to this." Until set, the check-in email is the
only untestable feature.

Supabase Dashboard → project `cbmcyffvsebrxkmxufxx` →
Integrations → Cron → Create cron job:
- Name: `ra-checkin-due`
- Schedule: `0 14 * * *`
- Type: Supabase Edge Function → `notify-ra-checkin-due`
- Method: POST · Body: `{}`

### 2. Rotate test-account passwords
Off `Avanew2026!` (was shared in chat history). Accounts:
- `jae@divigner.com` (super_user + RA)
- `zuirrae@divigner.com` (admin + Program Admin + RA)
- `jae.mckinney@gmail.com` (clean RA)

---

## Test checklist (delta from session 9)

### Demo-link sweep
- [ ] Settings → Team → Referral Associates: slug column shows `/demo/<slug>`
- [ ] Open an RA detail: header says `/demo/<slug>`, "Demo page" button
      opens the public demo
- [ ] Open the inline review dialog (for an RA in `verification`): shows
      `Demo URL /demo/<slug>`, not Ref URL
- [ ] Single Invite RA → success dialog shows demo link + explainer
      ("prospects click Get in touch to reach the referral form")

### Bulk invite per-row type
- [ ] Open Bulk Invite → Manual entry tab: each row has its own
      Indiv/Co toggle, defaults to Indiv
- [ ] Toggle row 2 to Company → row 1 stays Individual
- [ ] CSV tab: copy the example block, replace headers + types, upload;
      validation preview shows per-row badge
- [ ] Footer shows "X individual · Y company" instead of the old toggle

### Sidebar feel
- [ ] Collapse the main sidebar (top double-arrow): icons feel airier;
      collapse button is clearly clickable
- [ ] Same for `/ra/dashboard` (sign in as RA)
- [ ] Settings sub-sidebar collapse: icons no longer feel crammed; rail
      is wider (w-16 vs the old w-14)

### RA dashboard hero
- [ ] Hero card shows large $X lifetime + "This number never goes down"
- [ ] Right side: MRR `/mo` + active client count
- [ ] Existing breakdown card still has interval selector + client list

### RA Settings: W-9 form
- [ ] /ra/settings → Banking & Tax card has "Replace your W-9 on file"
- [ ] Download blank link points to irs.gov
- [ ] Choose a PDF (any small PDF), Submit W-9 for review → success toast
- [ ] Amber banner appears: "Your W-9 update is pending review"
- [ ] As Program Admin (jae@divigner.com): Settings → Team → Referral
      Associates → Pending change requests card shows the W-9 entry
- [ ] Approve → RA's `w9_completed` flips true; banner clears on reload

### Archive: transfer + delete (CROSS-ACCOUNT)
- [ ] As super_user, delete a throwaway RA (Trash icon, typed confirm)
- [ ] /settings/ra/archive → entry appears
- [ ] Open detail → click Transfer leads → picker opens with active RAs
- [ ] Pick target → confirm → toast: "Transferred N leads to <name>"
- [ ] Check the target RA's portal: the transferred leads appear in
      their Deals tab
- [ ] Back to archive detail → "Delete archive" → type name → confirm
- [ ] Archive list no longer shows that entry

---

## Judgment calls confirmed this session (locked in)
1. **Refer link removed from admin UI entirely.** Only surfaces from the
   public demo page's "Get in touch" CTA. (Confirmed via AskUserQuestion.)
2. **Sidebar sizing = Moderate** (40px icons, 32px collapse button,
   72px rail). Not the aggressive option.
3. **Lifetime earnings hero is added.** Hero card on top of the existing
   breakdown.
4. **W-9 form added.** Mirrors banking change-request flow.

## Carried over from session 9 (still open / unconfirmed)
- RA sidebar omits Cashflow/Contacts/Reports/Tasks deliberately for data
  safety — user has not asked to add any back yet.
- Activities tab built on RA's own check-in log, not org-wide activities.
- Earnings MRR semantics (recurring monthly, $1k one-times included in
  paid-to-date).
- Yahoo invite-email deliverability not yet verified.

## Known follow-ups / ideas
- Cron (above).
- `is_demo_seed` column → switch `listLeadsForRaSlug` detection from the
  notes marker to the column (cleanup, not urgent).
- Demo-seed counts: still excluded from stats via the marker; verify they
  don't inflate annual-minimum / earnings in edge cases.
- Rotate test passwords (above).
