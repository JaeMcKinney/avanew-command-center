import { Routes, Route, Navigate } from "react-router-dom"
import { Login } from "@/pages/auth/Login"
import { Signup } from "@/pages/auth/Signup"
import { ForgotPassword } from "@/pages/auth/ForgotPassword"
import { ResetPassword } from "@/pages/auth/ResetPassword"
import { SetupAccount } from "@/pages/auth/SetupAccount"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { RoleGate } from "@/components/RoleGate"
import { AppLayout } from "@/components/AppLayout"
import { Dashboard } from "@/pages/Dashboard"
import { Contacts } from "@/pages/Contacts"
import { ContactForm } from "@/pages/ContactForm"
import { Companies } from "@/pages/Companies"
import { AccountForm } from "@/pages/AccountForm"
import { AccountDetail } from "@/pages/AccountDetail"
import { Deals } from "@/pages/Deals"
import { DealForm } from "@/pages/DealForm"
import { Leads } from "@/pages/Leads"
import { LeadForm } from "@/pages/LeadForm"
import { Tasks } from "@/pages/Tasks"
import { TaskForm } from "@/pages/TaskForm"
import { Activities } from "@/pages/Activities"
import { Reports } from "@/pages/Reports"
import { Cashflow } from "@/pages/Cashflow"
import { Transactions } from "@/pages/Transactions"
import { TransactionForm } from "@/pages/TransactionForm"
import { Partners } from "@/pages/Partners"
import { PartnerForm } from "@/pages/PartnerForm"
import { Vendors } from "@/pages/Vendors"
import { VendorForm } from "@/pages/VendorForm"
import { BankConnections } from "@/pages/BankConnections"
import { SettingsLayout } from "@/pages/settings/SettingsLayout"
import { SettingsProfile } from "@/pages/settings/SettingsProfile"
import { SettingsRoles } from "@/pages/settings/SettingsRoles"
import { SettingsCompany } from "@/pages/settings/SettingsCompany"
import { SettingsTeam } from "@/pages/settings/SettingsTeam"
import { SettingsPipeline } from "@/pages/settings/SettingsPipeline"
import { SettingsFinancial } from "@/pages/settings/SettingsFinancial"
import { SettingsPartnersVendors } from "@/pages/settings/SettingsPartnersVendors"
import { SettingsIntegrations } from "@/pages/settings/SettingsIntegrations"
import { SettingsNotifications } from "@/pages/settings/SettingsNotifications"
import { SettingsSecurity } from "@/pages/settings/SettingsSecurity"
import { SettingsAuditLogs } from "@/pages/settings/SettingsAuditLogs"
import { SettingsData } from "@/pages/settings/SettingsData"
import { SettingsBranding } from "@/pages/settings/SettingsBranding"
import { SettingsSystem } from "@/pages/settings/SettingsSystem"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/setup-account" element={<SetupAccount />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/new" element={<LeadForm />} />
        <Route path="/leads/:id/edit" element={<LeadForm />} />

        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/new" element={<ContactForm />} />
        <Route path="/contacts/:id/edit" element={<ContactForm />} />

        <Route path="/companies" element={<Navigate to="/accounts" replace />} />
        <Route path="/accounts" element={<Companies />} />
        <Route path="/accounts/new" element={<AccountForm />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="/accounts/:id/edit" element={<AccountForm />} />

        <Route path="/deals" element={<Deals />} />
        <Route path="/deals/new" element={<DealForm />} />
        <Route path="/deals/:id/edit" element={<DealForm />} />

        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/new" element={<TaskForm />} />
        <Route path="/tasks/:id/edit" element={<TaskForm />} />

        <Route path="/activities" element={<Activities />} />
        <Route path="/reports" element={<Reports />} />

        {/* Cashflow — permission-matrix gated */}
        <Route path="/cashflow" element={<RoleGate permission="cashflow.view"><Cashflow /></RoleGate>} />
        <Route path="/cashflow/transactions" element={<RoleGate permission="cashflow.transactions"><Transactions /></RoleGate>} />
        <Route path="/cashflow/transactions/new" element={<RoleGate permission="cashflow.transactions"><TransactionForm /></RoleGate>} />
        <Route path="/cashflow/transactions/:id/edit" element={<RoleGate permission="cashflow.transactions"><TransactionForm /></RoleGate>} />
        <Route path="/cashflow/bank-connections" element={<RoleGate permission="cashflow.bank_connections"><BankConnections /></RoleGate>} />

        {/* Partners */}
        <Route path="/partners" element={<Partners />} />
        <Route path="/partners/new" element={<PartnerForm />} />
        <Route path="/partners/:id/edit" element={<PartnerForm />} />

        {/* Vendors */}
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/vendors/new" element={<VendorForm />} />
        <Route path="/vendors/:id/edit" element={<VendorForm />} />

        {/* Settings — nested module */}
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/profile" replace />} />
          <Route path="profile" element={<SettingsProfile />} />
          <Route path="roles" element={<RoleGate allow={["owner","super_user"]}><SettingsRoles /></RoleGate>} />
          <Route path="company" element={<RoleGate allow={["owner","super_user","admin"]}><SettingsCompany /></RoleGate>} />
          <Route path="team" element={<RoleGate allow={["owner","super_user","admin"]}><SettingsTeam /></RoleGate>} />
          <Route path="pipeline" element={<RoleGate allow={["owner","super_user","admin"]}><SettingsPipeline /></RoleGate>} />
          <Route path="financial" element={<RoleGate permission="cashflow.bank_connections"><SettingsFinancial /></RoleGate>} />
          <Route path="partners-vendors" element={<RoleGate allow={["owner","super_user","admin"]}><SettingsPartnersVendors /></RoleGate>} />
          <Route path="integrations" element={<RoleGate allow={["super_user"]}><SettingsIntegrations /></RoleGate>} />
          <Route path="notifications" element={<SettingsNotifications />} />
          <Route path="security" element={<RoleGate allow={["owner","super_user"]}><SettingsSecurity /></RoleGate>} />
          <Route path="audit-logs" element={<RoleGate allow={["owner","super_user"]}><SettingsAuditLogs /></RoleGate>} />
          <Route path="data" element={<RoleGate allow={["super_user"]}><SettingsData /></RoleGate>} />
          <Route path="branding" element={<RoleGate allow={["owner","super_user"]}><SettingsBranding /></RoleGate>} />
          <Route path="system" element={<RoleGate allow={["super_user"]}><SettingsSystem /></RoleGate>} />
        </Route>

        <Route path="/permissions" element={<Navigate to="/settings/roles" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
