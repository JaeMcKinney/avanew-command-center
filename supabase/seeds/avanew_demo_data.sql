-- ============================================================
-- Avanew Demo Seed Data
-- Run this in Supabase SQL Editor against the Avanew org.
-- Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING
-- on named records, and clears prior demo data first.
-- ============================================================

DO $$
DECLARE
  org_id   uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- Real org members (pulled dynamically)
  u1 uuid; u2 uuid;

  -- Fixed demo user IDs (created by create_demo_users.sql — run that first)
  u_owner   uuid := 'dddddddd-dddd-dddd-dddd-000000000001'; -- Sarah Mitchell (Owner)
  u_bd      uuid := 'dddddddd-dddd-dddd-dddd-000000000002'; -- Jordan Hayes   (BD)
  u_partner uuid := 'dddddddd-dddd-dddd-dddd-000000000003'; -- Alex Rivera    (Partner)

  -- Stage IDs
  s_new        uuid;
  s_lead       uuid;
  s_qualified  uuid;
  s_proposal   uuid;
  s_negotiation uuid;
  s_won        uuid;
  s_lost       uuid;

  -- Company IDs
  c_apex       uuid := gen_random_uuid();
  c_nexgen     uuid := gen_random_uuid();
  c_stratford  uuid := gen_random_uuid();
  c_blueridge  uuid := gen_random_uuid();
  c_meridian   uuid := gen_random_uuid();
  c_ironclad   uuid := gen_random_uuid();
  c_luminary   uuid := gen_random_uuid();
  c_coastal    uuid := gen_random_uuid();

  -- Contact IDs
  ct1 uuid := gen_random_uuid();
  ct2 uuid := gen_random_uuid();
  ct3 uuid := gen_random_uuid();
  ct4 uuid := gen_random_uuid();
  ct5 uuid := gen_random_uuid();
  ct6 uuid := gen_random_uuid();
  ct7 uuid := gen_random_uuid();
  ct8 uuid := gen_random_uuid();
  ct9 uuid := gen_random_uuid();
  ct10 uuid := gen_random_uuid();
  ct11 uuid := gen_random_uuid();
  ct12 uuid := gen_random_uuid();

  -- Lead IDs
  l1 uuid := gen_random_uuid();
  l2 uuid := gen_random_uuid();
  l3 uuid := gen_random_uuid();
  l4 uuid := gen_random_uuid();
  l5 uuid := gen_random_uuid();

  -- Deal IDs
  d1 uuid := gen_random_uuid();
  d2 uuid := gen_random_uuid();
  d3 uuid := gen_random_uuid();
  d4 uuid := gen_random_uuid();
  d5 uuid := gen_random_uuid();
  d6 uuid := gen_random_uuid();
  d7 uuid := gen_random_uuid();
  d8 uuid := gen_random_uuid();
  d9 uuid := gen_random_uuid();
  d10 uuid := gen_random_uuid();

  -- Partner IDs
  p1 uuid := gen_random_uuid();
  p2 uuid := gen_random_uuid();
  p3 uuid := gen_random_uuid();

  -- Vendor IDs
  v1 uuid := gen_random_uuid();
  v2 uuid := gen_random_uuid();
  v3 uuid := gen_random_uuid();
  v4 uuid := gen_random_uuid();

BEGIN

  -- ── 1. Grab real (non-demo) user IDs from the org ──────────────────────────
  SELECT user_id INTO u1 FROM public.organization_members
  WHERE organization_id = org_id
    AND user_id NOT IN (u_owner, u_bd, u_partner)
  ORDER BY created_at ASC LIMIT 1;

  SELECT user_id INTO u2 FROM public.organization_members
  WHERE organization_id = org_id
    AND user_id NOT IN (u_owner, u_bd, u_partner)
  ORDER BY created_at ASC LIMIT 1 OFFSET 1;

  IF u1 IS NULL THEN RAISE EXCEPTION 'No real org members found — run create_demo_users.sql first, then ensure at least one real user is in the org.'; END IF;
  IF u2 IS NULL THEN u2 := u1; END IF;

  -- ── 2. Grab pipeline stage IDs ─────────────────────────────────────────────
  SELECT id INTO s_new         FROM public.pipeline_stages WHERE organization_id = org_id AND name = 'New'         LIMIT 1;
  SELECT id INTO s_lead        FROM public.pipeline_stages WHERE organization_id = org_id AND name = 'Lead'        LIMIT 1;
  SELECT id INTO s_qualified   FROM public.pipeline_stages WHERE organization_id = org_id AND name = 'Qualified'   LIMIT 1;
  SELECT id INTO s_proposal    FROM public.pipeline_stages WHERE organization_id = org_id AND name = 'Proposal'    LIMIT 1;
  SELECT id INTO s_negotiation FROM public.pipeline_stages WHERE organization_id = org_id AND name = 'Negotiation' LIMIT 1;
  SELECT id INTO s_won         FROM public.pipeline_stages WHERE organization_id = org_id AND is_won = true        LIMIT 1;
  SELECT id INTO s_lost        FROM public.pipeline_stages WHERE organization_id = org_id AND is_lost = true       LIMIT 1;

  -- Fall back so nothing breaks if stage names differ
  IF s_new IS NULL THEN
    SELECT id INTO s_new FROM public.pipeline_stages WHERE organization_id = org_id ORDER BY position ASC LIMIT 1;
  END IF;
  IF s_lead        IS NULL THEN s_lead        := s_new; END IF;
  IF s_qualified   IS NULL THEN s_qualified   := s_new; END IF;
  IF s_proposal    IS NULL THEN s_proposal    := s_new; END IF;
  IF s_negotiation IS NULL THEN s_negotiation := s_new; END IF;
  IF s_won         IS NULL THEN s_won         := s_new; END IF;
  IF s_lost        IS NULL THEN s_lost        := s_new; END IF;

  -- ── 3. Companies ────────────────────────────────────────────────────────────
  INSERT INTO public.companies (id, name, domain, industry, account_type, employees, annual_revenue, website, rating, owner_id, organization_id) VALUES
    (c_apex,      'Apex Dynamics',         'apexdynamics.io',       'Technology',        'Customer', 320,  8500000,  'https://apexdynamics.io',       'Hot',  u_owner,   org_id),
    (c_nexgen,    'NexGen Solutions',      'nexgensolutions.com',   'Software',          'Customer', 85,   2200000,  'https://nexgensolutions.com',   'Warm', u_bd,      org_id),
    (c_stratford, 'Stratford Capital',     'stratfordcap.com',      'Financial Services','Prospect', 50,   15000000, 'https://stratfordcap.com',      'Warm', u_owner,   org_id),
    (c_blueridge, 'Blue Ridge Health',     'blueridgehealth.org',   'Healthcare',        'Customer', 210,  4100000,  'https://blueridgehealth.org',   'Hot',  u_bd,      org_id),
    (c_meridian,  'Meridian Logistics',    'meridianlog.com',       'Logistics',         'Prospect', 630,  22000000, 'https://meridianlog.com',       'Warm', u1,        org_id),
    (c_ironclad,  'Ironclad Manufacturing','ironcladmfg.com',       'Manufacturing',     'Customer', 450,  31000000, 'https://ironcladmfg.com',       'Cold', u_owner,   org_id),
    (c_luminary,  'Luminary Media',        'luminarymedia.co',      'Media',             'Prospect', 40,   900000,   'https://luminarymedia.co',      'Hot',  u_partner, org_id),
    (c_coastal,   'Coastal Real Estate',   'coastalrealty.com',     'Real Estate',       'Customer', 95,   6700000,  'https://coastalrealty.com',     'Warm', u2,        org_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 4. Contacts ─────────────────────────────────────────────────────────────
  INSERT INTO public.contacts (id, first_name, last_name, email, phone, title, company_id, owner_id, organization_id) VALUES
    (ct1,  'Rachel',  'Chen',     'rchen@apexdynamics.io',       '415-222-1001', 'CTO',                  c_apex,      u_owner,   org_id),
    (ct2,  'Marcus',  'Webb',     'mwebb@apexdynamics.io',       '415-222-1002', 'VP of Engineering',    c_apex,      u_owner,   org_id),
    (ct3,  'Sofia',   'Alvarez',  'salvarez@nexgensolutions.com', '512-333-2001', 'CEO',                  c_nexgen,    u_bd,      org_id),
    (ct4,  'James',   'Okafor',   'jokafor@nexgensolutions.com',  '512-333-2002', 'Head of Product',      c_nexgen,    u_bd,      org_id),
    (ct5,  'Diana',   'Park',     'dpark@stratfordcap.com',      '212-444-3001', 'Managing Director',    c_stratford, u_owner,   org_id),
    (ct6,  'Tyler',   'Nguyen',   'tnguyen@blueridgehealth.org', '303-555-4001', 'Director of IT',       c_blueridge, u_bd,      org_id),
    (ct7,  'Amara',   'Diallo',   'adiallo@blueridgehealth.org', '303-555-4002', 'COO',                  c_blueridge, u_bd,      org_id),
    (ct8,  'Kevin',   'Marsh',    'kmarsh@meridianlog.com',      '704-666-5001', 'SVP Operations',       c_meridian,  u1,        org_id),
    (ct9,  'Priya',   'Suresh',   'psuresh@ironcladmfg.com',     '414-777-6001', 'Procurement Manager',  c_ironclad,  u_owner,   org_id),
    (ct10, 'Leo',     'Fontaine', 'lfontaine@luminarymedia.co',  '323-888-7001', 'Head of Partnerships', c_luminary,  u_partner, org_id),
    (ct11, 'Hannah',  'Torres',   'htorres@coastalrealty.com',   '619-999-8001', 'VP of Technology',     c_coastal,   u2,        org_id),
    (ct12, 'Brett',   'Halvorsen','bhalvorsen@stratfordcap.com', '212-444-3002', 'CFO',                  c_stratford, u_owner,   org_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 5. Leads ────────────────────────────────────────────────────────────────
  INSERT INTO public.leads (id, first_name, last_name, email, phone, company, title, lead_status, lead_source, industry, annual_revenue, rating, owner_id, organization_id) VALUES
    (l1, 'Nathan',   'Cross',    'ncross@vertexai.com',      '628-101-0001', 'Vertex AI Labs',     'CEO',               'New',          'Web',          'Technology',   3200000,  'Hot',  u_bd,      org_id),
    (l2, 'Chloe',    'Brennan',  'cbrennan@pinnaclehr.com',  '720-102-0002', 'Pinnacle HR',        'VP of Sales',       'Contacted',    'Referral',     'HR Tech',      1400000,  'Warm', u_bd,      org_id),
    (l3, 'Derrick',  'Hammond',  'dhammond@orbitsys.net',    '503-103-0003', 'Orbit Systems',      'Director of IT',    'Qualified',    'Cold Call',    'Software',     5600000,  'Hot',  u_owner,   org_id),
    (l4, 'Yuki',     'Tanaka',   'ytanaka@solartechco.com',  '858-104-0004', 'SolarTech Co.',      'COO',               'New',          'LinkedIn',     'CleanTech',    8100000,  'Warm', u_partner, org_id),
    (l5, 'Megan',    'Flores',   'mflores@bridgepoint.io',   '312-105-0005', 'Bridgepoint Capital','Partner',           'Contacted',    'Conference',   'Finance',      25000000, 'Hot',  u_bd,      org_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 6. Deals ────────────────────────────────────────────────────────────────
  INSERT INTO public.deals (id, title, amount, stage_id, contact_id, company_id, owner_id, expected_close_date, probability, type, lead_source, organization_id) VALUES
    (d1,  'Apex — Platform License',            48000, s_proposal,    ct1,  c_apex,      u_owner,   current_date + 14, 60,  'New Business', 'Web',        org_id),
    (d2,  'Apex — API Integration Expansion',   22000, s_negotiation, ct2,  c_apex,      u_owner,   current_date + 7,  80,  'Expansion',    'Web',        org_id),
    (d3,  'NexGen — Annual SaaS Contract',       36000, s_qualified,   ct3,  c_nexgen,    u_bd,      current_date + 30, 40,  'New Business', 'Referral',   org_id),
    (d4,  'NexGen — Onboarding Package',          8500, s_won,         ct4,  c_nexgen,    u_bd,      current_date - 10, 100, 'Add-on',       'Referral',   org_id),
    (d5,  'Stratford — Advisory Retainer',       60000, s_proposal,    ct5,  c_stratford, u_owner,   current_date + 21, 55,  'New Business', 'Cold Call',  org_id),
    (d6,  'Blue Ridge — HIPAA Compliance Suite', 75000, s_lead,        ct6,  c_blueridge, u_bd,      current_date + 45, 25,  'New Business', 'Conference', org_id),
    (d7,  'Blue Ridge — IT Infrastructure',      18000, s_qualified,   ct7,  c_blueridge, u_bd,      current_date + 20, 45,  'Expansion',    'Conference', org_id),
    (d8,  'Meridian — Supply Chain Module',      92000, s_new,         ct8,  c_meridian,  u1,        current_date + 60, 15,  'New Business', 'LinkedIn',   org_id),
    (d9,  'Luminary — Content Analytics',        14500, s_negotiation, ct10, c_luminary,  u_partner, current_date + 5,  85,  'New Business', 'Web',        org_id),
    (d10, 'Coastal — CRM Migration',             29000, s_lost,        ct11, c_coastal,   u2,        current_date - 30, 0,   'New Business', 'Referral',   org_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 7. Activities ───────────────────────────────────────────────────────────
  INSERT INTO public.activities (type, subject, body, contact_id, company_id, deal_id, owner_id, due_at, completed_at, organization_id) VALUES
    ('call',    'Intro call with Rachel Chen',             'Discussed platform needs and current pain points. Strong fit identified.', ct1, c_apex,      d1,   u1, now() - interval '5 days',  now() - interval '5 days',  org_id),
    ('email',   'Sent proposal to Apex Dynamics',          'Shared pricing deck and implementation timeline.',                         ct1, c_apex,      d1,   u1, now() - interval '2 days',  now() - interval '2 days',  org_id),
    ('meeting', 'Demo with Marcus Webb',                   'Live demo of API integration features. Marcus asked about SSO.',           ct2, c_apex,      d2,   u1, now() - interval '3 days',  now() - interval '3 days',  org_id),
    ('call',    'Discovery call — NexGen',                 'Sofia confirmed budget approved for Q3. Moving to proposal stage.',        ct3, c_nexgen,    d3,   u2, now() - interval '7 days',  now() - interval '7 days',  org_id),
    ('email',   'NexGen onboarding confirmation',          'Sent signed contract and onboarding schedule.',                           ct4, c_nexgen,    d4,   u2, now() - interval '12 days', now() - interval '12 days', org_id),
    ('meeting', 'Stratford advisory scope review',         'Aligned on deliverables for Q3 retainer. Legal review in progress.',      ct5, c_stratford, d5,   u1, now() - interval '4 days',  now() - interval '4 days',  org_id),
    ('call',    'Blue Ridge HIPAA requirement walkthrough','Tyler outlined compliance gaps. Scheduling technical assessment.',         ct6, c_blueridge, d6,   u_bd, now() + interval '2 days',  NULL,                       org_id),
    ('email',   'Follow-up: Blue Ridge IT proposal',       'Sent revised quote incorporating server migration scope.',                 ct7, c_blueridge, d7,   u_bd, now() - interval '1 day',   now() - interval '1 day',   org_id),
    ('meeting', 'Meridian intro — supply chain demo',      'Initial walkthrough. Kevin wants to involve their VP of Tech next.',      ct8, c_meridian,  d8,   u2, now() + interval '5 days',  NULL,                       org_id),
    ('call',    'Luminary final negotiation',              'Leo confirmed 12-month commitment. Working on contract language.',         ct10,c_luminary,  d9,   u_partner, now() + interval '1 day',   NULL,                       org_id),
    ('email',   'Coastal post-mortem debrief',             'Reached out to understand why they went with competitor.',                 ct11,c_coastal,   d10,  u2, now() - interval '25 days', now() - interval '25 days', org_id),
    ('task',    'Prepare QBR slides for Apex',             'Cover usage stats, ROI summary, and expansion opportunities.',            ct1, c_apex,      d1,   u1, now() + interval '7 days',  NULL,                       org_id),
    ('call',    'Check-in with Diana Park',                'Quarterly check-in. Stratford expanding into two new verticals.',         ct5, c_stratford, d5,   u1, now() - interval '6 days',  now() - interval '6 days',  org_id),
    ('meeting', 'NexGen product roadmap sync',             'Shared upcoming features relevant to their workflow.',                    ct3, c_nexgen,    d3,   u2, now() + interval '3 days',  NULL,                       org_id),
    ('email',   'Ironclad intro outreach',                 'Initial outreach to Priya re: procurement workflow automation.',          ct9, c_ironclad,  NULL, u1, now() - interval '2 days',  now() - interval '2 days',  org_id)
  ON CONFLICT DO NOTHING;

  -- ── 8. Tasks ────────────────────────────────────────────────────────────────
  INSERT INTO public.tasks (subject, status, priority, owner_id, contact_id, deal_id, lead_id, due_date, description, organization_id) VALUES
    ('Send contract redline to Apex',        'In Progress', 'High',   u1, ct1,  d1,   NULL, current_date + 2,  'Legal requested two changes — send updated doc.',          org_id),
    ('Schedule technical review — Blue Ridge','Not Started','High',   u_bd, ct6,  d6,   NULL, current_date + 4,  'Needs their IT architect on the call.',                    org_id),
    ('Prepare case study for Stratford',     'Not Started', 'Normal', u1, ct5,  d5,   NULL, current_date + 10, 'Use Apex as reference customer.',                          org_id),
    ('Follow up with Meridian VP of Tech',   'Not Started', 'Normal', u2, ct8,  d8,   NULL, current_date + 3,  'Kevin said he''d make the intro by end of week.',          org_id),
    ('Luminary — finalize contract',         'In Progress', 'High',   u_partner, ct10, d9,   NULL, current_date + 1,  'One open clause on data retention — legal to sign off.',   org_id),
    ('NexGen — send onboarding checklist',   'Completed',   'Normal', u2, ct4,  d4,   NULL, current_date - 8,  'All items sent and acknowledged.',                         org_id),
    ('Research Pinnacle HR decision-maker',  'Not Started', 'Low',    u2, NULL, NULL, l2,   current_date + 7,  'Need to find the right contact before next outreach.',     org_id),
    ('Qualify Orbit Systems lead',           'In Progress', 'High',   u1, NULL, NULL, l3,   current_date + 2,  'Schedule discovery call this week.',                       org_id),
    ('Update deal amounts in pipeline',      'Not Started', 'Low',    u1, NULL, NULL, NULL, current_date + 5,  'Align amounts with latest pricing sheet.',                 org_id),
    ('Internal review: Ironclad opportunity','Not Started', 'Normal', u1, ct9,  NULL, NULL, current_date + 14, 'Assess whether this is worth pursuing.',                   org_id)
  ON CONFLICT DO NOTHING;

  -- ── 9. Partners ─────────────────────────────────────────────────────────────
  INSERT INTO public.partners (id, name, type, email, phone, website, status, revenue_share, agreement_start_date, notes, organization_id) VALUES
    (p1, 'Northwind Capital',       'Investor',          'partners@northwindcap.com',    '212-800-1001', 'https://northwindcap.com',    'Active', '8% carry',          '2024-01-15', 'Lead investor, board observer seat.',         org_id),
    (p2, 'Acme Partnerships LLC',   'Referral Partner',  'referrals@acmepartners.com',   '415-800-2002', 'https://acmepartners.com',    'Active', '15% of first year', '2024-06-01', 'High-volume referral partner in SaaS space.', org_id),
    (p3, 'BrightPath Consulting',   'Implementation',    'hello@brightpathconsulting.io','512-800-3003', 'https://brightpathconsulting.io','Active','10% implementation','2025-01-01', 'Handles enterprise onboarding engagements.',  org_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 10. Vendors ─────────────────────────────────────────────────────────────
  INSERT INTO public.vendors (id, name, service, email, phone, website, status, cost_structure, payment_terms, notes, organization_id) VALUES
    (v1, 'Amazon Web Services',  'Cloud Infrastructure', 'aws-billing@amazon.com',      '206-900-1001', 'https://aws.amazon.com',     'Active', '$4,200/mo',   'Net 30', 'EC2, RDS, S3. Reserved instances expire Jan 2027.', org_id),
    (v2, 'GitHub (Microsoft)',   'Dev Tools',            'enterprise@github.com',       '415-900-2002', 'https://github.com/enterprise','Active','$500/mo',    'Net 30', 'Team plan, 25 seats.',                              org_id),
    (v3, 'Slack (Salesforce)',   'Team Communication',   'billing@slack.com',           '415-900-3003', 'https://slack.com',          'Active', '$400/mo',     'Net 30', 'Business+ plan, 30 users.',                         org_id),
    (v4, 'Gusto',               'Payroll & HR',          'support@gusto.com',           '800-900-4004', 'https://gusto.com',          'Active', '$18,000/mo',  'Net 15', 'Full payroll + benefits. 12 employees.',            org_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 11. Cashflow Transactions ────────────────────────────────────────────────
  INSERT INTO public.cashflow_transactions (type, category, description, amount, date, is_recurring, recurrence_period, partner_id, vendor_id, reference, organization_id) VALUES
    -- Income
    ('income',  'Revenue',       'Apex Dynamics — Q2 platform license',     48000, current_date - 45,  false, NULL,      p2,   NULL, 'INV-2026-041', org_id),
    ('income',  'Revenue',       'NexGen Solutions — annual SaaS contract',  36000, current_date - 30,  false, NULL,      NULL, NULL, 'INV-2026-042', org_id),
    ('income',  'Revenue',       'Blue Ridge Health — IT infrastructure',    18000, current_date - 20,  false, NULL,      NULL, NULL, 'INV-2026-043', org_id),
    ('income',  'Revenue',       'Coastal Real Estate — CRM setup',          14500, current_date - 60,  false, NULL,      p2,   NULL, 'INV-2026-038', org_id),
    ('income',  'Revenue',       'Stratford Capital — advisory retainer',    15000, current_date - 15,  true,  'monthly', NULL, NULL, 'INV-2026-044', org_id),
    ('income',  'Revenue',       'Stratford Capital — advisory retainer',    15000, current_date - 45,  true,  'monthly', NULL, NULL, 'INV-2026-040', org_id),
    ('income',  'Revenue',       'NexGen — onboarding package',              8500,  current_date - 12,  false, NULL,      NULL, NULL, 'INV-2026-045', org_id),
    ('income',  'Referral Fee',  'Northwind Capital — referral commission',  4800,  current_date - 8,   false, NULL,      p1,   NULL, 'REF-2026-011', org_id),
    ('income',  'Revenue',       'Ironclad Manufacturing — pilot project',   12000, current_date - 5,   false, NULL,      NULL, NULL, 'INV-2026-046', org_id),
    ('income',  'Revenue',       'Luminary Media — analytics module',        6500,  current_date - 2,   false, NULL,      p3,   NULL, 'INV-2026-047', org_id),
    -- Expenses
    ('expense', 'Infrastructure','AWS — monthly cloud bill',                  4200,  current_date - 1,   true,  'monthly', NULL, v1,   'AWS-MAY-2026',  org_id),
    ('expense', 'Infrastructure','AWS — monthly cloud bill',                  4200,  current_date - 31,  true,  'monthly', NULL, v1,   'AWS-APR-2026',  org_id),
    ('expense', 'Software',      'GitHub — team plan',                         500,  current_date - 1,   true,  'monthly', NULL, v2,   'GH-MAY-2026',   org_id),
    ('expense', 'Software',      'Slack — Business+ plan',                     400,  current_date - 1,   true,  'monthly', NULL, v3,   'SLK-MAY-2026',  org_id),
    ('expense', 'Payroll',       'Gusto — payroll May 2026',                 18000,  current_date - 3,   true,  'monthly', NULL, v4,   'PAY-MAY-2026',  org_id),
    ('expense', 'Payroll',       'Gusto — payroll Apr 2026',                 18000,  current_date - 33,  true,  'monthly', NULL, v4,   'PAY-APR-2026',  org_id),
    ('expense', 'Marketing',     'LinkedIn Ads — April campaign',             2200,  current_date - 35,  false, NULL,      NULL, NULL, 'LI-APR-2026',   org_id),
    ('expense', 'Marketing',     'LinkedIn Ads — May campaign',               2200,  current_date - 5,   false, NULL,      NULL, NULL, 'LI-MAY-2026',   org_id),
    ('expense', 'Travel',        'NYC client meetings — flights + hotel',     3400,  current_date - 18,  false, NULL,      NULL, NULL, 'EXP-T-044',     org_id),
    ('expense', 'Professional Services','Legal review — Apex & Stratford contracts', 4500, current_date - 10, false, NULL, NULL, NULL, 'LEGAL-MAY-26',  org_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Avanew demo seed complete — companies: 8, contacts: 12, leads: 5, deals: 10, activities: 15, tasks: 10, partners: 3, vendors: 4, transactions: 20';

END $$;
