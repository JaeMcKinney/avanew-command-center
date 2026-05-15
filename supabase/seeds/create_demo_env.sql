-- ============================================================
-- Demo Environment Bootstrap — "Demo Co"
--
-- Creates a fully isolated demo organization with:
--   • 3 fictitious users (Owner, BD, Partner)
--   • Custom pipeline stages
--   • 10 companies, 15 contacts, 8 leads, 15 deals
--   • 12 activities, 15 tasks
--   • 3 partners, 4 vendors
--   • 25 manual cashflow transactions
--   • 2 bank connections (Plaid + Manual)
--   • 3 bank accounts (Operating, Reserve, Credit)
--   • ~210 bank transactions across the last 12 months
--
-- All data is scoped to org_id = cccccccc-cccc-cccc-cccc-cccccccccccc.
-- Multi-tenant RLS keeps it fully separated from your real Avanew /
-- Divigner data — your production records are never visible from the
-- demo workspace and vice-versa.
--
-- HOW TO USE
--   1. Paste this entire file into the Supabase SQL Editor and run it.
--   2. Sign in as any of the three demo users (password: Demo@2026!).
--   3. Switch to the "Demo Co" workspace via the top-bar org picker
--      (or visit the OrgPicker page after login).
--
--   morgan.quinn@democo.local   /  Demo@2026!   (Owner)
--   riley.carter@democo.local   /  Demo@2026!   (BD)
--   casey.walsh@democo.local    /  Demo@2026!   (Partner)
--
-- TO REMOVE EVERYTHING:
--   Run supabase/seeds/purge_demo_env.sql
--
-- Safe to run multiple times — every operation is idempotent.
-- ============================================================

-- ── 0. Relax pipeline_stages name uniqueness ─────────────────────────────────
-- The base schema has UNIQUE(name) on pipeline_stages, which prevents each
-- org from having its own copy of "New", "Lead", "Qualified" etc. Convert it
-- to UNIQUE(name, organization_id) so per-org stages can coexist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pipeline_stages_name_key'
      AND conrelid = 'public.pipeline_stages'::regclass
  ) THEN
    ALTER TABLE public.pipeline_stages DROP CONSTRAINT pipeline_stages_name_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pipeline_stages_name_org_key'
      AND conrelid = 'public.pipeline_stages'::regclass
  ) THEN
    ALTER TABLE public.pipeline_stages
      ADD CONSTRAINT pipeline_stages_name_org_key UNIQUE (name, organization_id);
  END IF;
END $$;

DO $$
DECLARE
  -- ── Identity ──
  demo_org   uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  u_owner    uuid := 'cccccccc-cccc-cccc-cccc-000000000001';
  u_bd       uuid := 'cccccccc-cccc-cccc-cccc-000000000002';
  u_partner  uuid := 'cccccccc-cccc-cccc-cccc-000000000003';
  demo_pw    text := crypt('Demo@2026!', gen_salt('bf', 10));

  -- ── Stages ──
  s_new uuid; s_lead uuid; s_qual uuid; s_prop uuid; s_neg uuid; s_won uuid; s_lost uuid;

  -- ── Partners ──
  p_north  uuid := gen_random_uuid();
  p_acme   uuid := gen_random_uuid();
  p_bright uuid := gen_random_uuid();

  -- ── Vendors ──
  v_aws    uuid := gen_random_uuid();
  v_github uuid := gen_random_uuid();
  v_slack  uuid := gen_random_uuid();
  v_gusto  uuid := gen_random_uuid();

  -- ── Companies ──
  c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid(); c4 uuid := gen_random_uuid();
  c5 uuid := gen_random_uuid(); c6 uuid := gen_random_uuid();
  c7 uuid := gen_random_uuid(); c8 uuid := gen_random_uuid();
  c9 uuid := gen_random_uuid(); c10 uuid := gen_random_uuid();

  -- ── Contacts ──
  ct1 uuid := gen_random_uuid();  ct2 uuid := gen_random_uuid();
  ct3 uuid := gen_random_uuid();  ct4 uuid := gen_random_uuid();
  ct5 uuid := gen_random_uuid();  ct6 uuid := gen_random_uuid();
  ct7 uuid := gen_random_uuid();  ct8 uuid := gen_random_uuid();
  ct9 uuid := gen_random_uuid();  ct10 uuid := gen_random_uuid();
  ct11 uuid := gen_random_uuid(); ct12 uuid := gen_random_uuid();
  ct13 uuid := gen_random_uuid(); ct14 uuid := gen_random_uuid();
  ct15 uuid := gen_random_uuid();

  -- ── Leads ──
  l1 uuid := gen_random_uuid(); l2 uuid := gen_random_uuid();
  l3 uuid := gen_random_uuid(); l4 uuid := gen_random_uuid();
  l5 uuid := gen_random_uuid(); l6 uuid := gen_random_uuid();
  l7 uuid := gen_random_uuid(); l8 uuid := gen_random_uuid();

  -- ── Deals ──
  d1 uuid := gen_random_uuid();  d2 uuid := gen_random_uuid();
  d3 uuid := gen_random_uuid();  d4 uuid := gen_random_uuid();
  d5 uuid := gen_random_uuid();  d6 uuid := gen_random_uuid();
  d7 uuid := gen_random_uuid();  d8 uuid := gen_random_uuid();
  d9 uuid := gen_random_uuid();  d10 uuid := gen_random_uuid();
  d11 uuid := gen_random_uuid(); d12 uuid := gen_random_uuid();
  d13 uuid := gen_random_uuid(); d14 uuid := gen_random_uuid();
  d15 uuid := gen_random_uuid();

  -- ── Bank ──
  conn_plaid  uuid := gen_random_uuid();
  conn_manual uuid := gen_random_uuid();
  acct_op     uuid := gen_random_uuid();
  acct_res    uuid := gen_random_uuid();
  acct_credit uuid := gen_random_uuid();

  -- ── Loop scratch ──
  d_cursor date;
  iter     int;
  txid     text;
BEGIN

  -- ── 1. Organization ─────────────────────────────────────────────────────────
  INSERT INTO public.organizations (id, name, slug)
  VALUES (demo_org, 'Demo Co', 'democo')
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        slug = EXCLUDED.slug;

  -- ── 2. Auth users ───────────────────────────────────────────────────────────
  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES
    (
      '00000000-0000-0000-0000-000000000000', u_owner,
      'authenticated', 'authenticated',
      'morgan.quinn@democo.local', demo_pw,
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Morgan Quinn"}',
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', u_bd,
      'authenticated', 'authenticated',
      'riley.carter@democo.local', demo_pw,
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Riley Carter"}',
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', u_partner,
      'authenticated', 'authenticated',
      'casey.walsh@democo.local', demo_pw,
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Casey Walsh"}',
      now(), now(), '', '', '', ''
    )
  ON CONFLICT (id) DO NOTHING;

  -- ── 3. Profiles ─────────────────────────────────────────────────────────────
  -- (handle_new_user fires from the auth.users insert above and pre-creates
  -- profile rows with role='member'. Override to the correct roles here.)
  INSERT INTO public.profiles (id, email, full_name, role) VALUES
    (u_owner,   'morgan.quinn@democo.local', 'Morgan Quinn', 'owner'),
    (u_bd,      'riley.carter@democo.local', 'Riley Carter', 'bd'),
    (u_partner, 'casey.walsh@democo.local',  'Casey Walsh',  'partner')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = EXCLUDED.role,
        email     = EXCLUDED.email;

  -- ── 4. Org membership ──────────────────────────────────────────────────────
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
    (demo_org, u_owner,   'owner'),
    (demo_org, u_bd,      'bd'),
    (demo_org, u_partner, 'partner')
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- ── 5. Pipeline stages ─────────────────────────────────────────────────────
  s_new  := gen_random_uuid();
  s_lead := gen_random_uuid();
  s_qual := gen_random_uuid();
  s_prop := gen_random_uuid();
  s_neg  := gen_random_uuid();
  s_won  := gen_random_uuid();
  s_lost := gen_random_uuid();

  INSERT INTO public.pipeline_stages (id, name, position, is_won, is_lost, organization_id) VALUES
    (s_new,  'New',         1, false, false, demo_org),
    (s_lead, 'Lead',        2, false, false, demo_org),
    (s_qual, 'Qualified',   3, false, false, demo_org),
    (s_prop, 'Proposal',    4, false, false, demo_org),
    (s_neg,  'Negotiation', 5, false, false, demo_org),
    (s_won,  'Closed Won',  6, true,  false, demo_org),
    (s_lost, 'Closed Lost', 7, false, true,  demo_org)
  ON CONFLICT (name, organization_id) DO NOTHING;

  -- Re-fetch in case rows already existed
  SELECT id INTO s_new  FROM public.pipeline_stages WHERE organization_id = demo_org AND name = 'New';
  SELECT id INTO s_lead FROM public.pipeline_stages WHERE organization_id = demo_org AND name = 'Lead';
  SELECT id INTO s_qual FROM public.pipeline_stages WHERE organization_id = demo_org AND name = 'Qualified';
  SELECT id INTO s_prop FROM public.pipeline_stages WHERE organization_id = demo_org AND name = 'Proposal';
  SELECT id INTO s_neg  FROM public.pipeline_stages WHERE organization_id = demo_org AND name = 'Negotiation';
  SELECT id INTO s_won  FROM public.pipeline_stages WHERE organization_id = demo_org AND name = 'Closed Won';
  SELECT id INTO s_lost FROM public.pipeline_stages WHERE organization_id = demo_org AND name = 'Closed Lost';

  -- ── 6. Partners ────────────────────────────────────────────────────────────
  INSERT INTO public.partners (id, name, type, email, phone, website, status, revenue_share, agreement_start_date, notes, organization_id) VALUES
    (p_north,  'Northwind Capital',     'Investor',          'partners@northwindcap.com',      '212-800-1001', 'https://northwindcap.com',     'Active', '8% carry',          '2024-01-15', 'Lead investor, board observer seat.',         demo_org),
    (p_acme,   'Acme Referrals LLC',    'Referral Partner',  'referrals@acmepartners.com',     '415-800-2002', 'https://acmepartners.com',     'Active', '15% of first year', '2024-06-01', 'High-volume referral partner in SaaS.',       demo_org),
    (p_bright, 'BrightPath Consulting', 'Implementation',    'hello@brightpathconsulting.io',  '512-800-3003', 'https://brightpathconsulting.io','Active','10% implementation','2025-01-01', 'Handles enterprise onboarding engagements.',  demo_org)
  ON CONFLICT (id) DO NOTHING;

  -- ── 7. Vendors ─────────────────────────────────────────────────────────────
  INSERT INTO public.vendors (id, name, service, email, phone, website, status, cost_structure, payment_terms, performance_notes, organization_id) VALUES
    (v_aws,    'Amazon Web Services',  'Cloud Infrastructure', 'aws-billing@amazon.com',         '206-900-1001', 'https://aws.amazon.com',       'Active', '$4,200/mo',  'Net 30', 'EC2, RDS, S3.',           demo_org),
    (v_github, 'GitHub (Microsoft)',   'Dev Tools',            'enterprise@github.com',          '415-900-2002', 'https://github.com/enterprise','Active', '$500/mo',    'Net 30', 'Team plan, 25 seats.',    demo_org),
    (v_slack,  'Slack (Salesforce)',   'Team Communication',   'billing@slack.com',              '415-900-3003', 'https://slack.com',            'Active', '$400/mo',    'Net 30', 'Business+ plan.',         demo_org),
    (v_gusto,  'Gusto',                'Payroll & HR',         'support@gusto.com',              '800-900-4004', 'https://gusto.com',            'Active', '$18,000/mo', 'Net 15', 'Full payroll + benefits.',demo_org)
  ON CONFLICT (id) DO NOTHING;

  -- ── 8. Companies (10) ──────────────────────────────────────────────────────
  INSERT INTO public.companies (id, name, domain, industry, account_type, employees, annual_revenue, website, rating, owner_id, organization_id) VALUES
    (c1,  'Orion Technologies',    'oriontech.com',      'Technology',         'Customer', 240, 7200000,  'https://oriontech.com',      'Hot',  u_owner,   demo_org),
    (c2,  'Vertex Labs',           'vertexlabs.io',      'Software',           'Customer', 95,  2800000,  'https://vertexlabs.io',      'Warm', u_bd,      demo_org),
    (c3,  'Summit Financial',      'summitfin.com',      'Financial Services', 'Prospect', 60,  18000000, 'https://summitfin.com',      'Warm', u_owner,   demo_org),
    (c4,  'Cascade Health',        'cascadehealth.org',  'Healthcare',         'Customer', 180, 4600000,  'https://cascadehealth.org',  'Hot',  u_bd,      demo_org),
    (c5,  'Pioneer Logistics',     'pioneerlog.com',     'Logistics',          'Prospect', 540, 19500000, 'https://pioneerlog.com',     'Warm', u_owner,   demo_org),
    (c6,  'Titan Manufacturing',   'titanmfg.com',       'Manufacturing',      'Customer', 410, 28000000, 'https://titanmfg.com',       'Cold', u_owner,   demo_org),
    (c7,  'Lumen Studios',         'lumenstudios.co',    'Media',              'Prospect', 35,  850000,   'https://lumenstudios.co',    'Hot',  u_partner, demo_org),
    (c8,  'Beacon Realty',         'beaconrealty.com',   'Real Estate',        'Customer', 110, 7400000,  'https://beaconrealty.com',   'Warm', u_partner, demo_org),
    (c9,  'Helix BioSystems',      'helixbio.com',       'Biotech',            'Customer', 75,  3300000,  'https://helixbio.com',       'Hot',  u_bd,      demo_org),
    (c10, 'Anchor Retail Group',   'anchorretail.com',   'Retail',             'Prospect', 320, 22000000, 'https://anchorretail.com',   'Warm', u_bd,      demo_org)
  ON CONFLICT (id) DO NOTHING;

  -- ── 9. Contacts (15) ───────────────────────────────────────────────────────
  INSERT INTO public.contacts (id, first_name, last_name, email, phone, title, company_id, owner_id, organization_id) VALUES
    (ct1,  'Olivia',  'Reyes',     'oreyes@oriontech.com',     '415-202-1001', 'CTO',                 c1,  u_owner,   demo_org),
    (ct2,  'Devon',   'Sutherland','dsuth@oriontech.com',      '415-202-1002', 'VP of Engineering',   c1,  u_owner,   demo_org),
    (ct3,  'Maya',    'Khoury',    'mkhoury@vertexlabs.io',    '512-303-2001', 'CEO',                 c2,  u_bd,      demo_org),
    (ct4,  'Ethan',   'Park',      'epark@vertexlabs.io',      '512-303-2002', 'Head of Product',     c2,  u_bd,      demo_org),
    (ct5,  'Naomi',   'Ito',       'nito@summitfin.com',       '212-404-3001', 'Managing Director',   c3,  u_owner,   demo_org),
    (ct6,  'Theo',    'Bramble',   'tbramble@cascadehealth.org','303-505-4001','Director of IT',      c4,  u_bd,      demo_org),
    (ct7,  'Imani',   'Okonkwo',   'iokonkwo@cascadehealth.org','303-505-4002','COO',                 c4,  u_bd,      demo_org),
    (ct8,  'Felix',   'Garner',    'fgarner@pioneerlog.com',   '704-606-5001', 'SVP Operations',      c5,  u_owner,   demo_org),
    (ct9,  'Priya',   'Mehta',     'pmehta@titanmfg.com',      '414-707-6001', 'Procurement Manager', c6,  u_owner,   demo_org),
    (ct10, 'Soren',   'Vance',     'svance@lumenstudios.co',   '323-808-7001', 'Head of Partnerships',c7,  u_partner, demo_org),
    (ct11, 'Harper',  'Nicholson', 'hnicholson@beaconrealty.com','619-909-8001','VP of Technology',   c8,  u_partner, demo_org),
    (ct12, 'Wei',     'Zhang',     'wzhang@summitfin.com',     '212-404-3002', 'CFO',                 c3,  u_owner,   demo_org),
    (ct13, 'Adira',   'Cohen',     'acohen@helixbio.com',      '617-010-9001', 'Director of R&D',     c9,  u_bd,      demo_org),
    (ct14, 'Reuben',  'Castillo',  'rcastillo@helixbio.com',   '617-010-9002', 'Head of Operations',  c9,  u_bd,      demo_org),
    (ct15, 'Mira',    'Halvorsen', 'mhalvorsen@anchorretail.com','312-111-1001','SVP Digital',        c10, u_bd,      demo_org)
  ON CONFLICT (id) DO NOTHING;

  -- ── 10. Leads (8) ──────────────────────────────────────────────────────────
  INSERT INTO public.leads (id, first_name, last_name, email, phone, company, title, lead_status, lead_source, industry, annual_revenue, rating, owner_id, organization_id) VALUES
    (l1, 'Nadia',   'Bellamy',  'nbellamy@quantumshift.ai',  '628-201-0001', 'Quantum Shift AI',  'CEO',              'New',       'Web',       'Technology', 4100000,  'Hot',  u_bd,      demo_org),
    (l2, 'Hugo',    'Lindstrom','hlindstrom@kindredhr.com',  '720-202-0002', 'Kindred HR',        'VP of Sales',      'Contacted', 'Referral',  'HR Tech',    1700000,  'Warm', u_bd,      demo_org),
    (l3, 'Ravi',    'Subraman', 'rsubraman@meridiansys.net', '503-203-0003', 'Meridian Systems',  'Director of IT',   'Qualified', 'Cold Call', 'Software',   6200000,  'Hot',  u_owner,   demo_org),
    (l4, 'Junko',   'Yamada',   'jyamada@volttech.com',      '858-204-0004', 'Volt Energy Tech',  'COO',              'New',       'LinkedIn',  'CleanTech',  9300000,  'Warm', u_partner, demo_org),
    (l5, 'Camille', 'Dupont',   'cdupont@arcfinance.io',     '312-205-0005', 'Arc Finance',       'Partner',          'Contacted', 'Conference','Finance',    27000000, 'Hot',  u_bd,      demo_org),
    (l6, 'Bo',      'Hartwell', 'bhartwell@northpeakgear.com','206-206-0006','Northpeak Outdoor', 'Founder',          'New',       'Web',       'Retail',     2400000,  'Warm', u_partner, demo_org),
    (l7, 'Aurora',  'Volkov',   'avolkov@starline.travel',   '702-207-0007', 'Starline Travel',   'Head of Strategy', 'Qualified', 'Referral',  'Travel',     5500000,  'Hot',  u_owner,   demo_org),
    (l8, 'Marcus',  'Tan',      'mtan@brickyardlabs.com',    '617-208-0008', 'Brickyard Labs',    'CTO',              'Contacted', 'LinkedIn',  'Biotech',    11000000, 'Warm', u_bd,      demo_org)
  ON CONFLICT (id) DO NOTHING;

  -- ── 11. Deals (15) ─────────────────────────────────────────────────────────
  INSERT INTO public.deals (id, title, amount, stage_id, contact_id, company_id, owner_id, expected_close_date, probability, type, lead_source, organization_id) VALUES
    (d1,  'Orion — Platform License',           52000, s_proposal,    ct1,  c1,  u_owner,   current_date + 14,  60,  'New Business', 'Web',        demo_org),
    (d2,  'Orion — API Integration',            24000, s_neg,         ct2,  c1,  u_owner,   current_date + 7,   80,  'Expansion',    'Web',        demo_org),
    (d3,  'Vertex — Annual SaaS',               38000, s_qual,        ct3,  c2,  u_bd,      current_date + 30,  40,  'New Business', 'Referral',   demo_org),
    (d4,  'Vertex — Onboarding Package',         9500, s_won,         ct4,  c2,  u_bd,      current_date - 10,  100, 'Add-on',       'Referral',   demo_org),
    (d5,  'Summit — Advisory Retainer',         64000, s_proposal,    ct5,  c3,  u_owner,   current_date + 21,  55,  'New Business', 'Cold Call',  demo_org),
    (d6,  'Cascade — HIPAA Compliance Suite',   78000, s_lead,        ct6,  c4,  u_bd,      current_date + 45,  25,  'New Business', 'Conference', demo_org),
    (d7,  'Cascade — IT Infrastructure',        19500, s_qual,        ct7,  c4,  u_bd,      current_date + 20,  45,  'Expansion',    'Conference', demo_org),
    (d8,  'Pioneer — Supply Chain Module',      96000, s_new,         ct8,  c5,  u_owner,   current_date + 60,  15,  'New Business', 'LinkedIn',   demo_org),
    (d9,  'Lumen — Content Analytics',          15500, s_neg,         ct10, c7,  u_partner, current_date + 5,   85,  'New Business', 'Web',        demo_org),
    (d10, 'Beacon — CRM Migration',             31000, s_lost,        ct11, c8,  u_partner, current_date - 30,  0,   'New Business', 'Referral',   demo_org),
    (d11, 'Helix — Lab Data Platform',          45000, s_proposal,    ct13, c9,  u_bd,      current_date + 12,  65,  'New Business', 'Web',        demo_org),
    (d12, 'Helix — Quarterly Reporting Add-on',  8000, s_won,         ct14, c9,  u_bd,      current_date - 5,   100, 'Add-on',       'Referral',   demo_org),
    (d13, 'Anchor — Loyalty Pilot',             22000, s_qual,        ct15, c10, u_bd,      current_date + 25,  50,  'New Business', 'LinkedIn',   demo_org),
    (d14, 'Titan — Procurement Automation',     58000, s_lead,        ct9,  c6,  u_owner,   current_date + 55,  20,  'New Business', 'Cold Call',  demo_org),
    (d15, 'Summit — CFO Toolkit Renewal',       42000, s_neg,         ct12, c3,  u_owner,   current_date + 3,   75,  'Renewal',      'Cold Call',  demo_org)
  ON CONFLICT (id) DO NOTHING;

  -- ── 12. Activities (12) ────────────────────────────────────────────────────
  INSERT INTO public.activities (type, subject, body, contact_id, company_id, deal_id, owner_id, due_at, completed_at, organization_id) VALUES
    ('call',    'Intro call — Olivia Reyes',           'Walked through platform needs. Strong fit identified.',                    ct1,  c1, d1,   u_owner,   now() - interval '5 days',  now() - interval '5 days',  demo_org),
    ('email',   'Proposal sent — Orion Technologies',  'Shared pricing deck and implementation timeline.',                         ct1,  c1, d1,   u_owner,   now() - interval '2 days',  now() - interval '2 days',  demo_org),
    ('meeting', 'API demo with Devon Sutherland',      'Live walkthrough. Asked about SSO + audit logging.',                       ct2,  c1, d2,   u_owner,   now() - interval '3 days',  now() - interval '3 days',  demo_org),
    ('call',    'Discovery — Vertex Labs',             'Maya confirmed budget approved for Q3.',                                   ct3,  c2, d3,   u_bd,      now() - interval '7 days',  now() - interval '7 days',  demo_org),
    ('email',   'Vertex onboarding confirmation',      'Sent signed contract and onboarding schedule.',                            ct4,  c2, d4,   u_bd,      now() - interval '11 days', now() - interval '11 days', demo_org),
    ('meeting', 'Summit advisory scope review',        'Aligned on Q3 deliverables. Legal review in progress.',                    ct5,  c3, d5,   u_owner,   now() - interval '4 days',  now() - interval '4 days',  demo_org),
    ('call',    'Cascade HIPAA walkthrough',           'Theo outlined compliance gaps. Scheduling assessment.',                    ct6,  c4, d6,   u_bd,      now() + interval '2 days',  NULL,                       demo_org),
    ('email',   'Cascade IT proposal follow-up',       'Sent revised quote incorporating server migration scope.',                 ct7,  c4, d7,   u_bd,      now() - interval '1 day',   now() - interval '1 day',   demo_org),
    ('meeting', 'Pioneer intro — supply chain demo',   'Initial walkthrough. Wants to involve VP of Tech next.',                   ct8,  c5, d8,   u_owner,   now() + interval '5 days',  NULL,                       demo_org),
    ('call',    'Lumen final negotiation',             'Soren confirmed 12-month commitment. Working contract language.',          ct10, c7, d9,   u_partner, now() + interval '1 day',   NULL,                       demo_org),
    ('email',   'Beacon post-mortem debrief',          'Reached out to understand competitor decision.',                           ct11, c8, d10,  u_partner, now() - interval '25 days', now() - interval '25 days', demo_org),
    ('task',    'Prepare QBR slides — Orion',          'Usage stats, ROI summary, and expansion opportunities.',                   ct1,  c1, d1,   u_owner,   now() + interval '7 days',  NULL,                       demo_org)
  ON CONFLICT DO NOTHING;

  -- ── 13. Tasks (15) ─────────────────────────────────────────────────────────
  INSERT INTO public.tasks (subject, status, priority, owner_id, contact_id, deal_id, lead_id, due_date, description, organization_id) VALUES
    ('Send contract redline to Orion',          'In Progress', 'High',   u_owner,   ct1,  d1,   NULL, current_date + 2,  'Legal requested two changes — send updated doc.',         demo_org),
    ('Schedule technical review — Cascade',     'Not Started', 'High',   u_bd,      ct6,  d6,   NULL, current_date + 4,  'Needs their IT architect on the call.',                   demo_org),
    ('Prepare case study for Summit',           'Not Started', 'Normal', u_owner,   ct5,  d5,   NULL, current_date + 10, 'Use Orion as reference customer.',                        demo_org),
    ('Follow up with Pioneer VP of Tech',       'Not Started', 'Normal', u_owner,   ct8,  d8,   NULL, current_date + 3,  'Felix said he''d make intro by end of week.',             demo_org),
    ('Lumen — finalize contract',               'In Progress', 'High',   u_partner, ct10, d9,   NULL, current_date + 1,  'One open clause on data retention — legal to sign off.',  demo_org),
    ('Vertex — send onboarding checklist',      'Completed',   'Normal', u_bd,      ct4,  d4,   NULL, current_date - 8,  'All items sent and acknowledged.',                        demo_org),
    ('Research Kindred HR decision-maker',      'Not Started', 'Low',    u_bd,      NULL, NULL, l2,   current_date + 7,  'Find the right contact before next outreach.',            demo_org),
    ('Qualify Meridian Systems lead',           'In Progress', 'High',   u_owner,   NULL, NULL, l3,   current_date + 2,  'Schedule discovery call this week.',                      demo_org),
    ('Update deal amounts in pipeline',         'Not Started', 'Low',    u_owner,   NULL, NULL, NULL, current_date + 5,  'Align amounts with latest pricing sheet.',                demo_org),
    ('Internal review: Titan opportunity',      'Not Started', 'Normal', u_owner,   ct9,  d14,  NULL, current_date + 14, 'Assess whether this is worth pursuing.',                  demo_org),
    ('Helix — discovery follow-up notes',       'Completed',   'Normal', u_bd,      ct13, d11,  NULL, current_date - 3,  'Recap shared with team.',                                 demo_org),
    ('Anchor — pilot scoping doc',              'In Progress', 'High',   u_bd,      ct15, d13,  NULL, current_date + 6,  'Draft pilot criteria and success metrics.',               demo_org),
    ('Volt Energy — schedule discovery',        'Not Started', 'Normal', u_partner, NULL, NULL, l4,   current_date + 9,  'Junko is open to a 30-min intro.',                        demo_org),
    ('Quarterly partner review — Northwind',    'Not Started', 'Normal', u_owner,   NULL, NULL, NULL, current_date + 21, 'Prepare partner performance dashboard.',                  demo_org),
    ('Summit — renewal kickoff',                'In Progress', 'High',   u_owner,   ct12, d15,  NULL, current_date + 2,  'Wei requested updated pricing for Q3.',                   demo_org)
  ON CONFLICT DO NOTHING;

  -- ── 14. Manual cashflow transactions (25) ──────────────────────────────────
  INSERT INTO public.cashflow_transactions (type, category, description, amount, date, is_recurring, recurrence_period, partner_id, vendor_id, reference, organization_id) VALUES
    -- Income
    ('income',  'Revenue',       'Orion Technologies — Q2 platform license',     52000, current_date - 45, false, NULL,      p_acme,  NULL,    'INV-2026-101', demo_org),
    ('income',  'Revenue',       'Vertex Labs — annual SaaS contract',           38000, current_date - 30, false, NULL,      NULL,    NULL,    'INV-2026-102', demo_org),
    ('income',  'Revenue',       'Cascade Health — IT infrastructure',           19500, current_date - 20, false, NULL,      NULL,    NULL,    'INV-2026-103', demo_org),
    ('income',  'Revenue',       'Beacon Realty — CRM setup',                    15500, current_date - 60, false, NULL,      p_acme,  NULL,    'INV-2026-098', demo_org),
    ('income',  'Revenue',       'Summit Financial — advisory retainer',         16000, current_date - 15, true,  'monthly', NULL,    NULL,    'INV-2026-104', demo_org),
    ('income',  'Revenue',       'Summit Financial — advisory retainer',         16000, current_date - 45, true,  'monthly', NULL,    NULL,    'INV-2026-100', demo_org),
    ('income',  'Revenue',       'Vertex Labs — onboarding package',              9500, current_date - 12, false, NULL,      NULL,    NULL,    'INV-2026-105', demo_org),
    ('income',  'Referral Fee',  'Northwind Capital — referral commission',       5200, current_date - 8,  false, NULL,      p_north, NULL,    'REF-2026-021', demo_org),
    ('income',  'Revenue',       'Titan Manufacturing — pilot project',          13000, current_date - 5,  false, NULL,      NULL,    NULL,    'INV-2026-106', demo_org),
    ('income',  'Revenue',       'Lumen Studios — analytics module',              7000, current_date - 2,  false, NULL,      p_bright,NULL,    'INV-2026-107', demo_org),
    ('income',  'Revenue',       'Helix BioSystems — reporting add-on',           8000, current_date - 6,  false, NULL,      NULL,    NULL,    'INV-2026-108', demo_org),
    ('income',  'Revenue',       'Anchor Retail — discovery engagement',          6500, current_date - 18, false, NULL,      p_bright,NULL,    'INV-2026-099', demo_org),
    -- Expenses
    ('expense', 'Infrastructure','AWS — monthly cloud bill',                      4200, current_date - 1,  true,  'monthly', NULL,    v_aws,   'AWS-MAY-2026', demo_org),
    ('expense', 'Infrastructure','AWS — monthly cloud bill',                      4200, current_date - 31, true,  'monthly', NULL,    v_aws,   'AWS-APR-2026', demo_org),
    ('expense', 'Software',      'GitHub — team plan',                             500, current_date - 1,  true,  'monthly', NULL,    v_github,'GH-MAY-2026',  demo_org),
    ('expense', 'Software',      'Slack — Business+ plan',                         400, current_date - 1,  true,  'monthly', NULL,    v_slack, 'SLK-MAY-2026', demo_org),
    ('expense', 'Payroll',       'Gusto — payroll May 2026',                     18000, current_date - 3,  true,  'monthly', NULL,    v_gusto, 'PAY-MAY-2026', demo_org),
    ('expense', 'Payroll',       'Gusto — payroll Apr 2026',                     18000, current_date - 33, true,  'monthly', NULL,    v_gusto, 'PAY-APR-2026', demo_org),
    ('expense', 'Marketing',     'LinkedIn Ads — April campaign',                 2400, current_date - 35, false, NULL,      NULL,    NULL,    'LI-APR-2026',  demo_org),
    ('expense', 'Marketing',     'LinkedIn Ads — May campaign',                   2400, current_date - 5,  false, NULL,      NULL,    NULL,    'LI-MAY-2026',  demo_org),
    ('expense', 'Travel',        'NYC client meetings — flights + hotel',         3600, current_date - 18, false, NULL,      NULL,    NULL,    'EXP-T-104',    demo_org),
    ('expense', 'Professional Services','Legal review — contracts',                4800, current_date - 10, false, NULL,      NULL,    NULL,    'LEGAL-MAY-26', demo_org),
    ('expense', 'Professional Services','Accounting — Q1 close',                   3200, current_date - 40, false, NULL,      NULL,    NULL,    'ACCT-Q1-26',   demo_org),
    ('expense', 'Office',        'Coworking — May membership',                    1800, current_date - 7,  true,  'monthly', NULL,    NULL,    'WS-MAY-2026',  demo_org),
    ('expense', 'Office',        'Coworking — April membership',                  1800, current_date - 37, true,  'monthly', NULL,    NULL,    'WS-APR-2026',  demo_org)
  ON CONFLICT DO NOTHING;

  -- ── 15. Bank connections ───────────────────────────────────────────────────
  INSERT INTO public.bank_connections (id, provider, institution_name, institution_id, status, last_sync_at, organization_id) VALUES
    (conn_plaid,  'plaid',  'First Republic Bank', 'ins_demo_first_republic', 'active', now() - interval '1 hour', demo_org),
    (conn_manual, 'manual', 'Capital One Spark',   NULL,                      'active', now() - interval '1 day',  demo_org)
  ON CONFLICT (id) DO NOTHING;

  -- ── 16. Bank accounts ──────────────────────────────────────────────────────
  INSERT INTO public.bank_accounts (id, bank_connection_id, external_account_id, name, type, subtype, balance_current, balance_available, currency, institution_name, is_active, last_updated, organization_id) VALUES
    (acct_op,     conn_plaid,  'plaid_acct_op_001',  'Operating Checking', 'checking',   'checking',  187420.55, 187420.55, 'USD', 'First Republic Bank', true, now() - interval '1 hour', demo_org),
    (acct_res,    conn_plaid,  'plaid_acct_res_002', 'Reserve Savings',    'savings',    'savings',   425000.00, 425000.00, 'USD', 'First Republic Bank', true, now() - interval '1 hour', demo_org),
    (acct_credit, conn_manual, 'manual_acct_cc_003', 'Spark Cash Plus',    'credit',     'credit_card',-12830.18, 87169.82, 'USD', 'Capital One Spark',   true, now() - interval '1 day',  demo_org)
  ON CONFLICT (id) DO NOTHING;

  -- ── 17. Bank transactions — 12 months ──────────────────────────────────────
  -- Monthly recurring expenses (going back 12 months)
  iter := 0;
  FOR d_cursor IN
    SELECT (current_date - (n || ' months')::interval)::date
    FROM generate_series(0, 11) AS n
  LOOP
    iter := iter + 1;

    -- Payroll (Gusto, 1st of month)
    INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, vendor_id, organization_id) VALUES
      (conn_plaid, acct_op, 'plaid', 'tx_payroll_' || iter, date_trunc('month', d_cursor)::date + 2, 'Gusto Payroll',                   -18000, 'USD', 'Payroll',        false, 'Gusto',          v_gusto,  demo_org)
    ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;

    -- AWS (5th of month)
    INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, vendor_id, organization_id) VALUES
      (conn_plaid, acct_op, 'plaid', 'tx_aws_' || iter, date_trunc('month', d_cursor)::date + 5, 'AWS — monthly cloud',              -4200, 'USD', 'Infrastructure', false, 'Amazon Web Services', v_aws, demo_org)
    ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;

    -- GitHub (3rd)
    INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, vendor_id, organization_id) VALUES
      (conn_plaid, acct_op, 'plaid', 'tx_github_' || iter, date_trunc('month', d_cursor)::date + 3, 'GitHub Team Plan',                 -500, 'USD', 'Software',       false, 'GitHub',         v_github, demo_org)
    ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;

    -- Slack (3rd)
    INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, vendor_id, organization_id) VALUES
      (conn_plaid, acct_op, 'plaid', 'tx_slack_' || iter, date_trunc('month', d_cursor)::date + 3, 'Slack Business+',                  -400, 'USD', 'Software',       false, 'Slack',          v_slack,  demo_org)
    ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;

    -- Coworking (7th)
    INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, vendor_id, organization_id) VALUES
      (conn_plaid, acct_op, 'plaid', 'tx_coworking_' || iter, date_trunc('month', d_cursor)::date + 7, 'WeWork Coworking',             -1800, 'USD', 'Expense',        false, 'WeWork',         NULL,     demo_org)
    ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;

    -- Quarterly tax payment (only in months 3, 6, 9, 12 back)
    IF iter % 3 = 0 THEN
      INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, vendor_id, organization_id) VALUES
        (conn_plaid, acct_op, 'plaid', 'tx_tax_' || iter, date_trunc('month', d_cursor)::date + 14, 'Quarterly federal estimated tax',  -8500, 'USD', 'Tax Payment',  false, 'IRS', NULL, demo_org)
      ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Weekly revenue deposits (last 52 weeks). Amount varies $4k–$22k pseudo-randomly.
  iter := 0;
  FOR d_cursor IN
    SELECT (current_date - (n || ' weeks')::interval)::date
    FROM generate_series(0, 51) AS n
  LOOP
    iter := iter + 1;
    INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, vendor_id, partner_id, organization_id) VALUES
      (
        conn_plaid, acct_op, 'plaid',
        'tx_rev_' || iter,
        d_cursor,
        CASE (iter % 6)
          WHEN 0 THEN 'Orion Technologies — invoice payment'
          WHEN 1 THEN 'Vertex Labs — invoice payment'
          WHEN 2 THEN 'Summit Financial — advisory retainer'
          WHEN 3 THEN 'Cascade Health — services'
          WHEN 4 THEN 'Helix BioSystems — invoice payment'
          ELSE        'Anchor Retail — invoice payment'
        END,
        4000 + ((iter * 1373) % 18000)::numeric,
        'USD', 'Revenue', false,
        CASE (iter % 6)
          WHEN 0 THEN 'Orion Technologies'
          WHEN 1 THEN 'Vertex Labs'
          WHEN 2 THEN 'Summit Financial'
          WHEN 3 THEN 'Cascade Health'
          WHEN 4 THEN 'Helix BioSystems'
          ELSE        'Anchor Retail'
        END,
        NULL,
        CASE WHEN iter % 7 = 0 THEN p_acme WHEN iter % 11 = 0 THEN p_bright ELSE NULL END,
        demo_org
      )
    ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;
  END LOOP;

  -- Scattered marketing / travel / contractor expenses (~bi-weekly, 26 entries)
  iter := 0;
  FOR d_cursor IN
    SELECT (current_date - (n * 14 || ' days')::interval)::date
    FROM generate_series(0, 25) AS n
  LOOP
    iter := iter + 1;
    INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, organization_id) VALUES
      (
        conn_plaid, acct_op, 'plaid',
        'tx_misc_' || iter,
        d_cursor,
        CASE (iter % 5)
          WHEN 0 THEN 'LinkedIn Ads campaign'
          WHEN 1 THEN 'Contractor — design work'
          WHEN 2 THEN 'Travel — client meetings'
          WHEN 3 THEN 'Legal review — contracts'
          ELSE        'Professional services'
        END,
        -1 * (800 + ((iter * 919) % 4500))::numeric,
        'USD',
        CASE (iter % 5)
          WHEN 0 THEN 'Expense'
          WHEN 1 THEN 'Contractor'
          WHEN 2 THEN 'Expense'
          WHEN 3 THEN 'Expense'
          ELSE        'Expense'
        END,
        false,
        CASE (iter % 5)
          WHEN 0 THEN 'LinkedIn'
          WHEN 1 THEN 'Upwork'
          WHEN 2 THEN 'Delta Air Lines'
          WHEN 3 THEN 'Wilson Sonsini'
          ELSE        'PwC'
        END,
        demo_org
      )
    ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;
  END LOOP;

  -- Credit card transactions on Spark (small frequent expenses, weekly)
  iter := 0;
  FOR d_cursor IN
    SELECT (current_date - (n || ' weeks')::interval)::date
    FROM generate_series(0, 51) AS n
  LOOP
    iter := iter + 1;
    INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, organization_id) VALUES
      (
        conn_manual, acct_credit, 'manual',
        'tx_cc_' || iter,
        d_cursor,
        CASE (iter % 4)
          WHEN 0 THEN 'Uber — client travel'
          WHEN 1 THEN 'Notion — annual'
          WHEN 2 THEN 'Figma — team'
          ELSE        'Zoom — Business'
        END,
        -1 * (45 + ((iter * 211) % 380))::numeric,
        'USD',
        CASE (iter % 4)
          WHEN 0 THEN 'Expense'
          ELSE 'Software'
        END,
        false,
        CASE (iter % 4)
          WHEN 0 THEN 'Uber'
          WHEN 1 THEN 'Notion'
          WHEN 2 THEN 'Figma'
          ELSE        'Zoom'
        END,
        demo_org
      )
    ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;
  END LOOP;

  -- A few transfers between Operating and Reserve (every other month)
  iter := 0;
  FOR d_cursor IN
    SELECT (current_date - (n * 2 || ' months')::interval)::date
    FROM generate_series(0, 5) AS n
  LOOP
    iter := iter + 1;
    INSERT INTO public.bank_transactions (bank_connection_id, bank_account_id, provider, external_transaction_id, date, description, amount, currency, category, pending, merchant_name, organization_id) VALUES
      (conn_plaid, acct_op,  'plaid', 'tx_xfer_out_' || iter, date_trunc('month', d_cursor)::date + 20, 'Transfer to Reserve Savings',  -25000, 'USD', 'Transfer', false, 'Internal Transfer', demo_org),
      (conn_plaid, acct_res, 'plaid', 'tx_xfer_in_'  || iter, date_trunc('month', d_cursor)::date + 20, 'Transfer from Operating',       25000, 'USD', 'Transfer', false, 'Internal Transfer', demo_org)
    ON CONFLICT (bank_connection_id, external_transaction_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Demo environment created:
  ✓ Org:                 Demo Co (slug: democo)
  ✓ Users:               Morgan Quinn (Owner), Riley Carter (BD), Casey Walsh (Partner)
  ✓ Password (all):      Demo@2026!
  ✓ Companies:           10
  ✓ Contacts:            15
  ✓ Leads:               8
  ✓ Deals:               15  (across 7 pipeline stages)
  ✓ Activities:          12
  ✓ Tasks:               15
  ✓ Partners:            3
  ✓ Vendors:             4
  ✓ Cashflow entries:    25
  ✓ Bank connections:    2  (Plaid + Manual)
  ✓ Bank accounts:       3  (Operating, Reserve, Credit Card)
  ✓ Bank transactions:   ~210 across the last 12 months

Sign in with any demo email, then switch to the "Demo Co" workspace.
To remove everything: run supabase/seeds/purge_demo_env.sql';

END $$;
