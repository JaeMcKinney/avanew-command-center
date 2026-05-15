# Avanew Command Center

A multi-tenant CRM and business operations platform built for Avanew and its portfolio companies. Each organization gets its own isolated workspace with custom branding, role-based access, a full CRM pipeline, cashflow tracking, and team management — all from a single codebase.

---

## Features

### CRM
- **Leads** — capture and qualify inbound leads with status, rating, and owner assignment
- **Contacts** — full contact records linked to accounts
- **Accounts** — company profiles with associated contacts and deals
- **Deals** — drag-and-drop Kanban pipeline with customizable stages per org; collapses to a stage-grouped list view on mobile
- **Activities** — log calls, emails, meetings, and notes against any record
- **Reports** — pipeline and performance summaries

### Cashflow
- **Transactions** — manual income/expense entries with categories, recurring flags, and partner/vendor linking
- **Bank Connections** — Plaid-powered bank sync; transactions imported automatically with category override support
- **Dashboard** — income/expense summary, net position, and running balance

### Operations
- **Tasks** — internal task tracker with due dates, priority, and owner assignment
- **Partners** — partner relationship management
- **Vendors** — vendor directory

### Platform
- **Multi-tenancy** — full data isolation per organization via Supabase Row Level Security; users can belong to multiple orgs and switch workspaces from the top bar
- **Per-org branding** — each organization displays its own logo in both light and dark mode
- **Role-based access control** — five roles: `super_user`, `owner`, `admin`, `bd`, `partner`; enforced in both the UI and database RLS policies
- **Team invites** — email invite flow via Supabase Edge Function; new users are automatically granted org membership on signup; existing Supabase users are added immediately
- **Document uploads** — attach any file type to deals, leads, tasks, or accounts; preview in-app
- **Dark / light mode** — OS-aware default, user-overridable, instant switching with no flash
- **Mobile responsive** — full mobile support including a mobile-optimized pipeline list view

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Routing | React Router v6 |
| Forms | React Hook Form + Zod |
| Drag & Drop | dnd-kit |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| Bank Sync | Plaid |
| Deployment | Vercel |

---

## Project Structure

```
src/
├── components/       # Shared UI components (AppSidebar, TopBar, DocumentsSection, …)
├── contexts/         # React contexts — Auth, Organization
├── hooks/            # Custom hooks — usePermissions, useRole
├── lib/              # Supabase client, data access layer, theme, utilities
├── pages/            # Route-level page components
│   ├── auth/         # Login, SetupAccount
│   └── settings/     # Profile, team management, permissions matrix
└── types/            # TypeScript types derived from the DB schema

supabase/
├── functions/        # Edge Functions — invite-user, plaid-sync, mercury-sync, …
├── migrations/       # SQL migrations (applied in filename order)
└── chunks/           # Base schema — tables, RLS policies, triggers
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- (Optional) Plaid credentials for bank sync

### 1. Clone and install

```bash
git clone https://github.com/JaeMcKinney/avanew-command-center.git
cd avanew-command-center
npm install
```

### 2. Configure environment variables

Create a `.env.local` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set up the database

Run the SQL files in order in the Supabase SQL Editor:

1. `supabase/chunks/01-base-tables.sql`
2. `supabase/chunks/02-crm-tables.sql`
3. Each file in `supabase/migrations/` in filename order

### 4. Deploy Edge Functions

```bash
supabase functions deploy invite-user --no-verify-jwt
supabase functions deploy plaid-link-token
supabase functions deploy plaid-sync
supabase functions deploy mercury-sync
```

Set required secrets:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set PLAID_CLIENT_ID=...
supabase secrets set PLAID_SECRET=...
```

### 5. Run locally

```bash
npm run dev
```

---

## Multi-Tenancy

Every data table has an `organization_id` column. Supabase RLS policies ensure users can only read and write rows that belong to their organization. Three `SECURITY DEFINER` helper functions (`is_org_member`, `is_org_admin`, `is_super_user`) are used inside policies to prevent infinite recursion that would otherwise occur from self-referential subqueries.

`super_user` accounts have cross-org visibility and can impersonate any role via the **View as…** menu in the top bar — useful for testing permissions without logging in as a different user.

---

## Roles

| Role | Description |
|---|---|
| `super_user` | Platform-wide access across all organizations |
| `owner` | Full access within their organization |
| `admin` | Can manage team members and all CRM / cashflow data |
| `bd` | CRM access only; no tasks, partners, vendors, or cashflow |
| `partner` | CRM access only; limited to assigned records |

---

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # Type-check + production build
npm run preview   # Preview the production build locally
npm run lint      # ESLint
```

---

## License

Private — internal use only.
