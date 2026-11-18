import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth, isStaff } from './lib/auth'
import { Spinner, ToastProvider } from './components/ui'
import { Logo } from './components/Brand'

const Landing = lazy(() => import('./pages/Landing'))
const LoginPage = lazy(() => import('./pages/auth/Login'))
const RegisterPage = lazy(() => import('./pages/auth/Register'))
const VerifyEmailPage = lazy(() => import('./pages/auth/Password').then((m) => ({ default: m.VerifyEmailPage })))
const ForgotPasswordPage = lazy(() => import('./pages/auth/Password').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/auth/Password').then((m) => ({ default: m.ResetPasswordPage })))
const NotFound = lazy(() => import('./pages/NotFound'))

const CustomerShell = lazy(() => import('./components/layout/CustomerShell'))
const AdminShell = lazy(() => import('./components/layout/AdminShell'))
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'))
const WebsitesPage = lazy(() => import('./pages/customer/Websites'))
const AuditsPage = lazy(() => import('./pages/customer/Audits'))
const ReportsPage = lazy(() => import('./pages/customer/Reports'))
const ReportDetailPage = lazy(() => import('./pages/customer/ReportDetail'))
const NotificationsPage = lazy(() => import('./pages/customer/Notifications'))
const ProfilePage = lazy(() => import('./pages/customer/Profile'))

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminAudits = lazy(() => import('./pages/admin/Audits'))
const AdminAuditDetail = lazy(() => import('./pages/admin/AuditDetail'))
const AdminCustomers = lazy(() => import('./pages/admin/Customers').then((m) => ({ default: m.AdminCustomers })))
const AdminCustomerDetail = lazy(() => import('./pages/admin/Customers').then((m) => ({ default: m.AdminCustomerDetail })))
const AdminReports = lazy(() => import('./pages/admin/Reports').then((m) => ({ default: m.AdminReports })))
const AdminEmails = lazy(() => import('./pages/admin/Reports').then((m) => ({ default: m.AdminEmails })))
const AdminActivity = lazy(() => import('./pages/admin/Reports').then((m) => ({ default: m.AdminActivity })))
const AdminTeam = lazy(() => import('./pages/admin/Team'))

function FullPageLoader({ label = 'Loading SiteOps…' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F6F8FC]">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <div className="flex items-center gap-2 text-[12.5px] text-ink-500"><Spinner size={14} /> {label}</div>
      </div>
    </div>
  )
}

/* Customer routes require a verified, active session. Staff are allowed in so they
   can see exactly what the customer sees, but customer data is still scoped to them. */
function RequireCustomer({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (!user.email_verified) return <Navigate to="/verify-email" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoader label="Checking access…" />
  if (!user) return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (!isStaff(user)) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

/* Keep signed-in users away from the login screens. */
function RedirectIfAuthed({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (user) {
    if (admin && isStaff(user)) return <Navigate to="/admin" replace />
    if (!admin && user.role === 'customer') return <Navigate to="/app" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<FullPageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Customer application */}
            <Route path="/app" element={<RequireCustomer><CustomerShell /></RequireCustomer>}>
              <Route index element={<CustomerDashboard />} />
              <Route path="websites" element={<WebsitesPage />} />
              <Route path="audits" element={<AuditsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Administration application — separate entry point and shell */}
            <Route path="/admin/login" element={<RedirectIfAuthed admin><LoginPage admin /></RedirectIfAuthed>} />
            <Route path="/admin" element={<RequireAdmin><AdminShell /></RequireAdmin>}>
              <Route index element={<AdminDashboard />} />
              <Route path="audits" element={<AdminAudits />} />
              <Route path="audits/:id" element={<AdminAuditDetail />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="customers/:id" element={<AdminCustomerDetail />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="emails" element={<AdminEmails />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="staff" element={<AdminTeam />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  )
}
