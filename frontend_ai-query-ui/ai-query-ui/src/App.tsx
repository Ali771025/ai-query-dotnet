import type { ReactNode } from 'react'
import {
  Navigate,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { DomainProvider } from './context/DomainContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { RequirePermission } from './components/auth/RequirePermission'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { SystemUsersPage } from './pages/admin/SystemUsersPage'
import { RolesPage } from './pages/admin/RolesPage'
import { OwnerDashboardPage } from './pages/owner/OwnerDashboardPage'
import { TokenChargesPage } from './pages/owner/TokenChargesPage'
import { ConsumptionRulesPage } from './pages/owner/ConsumptionRulesPage'
import { ReportsStatisticsPage } from './pages/owner/ReportsStatisticsPage'
import { ReportsPerformancePage } from './pages/owner/ReportsPerformancePage'
import { SecurityLogsPage } from './pages/owner/SecurityLogsPage'
import { UserLogsPage } from './pages/owner/UserLogsPage'
import { PaymentsPage } from './pages/owner/PaymentsPage'
import { SoftwareListPage } from './pages/manager/SoftwareListPage'
import { SoftwareFormPage } from './pages/manager/SoftwareFormPage'
import { DatabasesPage } from './pages/manager/DatabasesPage'
import { VersionsListPage } from './pages/manager/VersionsListPage'
import { VersionFormPage } from './pages/manager/VersionFormPage'
import { VersionKnowledgeManagePage } from './pages/manager/VersionKnowledgeManagePage'
import { UsersListPage } from './pages/manager/UsersListPage'
import { UserFormPage } from './pages/manager/UserFormPage'
import { UserTokenChargesPage } from './pages/manager/UserTokenChargesPage'
import { UserTokenChargeHistoryPage } from './pages/manager/UserTokenChargeHistoryPage'
import { ApiKeysPage } from './pages/manager/ApiKeysPage'
import { RequestMonitorPage } from './pages/manager/RequestMonitorPage'
import { PromptLogsPage } from './pages/manager/PromptLogsPage'
import { AccuracyFeedbackPage } from './pages/manager/AccuracyFeedbackPage'
import { MgmtReportsPage } from './pages/manager/MgmtReportsPage'
import { MyWalletPage } from './pages/enduser/MyWalletPage'
import { MyApiKeysPage } from './pages/enduser/MyApiKeysPage'
import { OrgMembersPage } from './pages/enduser/OrgMembersPage'
import { CompanyRolesPage } from './pages/manager/CompanyRolesPage'
import { SoftwareOwnerReportsPage } from './pages/manager/SoftwareOwnerReportsPage'
import { AiModelTestPage } from './pages/manager/AiModelTestPage'
import { MyApiKeyReportsPage } from './pages/enduser/MyApiKeyReportsPage'
import { AiProvidersPage } from './pages/owner/AiProvidersPage'

function P({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  return <RequirePermission permission={permission}>{children}</RequirePermission>
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/design-system" element={<DesignSystemPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<OwnerDashboardPage />} />
          <Route
            path="system-users"
            element={
              <P permission="users.view">
                <SystemUsersPage />
              </P>
            }
          />
          <Route
            path="roles"
            element={
              <P permission="roles.view">
                <RolesPage />
              </P>
            }
          />
          <Route
            path="token-charges"
            element={
              <P permission="tokens.view">
                <TokenChargesPage />
              </P>
            }
          />
          <Route
            path="consumption-rules"
            element={
              <P permission="rules.view">
                <ConsumptionRulesPage />
              </P>
            }
          />
          <Route
            path="reports/statistics"
            element={
              <P permission="reports-stats.view">
                <ReportsStatisticsPage />
              </P>
            }
          />
          <Route
            path="reports/performance"
            element={
              <P permission="reports-performance.view">
                <ReportsPerformancePage />
              </P>
            }
          />
          <Route
            path="logs/security"
            element={
              <P permission="logs-security.view">
                <SecurityLogsPage />
              </P>
            }
          />
          <Route
            path="logs/user"
            element={
              <P permission="logs-user.view">
                <UserLogsPage />
              </P>
            }
          />
          <Route
            path="payments"
            element={
              <P permission="payments.view">
                <PaymentsPage />
              </P>
            }
          />
          <Route
            path="software"
            element={
              <P permission="software.view">
                <SoftwareListPage />
              </P>
            }
          />
          <Route
            path="software/new"
            element={
              <P permission="software.create">
                <SoftwareFormPage />
              </P>
            }
          />
          <Route
            path="software/:id"
            element={
              <P permission="software.edit">
                <SoftwareFormPage />
              </P>
            }
          />
          <Route
            path="versions"
            element={
              <P permission="versions.view">
                <VersionsListPage />
              </P>
            }
          />
          <Route
            path="versions/new"
            element={
              <P permission="versions.create">
                <VersionFormPage />
              </P>
            }
          />
          <Route
            path="versions/:id/knowledge"
            element={
              <P permission="versions.edit">
                <VersionKnowledgeManagePage />
              </P>
            }
          />
          <Route
            path="versions/:id"
            element={
              <P permission="versions.edit">
                <VersionFormPage />
              </P>
            }
          />
          <Route
            path="databases"
            element={
              <P permission="databases.view">
                <DatabasesPage />
              </P>
            }
          />
          <Route
            path="users"
            element={
              <P permission="appusers.view">
                <UsersListPage />
              </P>
            }
          />
          <Route
            path="users/new"
            element={
              <P permission="appusers.create">
                <UserFormPage />
              </P>
            }
          />
          <Route
            path="users/:id"
            element={
              <P permission="appusers.edit">
                <UserFormPage />
              </P>
            }
          />
          <Route
            path="company-roles"
            element={
              <P permission="company-roles.view">
                <CompanyRolesPage />
              </P>
            }
          />
          <Route
            path="user-tokens"
            element={
              <P permission="appusers-tokens.view">
                <UserTokenChargesPage />
              </P>
            }
          />
          <Route
            path="user-token-history"
            element={
              <P permission="appusers-token-history.view">
                <UserTokenChargeHistoryPage />
              </P>
            }
          />
          <Route
            path="api-keys"
            element={
              <P permission="apikeys.view">
                <ApiKeysPage />
              </P>
            }
          />
          <Route
            path="my-wallet"
            element={
              <P permission="my-wallet.view">
                <MyWalletPage />
              </P>
            }
          />
          <Route
            path="org-members"
            element={
              <P permission="org-members.view">
                <OrgMembersPage />
              </P>
            }
          />
          <Route
            path="my-api-keys"
            element={
              <P permission="my-apikeys.view">
                <MyApiKeysPage />
              </P>
            }
          />
          <Route
            path="owner-api-keys"
            element={
              <P permission="owner-apikeys.view">
                <MyApiKeysPage />
              </P>
            }
          />
          <Route
            path="requests"
            element={
              <P permission="requests.view">
                <RequestMonitorPage />
              </P>
            }
          />
          <Route
            path="prompt-logs"
            element={
              <P permission="prompts.view">
                <PromptLogsPage />
              </P>
            }
          />
          <Route
            path="accuracy"
            element={
              <P permission="accuracy.view">
                <AccuracyFeedbackPage />
              </P>
            }
          />
          <Route
            path="mgmt-reports"
            element={
              <P permission="mgmt-reports.view">
                <MgmtReportsPage />
              </P>
            }
          />
          <Route
            path="sw-reports"
            element={
              <P permission="sw-reports-advanced.view">
                <SoftwareOwnerReportsPage />
              </P>
            }
          />
          <Route
            path="ai-model-test"
            element={
              <P permission="ai-model-test.view">
                <AiModelTestPage />
              </P>
            }
          />
          <Route
            path="ai-providers"
            element={
              <P permission="ai-providers.view">
                <AiProvidersPage />
              </P>
            }
          />
          <Route
            path="my-apikey-reports"
            element={
              <P permission="my-apikey-reports.view">
                <MyApiKeyReportsPage />
              </P>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </>,
  ),
)

export function App() {
  return (
    <ThemeProvider>
      <ConfirmProvider>
        <AuthProvider>
          <DomainProvider>
            <RouterProvider router={router} />
          </DomainProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ThemeProvider>
  )
}
