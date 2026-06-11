# Referral Associate (RA) Templates — Individual vs Company

Two flavors of RA, two public demo templates, one shared CRM/data pipeline.

This doc captures the conventions that emerged from the Skilldora bootstrap so future
sessions (and the upcoming invite-flow rewrite) stay consistent.

---

## 1. The two RA types

| Type           | Reference page                                          | Who                                |
| -------------- | ------------------------------------------------------- | ---------------------------------- |
| **Individual** | `https://ai-automation.divigner.com/demo/jae`           | A single named referral partner.   |
| **Company**    | `https://ai-automation.divigner.com/demo/skilldora`     | A partner brand / organization.    |

Both types resolve to the same React route (`/demo/:slug`), which renders the
self-contained `public/demo.html` page. The page reads RA fields via the
`get_ra_landing_page(p_slug)` RPC and adapts.

The differences are **template-level only** — the underlying data model, CRM
dashboard, lead routing, and email notifications are identical.

---

## 2. Data model

### Existing `ra_associates` columns that drive the templates

| Column                 | Used by    | Notes                                       |
| ---------------------- | ---------- | ------------------------------------------- |
| `slug`                 | both       | URL slug (e.g. `jae`, `skilldora`)          |
| `display_name`         | both       | Shown in the RA hero block                  |
| `photo_url`            | both       | Headshot — RA portrait                      |
| `bio`                  | both       | Long-form intro (match RA's pronouns)       |
| `ra_title`             | both       | Title / role under the name                 |
| `contact_email`        | both       | Receives lead notifications via SendGrid    |
| `contact_phone`        | both       | Optional                                    |
| `linkedin_url`         | both       | Renders LinkedIn icon if set                |
| `partner_company_name` | company    | Brand name                                  |
| `partner_logo_url`     | company    | Brand logo (see §6 for format guidance)     |
| `partner_website`      | company    | Brand site                                  |
| `status`               | both       | `active` to render on the public page       |

### Proposed addition

Add an explicit type column so the invite flow and template renderer don't have
to infer from "is `partner_company_name` populated":

```sql
ALTER TABLE public.ra_associates
  ADD COLUMN ra_type text NOT NULL DEFAULT 'individual'
    CHECK (ra_type IN ('individual','company'));

-- Backfill existing rows
UPDATE public.ra_associates
   SET ra_type = 'company'
 WHERE partner_company_name IS NOT NULL;
```

`ra_type` is what the new invite form sets, and what the demo template branches on.

---

## 3. CRM access — same for both types

A Company RA gets the **same CRM access** as an Individual RA. The bootstrap
migration pattern (see §7) creates:

1. `auth.users` row — login credentials
2. `profiles` row with `role = 'partner'` — gates them into the RA portal
3. `organization_members` row — joins them to the org
4. `ra_associates` row — their public RA record

After login they hit `RaDashboard` (under `RaPortalGuard`) and see every lead
where `referred_by_ra_id = their user_id`. `record_ra_lead()` populates this
automatically when someone submits `/refer/:slug`.

---

## 4. Public template — Individual (`/demo/jae`)

Single-personality page focused on the RA themselves.

- Hero: photo, name, title, bio
- Pricing/investment section (480 min/mo talk time, same for both types)
- Standard Divigner avatar (bottom-right floating widget) for live conversation
- No partnership logos section
- No avatar grid of client demos

---

## 5. Public template — Company (`/demo/skilldora`)

Brand-led page that introduces the company first, then the RA contact.

What's distinct from Individual:

- **Partnership logos section** — Divigner logo + partner brand logo side-by-side, always visible. (Removed the `×` separator on both desktop and mobile; logos tightened up next to each other.)
- **Avatar grid** — three clickable image tiles (e.g. Victoria / Zoey / Zayla) linking to live client deployments. Above the grid: a single general instruction telling visitors to look for the floating avatar bottom-right to start a conversation. No per-tile play buttons or Tavus embeds.
- **General talk-time copy** — `480 minutes / month` interactive talk time (8 hours).
- **Brand logo** — the Company partner's `partner_logo_url` is rendered in both the topbar and footer. For dark backgrounds (this template), expect a white/inverted logo.

**Field visibility rule (applies to both templates):** any optional RA field
that is empty/null must be hidden from the UI — no empty labels, no "—"
placeholders. The contact details page in the invite/onboarding flow should
match the Individual layout exactly, then append the additional Company
business fields below.

---

## 6. Brand logo guidance (for invite flow)

Companies were bothering Jae to resize logos. Future invite UI should fix this.

**Recommendation in the upload step:**

- **Preferred format:** PNG with transparent background (best for dark + light backgrounds via swap), or SVG for crispness at any size.
- **JPG/JPEG:** acceptable only if it has a transparent-equivalent background; otherwise it will look boxed on the dark template.
- **Minimum dimensions:** 600px wide for raster (PNG/JPG). Anything smaller pixelates in the topbar.
- **Color variants:** if the RA has them, upload an "Inverted" (white/light) variant for dark backgrounds — that's what gets used on the demo page. The standard dark-text variant is the fallback.

**In-browser resize / crop:** during upload, present a simple cropper with:

- Aspect ratio: free-form (logos vary)
- Output: PNG with preserved transparency
- Display preview: render the cropped logo on a dark navy background tile so the user can confirm it reads correctly before saving

This eliminates "my logo is too small" tickets to Jae.

---

## 7. Bootstrap migration pattern (special case only)

**Going forward, companies will sign themselves up via the invite flow.** The
manual SQL migration approach below is **only** for special-case bootstraps
(Skilldora and the 3 current pre-invite-flow companies). After the invite-flow
update lands, do not add new RAs this way.

Pattern (mirror `supabase/migrations/20260610100000_ra_skilldora.sql`):

```sql
DO $$
DECLARE
  -- IMPORTANT: Company RAs belong in the Divigner org, NOT Avanew.
  --   Avanew   = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
  --   Divigner = dddddddd-dddd-dddd-dddd-dddddddddddd
  org_id   uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  ra_uid   uuid := '<unique-uuid>';
  demo_pw  text := extensions.crypt('<password>', extensions.gen_salt('bf', 10));
BEGIN
  -- 1. auth.users        (login credentials, idempotent: look up by email
  --                       first; reuse existing id if the RA already signed up)
  -- 2. profiles          (role='partner')
  -- 3. organization_members  (Divigner)
  -- 4. ra_associates     (ra_type='company', all branding fields populated,
  --                       organization_id = Divigner)
END $$;
```

All four inserts use `ON CONFLICT ... DO UPDATE` / `DO NOTHING` so the migration
is idempotent.

---

## 8. Email notifications

The lead notification pipeline (`supabase/functions/ra-lead-submit`) is
**type-agnostic**. Every prospect submission, regardless of RA type:

- Records the lead via `record_ra_lead()`
- Sends a branded HTML email via SendGrid:
  - **TO:** prospect's email
  - **CC:** `jae@divigner.com`, `zuirrae@divigner.com`, RA's `contact_email` (deduped — no address ever appears in both TO and CC)
- Falls back gracefully if the prospect provided only a phone number (no `to` → uses internal team as `to`)

Email template uses the dark-navy Divigner branding with:
- Logo: `divigner-logo-dark.png` (white text, PNG — SVG is blocked by many email clients)
- First-name greeting, no orphaned words
- Submission details inline in the card body (no inner box) — same on desktop and mobile
- Footer linking back to the RA's demo page: `ai-automation.divigner.com/demo/<slug>`

---

## 9. Invite-flow changes needed (for the next session)

When the RA invite/onboarding flow is updated to support self-serve company signup:

1. **Add type toggle** to the invite form: Individual / Company.
2. **Branch the onboarding steps:**
   - Individual: existing flow as-is
   - Company: same contact-details page + an additional "Business" page collecting `partner_company_name`, `partner_logo_url` (with in-browser cropper, see §6), `partner_website`
3. **Branch the legal agreement** based on the toggle:
   - Individual: existing RA agreement
   - Company: new Company partner agreement (TBD — needs drafting)
   - Both: continue collecting W9
4. **Persist `ra_type`** on the `ra_associates` row.
5. **Demo template renderer** (`/demo/:slug`) reads `ra_type` and chooses Individual vs Company layout.
6. **Public field visibility:** any unfilled optional field is hidden, never rendered as empty.

---

## 10. Quick reference — files that matter

| File                                                  | What it does                                       |
| ----------------------------------------------------- | -------------------------------------------------- |
| `public/demo.html`                                    | The full public demo page (both templates today)   |
| `src/lib/landingTemplate.ts`                          | Public `/refer/:slug` form (lead capture)          |
| `src/pages/public/RaLandingPage.tsx`                  | React shell that mounts the landing template       |
| `supabase/functions/ra-lead-submit/index.ts`          | Lead capture + SendGrid email                      |
| `supabase/functions/invite-ra/index.ts`               | Invite-flow entry point (to be updated)            |
| `src/components/RaSection.tsx`                        | Admin RA list in Settings → Team                   |
| `src/pages/ra/RaDashboard.tsx`                        | Partner-side dashboard                             |
| `src/lib/data.ts` → `listRaAssociates()` etc.         | RA data queries                                    |
| `supabase/migrations/20260610100000_ra_skilldora.sql` | Bootstrap pattern reference                        |
