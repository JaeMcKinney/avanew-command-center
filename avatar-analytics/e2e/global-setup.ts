import { execFileSync } from "node:child_process"
import { seedDemo } from "../scripts/seed-demo.mjs"

/** Every run starts from the same sample data. */
export default async function globalSetup() {
  const sql = `
    truncate public.client_notes, public.client_contacts, public.usage_topups, public.notifications, public.invoices, public.stripe_events, public.client_billing, public.plans,
      public.avatar_knowledge, public.questions, public.question_groups, public.conversation_insights,
      public.usage_daily, public.transcripts, public.conversations, public.tavus_events,
      public.avatar_secrets, public.avatars, public.tavus_deployments, public.tavus_pals,
      public.tavus_sync_runs, public.staff_client_assignments, public.audit_log, public.clients, public.agencies
      restart identity cascade;
    delete from auth.users;
    delete from vault.secrets where name like 'glass:%';
    delete from public.roles where not is_system;
    -- Put back anything a test left changed on the built-in roles.
    delete from public.role_permissions rp using public.roles r
      where r.id = rp.role_id and r.key = 'client_member' and rp.permission = 'embeds.view';`
  execFileSync("docker", ["exec", "-i", "supabase_db_avatar-analytics", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], { stdio: ["ignore", "ignore", "inherit"] })
  await fetch("http://127.0.0.1:54398/__control/reset", { method: "POST" })
  await fetch("http://127.0.0.1:54324/api/v1/messages", { method: "DELETE" }).catch(() => undefined)
  await seedDemo({ log: () => undefined, agency: true })
}
