# Avanew CRM

Internal CRM for tracking sales at Avanew. Desktop + mobile friendly.

**Stack:** Vite · React · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase (Postgres + Auth)

## Features (v0.1)

- Email/password authentication (Supabase Auth)
- Responsive sidebar layout (drawer on mobile, fixed sidebar on desktop)
- Dashboard with KPI cards
- Page shells for Contacts, Companies, Deals (kanban skeleton), Activities, Reports
- SQL schema with companies, contacts, pipeline stages, deals, activities

CRUD wiring is the next iteration — the schema, types, auth, and UI shell are in place.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. From **Project Settings → API**, copy the **Project URL** and the **anon public** key.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and paste in your values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 4. Run the schema

In the Supabase dashboard, open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the tables, enums, RLS policies, and seeds the default pipeline stages.

### 5. (Optional) Disable email confirmation for local dev

For faster signup during development: **Authentication → Sign In / Up → Email** → turn off "Confirm email".

### 6. Start the dev server

```bash
npm run dev
```

Open the printed URL (usually http://localhost:5173). Sign up to create your first user, then sign in.

## Project structure

```
src/
├── App.tsx                  Routes
├── main.tsx                 Entry — providers (Router, Auth, Tooltip, Toaster)
├── index.css                Tailwind v4 + shadcn theme tokens
├── lib/
│   ├── supabase.ts          Supabase client (typed via Database)
│   └── utils.ts             cn() helper
├── types/
│   └── db.ts                Hand-written DB types (until codegen wired up)
├── contexts/
│   └── AuthContext.tsx      Session state + signIn / signUp / signOut
├── components/
│   ├── ui/                  shadcn/ui primitives
│   ├── AppLayout.tsx        Sidebar + topbar shell
│   ├── AppSidebar.tsx       Nav (shared between desktop sidebar + mobile sheet)
│   ├── TopBar.tsx           Mobile menu trigger + user dropdown
│   ├── ProtectedRoute.tsx   Redirects to /login when unauthenticated
│   ├── PageHeader.tsx
│   └── EmptyState.tsx
└── pages/
    ├── auth/
    │   ├── Login.tsx
    │   └── Signup.tsx
    ├── Dashboard.tsx
    ├── Contacts.tsx
    ├── Companies.tsx
    ├── Deals.tsx
    ├── Activities.tsx
    └── Reports.tsx

supabase/
└── schema.sql               Run once in the Supabase SQL Editor
```

## Scripts

```bash
npm run dev      # start Vite dev server
npm run build    # type-check + production build
npm run preview  # preview the production build locally
npm run lint     # run ESLint
```

## Roadmap

Next iteration:

- Contacts / Companies CRUD (list, create, edit, delete)
- Deal kanban with drag-and-drop (`@dnd-kit`) and stage transitions
- Activity logging tied to contacts / deals / companies
- Pipeline reports with `recharts`
- Supabase types codegen (replace hand-written `src/types/db.ts`)

Later:

- Multi-org workspace (currently a single shared workspace per Supabase project)
- Email sync, calendar sync
- Quotes / invoices
