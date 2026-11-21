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
const PrivacyPage = lazy(() => import('./pages/Info').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/Info').then((m) => ({ default: m.TermsPage })))
const RefundPage = lazy(() => import('./pages/Info').then((m) => ({ default: m.RefundPage })))
const AboutPage = lazy(() => import('./pages/Info').then((m) => ({ default: m.AboutPage })))
const ContactPage = lazy(() => import('./pages/Info').then((m) => ({ default: m.ContactPage })))

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
const AdminCustomers = lazy(() => import('./pages/admin/Customers').then((m) => ({ default: m.AdminCustomers })))
const AdminCustomerDetail = lazy(() => import('./pages/admin/Customers').then((m) => ({ default: m.AdminCustomerDetail })))
const AdminReports = lazy(() => import('./pages/admin/Reports').then((m) => ({ default: m.AdminReports })))
const AdminEmails = lazy(() => import('./pages/admin/Reports').then((m) => ({ default: m.AdminEmails })))
const AdminActivity = lazy(() => import('./pages/admin/Reports').then((m) => ({ default: m.AdminActivity })))
const AdminTeam = lazy(() => import('./pages/admin/Team'))
const AdminEnquiries = lazy(() => import('./pages/admin/Enquiries'))
const AdminEnquiryDetail = lazy(() => import('./pages/admin/EnquiryDetail'))
const AdminReportDetail = lazy(() => import('./pages/admin/ReportDetail'))
const AdminLogs = lazy(() => import('./pages/admin/Logs'))

function FullPageLoader({ label = 'Loading SiteOps…' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-page">
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
    if (!admin && user.role === 'customer') return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

/** Map an old /app/... URL onto its /dashboard/... equivalent, preserving the
    rest of the path and any query string. */
const LEGACY_MAP: Record<string, string> = { audits: 'requests', profile: 'settings' }
function LegacyCustomerRedirect() {
  const location = useLocation()
  const rest = location.pathname.replace(/^\/app\/?/, '')
  const [head, ...tail] = rest.split('/')
  const mapped = [LEGACY_MAP[head] || head, ...tail].filter(Boolean).join('/')
  return <Navigate to={`/dashboard${mapped ? `/${mapped}` : ''}${location.search}`} replace />
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

            {/* Public company / legal pages linked from the footer */}
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/refund" element={<RefundPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />

            {/* Customer application */}
            <Route path="/dashboard" element={<RequireCustomer><CustomerShell /></RequireCustomer>}>
              <Route index element={<CustomerDashboard />} />
              <Route path="websites" element={<WebsitesPage />} />
              <Route path="requests" element={<AuditsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<ProfilePage />} />
            </Route>

            {/* Legacy customer paths from the first release, kept working. */}
            <Route path="/app" element={<Navigate to="/dashboard" replace />} />
            <Route path="/app/*" element={<LegacyCustomerRedirect />} />

            {/* Administration application — separate entry point and shell */}
            <Route path="/admin/login" element={<RedirectIfAuthed admin><LoginPage admin /></RedirectIfAuthed>} />
            <Route path="/admin" element={<RequireAdmin><AdminShell /></RequireAdmin>}>
              <Route index element={<AdminDashboard />} />
              <Route path="enquiries" element={<AdminEnquiries />} />
              <Route path="enquiries/:id" element={<AdminEnquiryDetail />} />
              {/* legacy admin paths from the first release */}
              <Route path="audits" element={<AdminEnquiries />} />
              <Route path="audits/:id" element={<AdminEnquiryDetail />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="customers/:id" element={<AdminCustomerDetail />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="reports/:id" element={<AdminReportDetail />} />
              <Route path="emails" element={<AdminEmails />} />
              <Route path="logs" element={<AdminLogs />} />
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
