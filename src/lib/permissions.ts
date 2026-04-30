import type { TeamRole } from "@/types/db"

export type EditableRole = Exclude<TeamRole, "super_user">

export type PermissionKey =
  | "crm.view"
  | "crm.edit"
  | "crm.delete"
  | "cashflow.view"
  | "cashflow.transactions"
  | "cashflow.bank_connections"
  | "ai.insights"
  | "ai.ave"
  | "ai.forecasting"
  | "reports.crm"
  | "reports.financial"
  | "notifications.operational"
  | "notifications.financial"
  | "notifications.ai_insights"
  | "notifications.system"
  | "notifications.configure_personal"
  | "notifications.configure_global"
  | "team.view"
  | "team.invite"
  | "team.remove"
  | "team.change_roles"
  | "settings.profile"
  | "settings.pipeline"
  | "settings.bank_integrations"
  | "settings.system"
  | "settings.auth"
  | "security.mfa_personal"
  | "security.login_history"
  | "security.logs"
  | "integrations.bank_view"
  | "integrations.configure"
  | "integrations.sync_logs"
  | "devops.deployment"
  | "devops.env_vars"
  | "devops.monitoring"

export interface PermissionDef {
  key: PermissionKey
  category: string
  label: string
  description: string
}

export type PermissionsMatrix = Record<PermissionKey, Record<EditableRole, boolean>>

export const EDITABLE_ROLES: EditableRole[] = ["owner", "admin", "bd", "partner"]

export const ALL_PERMISSIONS: PermissionDef[] = [
  // CRM
  { key: "crm.view",                       category: "CRM",                label: "View records",                     description: "Read access to leads, contacts, accounts, deals, activities, and tasks" },
  { key: "crm.edit",                       category: "CRM",                label: "Create & edit records",            description: "Add new records and modify existing ones across all CRM modules" },
  { key: "crm.delete",                     category: "CRM",                label: "Delete records",                   description: "Permanently remove CRM records" },
  // Cashflow
  { key: "cashflow.view",                  category: "Cashflow",           label: "View Cashflow dashboard",          description: "Access to the Cashflow module, KPIs, charts, and financial overview" },
  { key: "cashflow.transactions",          category: "Cashflow",           label: "Manage transactions",              description: "View, create, edit, and categorize manual and synced transactions" },
  { key: "cashflow.bank_connections",      category: "Cashflow",           label: "Bank connections",                 description: "Connect and manage Mercury, Plaid, and other bank integrations" },
  // AI & Intelligence
  { key: "ai.insights",                    category: "AI & Intelligence",  label: "AI Insights",                      description: "Access to AI-generated financial summaries and business insights on the Cashflow page" },
  { key: "ai.ave",                         category: "AI & Intelligence",  label: "AVE (AI Voice Experience)",        description: "Interact with the AI Voice Experience across the application" },
  { key: "ai.forecasting",                 category: "AI & Intelligence",  label: "Financial forecasting",            description: "Access to AI-driven revenue and expense forecasting tools" },
  // Reports
  { key: "reports.crm",                    category: "Reports",            label: "CRM reports",                      description: "View leads, pipeline, deal, and contact reports" },
  { key: "reports.financial",              category: "Reports",            label: "Financial reports",                description: "View cashflow summaries, P&L statements, and financial analytics" },
  // Notifications
  { key: "notifications.operational",      category: "Notifications",      label: "Operational notifications",        description: "Receive alerts for task due dates, deal updates, and CRM activity" },
  { key: "notifications.financial",        category: "Notifications",      label: "Financial notifications",          description: "Receive financial alerts, cashflow warnings, and bank sync updates" },
  { key: "notifications.ai_insights",     category: "Notifications",      label: "AI Insight alerts",                description: "Receive alerts when new AI insights or forecasts are generated" },
  { key: "notifications.system",           category: "Notifications",      label: "System notifications",             description: "Receive platform-level system and integration status alerts" },
  { key: "notifications.configure_personal", category: "Notifications",   label: "Configure personal channels",      description: "Set up personal SMS, email, and browser notification preferences" },
  { key: "notifications.configure_global",  category: "Notifications",    label: "Configure global channels",        description: "Configure notification channels that apply to all users platform-wide" },
  // Team Management
  { key: "team.view",                      category: "Team Management",    label: "View team members",                description: "See the list of all users and their roles" },
  { key: "team.invite",                    category: "Team Management",    label: "Invite team members",              description: "Send invitations to new users" },
  { key: "team.remove",                    category: "Team Management",    label: "Remove team members",              description: "Revoke access for existing team members" },
  { key: "team.change_roles",              category: "Team Management",    label: "Change member roles",              description: "Promote or demote team members — limited to roles below own level" },
  // Settings
  { key: "settings.profile",              category: "Settings",            label: "Edit own profile",                 description: "Update personal display name and preferences" },
  { key: "settings.pipeline",             category: "Settings",            label: "Manage pipeline stages",           description: "Add, rename, reorder, or configure deal pipeline stages" },
  { key: "settings.bank_integrations",    category: "Settings",            label: "Bank connection management",       description: "Manage connected bank accounts and sync settings (Mercury, Plaid)" },
  { key: "settings.system",              category: "Settings",             label: "System configuration",             description: "Access deployment, environment, and advanced platform settings" },
  { key: "settings.auth",                category: "Settings",             label: "Authentication policies",          description: "Configure MFA requirements, session policies, and password rules" },
  // Security
  { key: "security.mfa_personal",        category: "Security",             label: "Enable personal MFA",              description: "Voluntarily enable multi-factor authentication for own account" },
  { key: "security.login_history",       category: "Security",             label: "View personal login history",      description: "View own sign-in history, device sessions, and access log" },
  { key: "security.logs",                category: "Security",             label: "Security audit logs",              description: "Access platform-wide security event logs and authentication audit trails" },
  // Integrations
  { key: "integrations.bank_view",       category: "Integrations",         label: "View bank integration outputs",    description: "View connected bank account status, sync results, and transaction data" },
  { key: "integrations.configure",       category: "Integrations",         label: "Configure integration credentials", description: "Manage API keys for Bank APIs, Twilio, email providers, and Tavus" },
  { key: "integrations.sync_logs",       category: "Integrations",         label: "View sync logs",                   description: "Access integration sync history, failure reports, and retry controls" },
  // DevOps
  { key: "devops.deployment",            category: "DevOps",               label: "Deployment configuration",         description: "Manage deployment settings, release configuration, and platform rollouts" },
  { key: "devops.env_vars",              category: "DevOps",               label: "Environment variables",            description: "View and manage backend environment variables and secret configuration" },
  { key: "devops.monitoring",            category: "DevOps",               label: "Infrastructure monitoring",        description: "Access system health dashboards, uptime metrics, and infrastructure logs" },
]

export const PERMISSION_CATEGORIES = [
  "CRM",
  "Cashflow",
  "AI & Intelligence",
  "Reports",
  "Notifications",
  "Team Management",
  "Settings",
  "Security",
  "Integrations",
  "DevOps",
] as const

// Default matrix — admin has access to everything except cashflow/financial data
export const DEFAULT_MATRIX: PermissionsMatrix = {
  "crm.view":                          { owner: true,  admin: true,  bd: true,  partner: false },
  "crm.edit":                          { owner: true,  admin: true,  bd: true,  partner: false },
  "crm.delete":                        { owner: true,  admin: true,  bd: false, partner: false },
  "cashflow.view":                     { owner: true,  admin: false, bd: false, partner: false },
  "cashflow.transactions":             { owner: true,  admin: false, bd: false, partner: false },
  "cashflow.bank_connections":         { owner: true,  admin: false, bd: false, partner: false },
  "ai.insights":                       { owner: true,  admin: false, bd: false, partner: false },
  "ai.ave":                            { owner: true,  admin: true,  bd: false, partner: false },
  "ai.forecasting":                    { owner: true,  admin: false, bd: false, partner: false },
  "reports.crm":                       { owner: true,  admin: true,  bd: false, partner: false },
  "reports.financial":                 { owner: true,  admin: false, bd: false, partner: false },
  "notifications.operational":         { owner: true,  admin: true,  bd: true,  partner: true  },
  "notifications.financial":           { owner: true,  admin: false, bd: false, partner: false },
  "notifications.ai_insights":         { owner: true,  admin: false, bd: false, partner: false },
  "notifications.system":              { owner: true,  admin: true,  bd: false, partner: false },
  "notifications.configure_personal":  { owner: true,  admin: true,  bd: true,  partner: true  },
  "notifications.configure_global":    { owner: true,  admin: true,  bd: false, partner: false },
  "team.view":                         { owner: true,  admin: true,  bd: false, partner: false },
  "team.invite":                       { owner: true,  admin: true,  bd: false, partner: false },
  "team.remove":                       { owner: true,  admin: true,  bd: false, partner: false },
  "team.change_roles":                 { owner: true,  admin: true,  bd: false, partner: false },
  "settings.profile":                  { owner: true,  admin: true,  bd: true,  partner: true  },
  "settings.pipeline":                 { owner: true,  admin: true,  bd: false, partner: false },
  "settings.bank_integrations":        { owner: true,  admin: false, bd: false, partner: false },
  "settings.system":                   { owner: true,  admin: true,  bd: false, partner: false },
  "settings.auth":                     { owner: true,  admin: true,  bd: false, partner: false },
  "security.mfa_personal":             { owner: true,  admin: true,  bd: true,  partner: true  },
  "security.login_history":            { owner: true,  admin: true,  bd: true,  partner: true  },
  "security.logs":                     { owner: true,  admin: true,  bd: false, partner: false },
  "integrations.bank_view":            { owner: true,  admin: false, bd: false, partner: false },
  "integrations.configure":            { owner: true,  admin: true,  bd: false, partner: false },
  "integrations.sync_logs":            { owner: true,  admin: false, bd: false, partner: false },
  "devops.deployment":                 { owner: true,  admin: true,  bd: false, partner: false },
  "devops.env_vars":                   { owner: true,  admin: true,  bd: false, partner: false },
  "devops.monitoring":                 { owner: true,  admin: true,  bd: false, partner: false },
}

const STORAGE_KEY = "avanew-crm.permissions"
const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"

export function loadPermissionsMatrix(): PermissionsMatrix {
  if (PREVIEW_MODE) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as PermissionsMatrix
    } catch { /* ignore */ }
  }
  return structuredClone(DEFAULT_MATRIX)
}

export function savePermissionsMatrix(matrix: PermissionsMatrix): void {
  if (PREVIEW_MODE) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix))
  }
}

export function resetPermissionsMatrix(): PermissionsMatrix {
  const fresh = structuredClone(DEFAULT_MATRIX)
  savePermissionsMatrix(fresh)
  return fresh
}

export async function fetchPermissionsFromDB(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<PermissionsMatrix | null> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_key, role, enabled")
  if (error || !data?.length) return null

  const matrix = structuredClone(DEFAULT_MATRIX)
  for (const row of data as { permission_key: string; role: string; enabled: boolean }[]) {
    const key = row.permission_key as PermissionKey
    const role = row.role as EditableRole
    if (matrix[key] && role in matrix[key]) {
      matrix[key][role] = row.enabled
    }
  }
  return matrix
}

export async function persistPermissionsToDB(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  matrix: PermissionsMatrix,
): Promise<void> {
  const rows = (Object.keys(matrix) as PermissionKey[]).flatMap((key) =>
    (Object.keys(matrix[key]) as EditableRole[]).map((role) => ({
      permission_key: key,
      role,
      enabled: matrix[key][role],
      updated_at: new Date().toISOString(),
    }))
  )
  await supabase
    .from("role_permissions")
    .upsert(rows, { onConflict: "permission_key,role" })
}

export function hasPermission(matrix: PermissionsMatrix, role: TeamRole, key: PermissionKey): boolean {
  if (role === "super_user") return true
  return matrix[key]?.[role as EditableRole] ?? false
}
