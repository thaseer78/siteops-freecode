import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, MailCheck } from 'lucide-react'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Field, InlineError, Spinner } from '../../components/ui'
import { ApiRequestError } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const { login, adminLogin } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') || '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setUnverified(false); setBusy(true)
    try {
      const user = admin ? await adminLogin(email, password) : await login(email, password)
      if (admin) navigate('/admin', { replace: true })
      else navigate(user.role === 'customer' ? '/app' : '/app', { replace: true })
    } catch (err) {
      const e = err as ApiRequestError
      setError(e.message)
      if (e.code === 'email_unverified') setUnverified(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      mode={admin ? 'admin' : 'customer'}
      title={admin ? 'Operations sign in' : 'Welcome back'}
      subtitle={admin
        ? 'Restricted to SiteOps staff accounts. Customer accounts cannot access this console.'
        : 'Sign in to manage your websites, audits and reports.'}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {admin && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
            Staff access only. Your role is verified against the database on every request.
          </div>
        )}
        <InlineError message={error} />
        {unverified && (
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-sky-900">
            <MailCheck size={16} className="mt-0.5 shrink-0" />
            <div>
              Your email isn’t verified yet.{' '}
              <Link to={`/verify-email?email=${encodeURIComponent(email)}`} className="font-semibold underline">Verify or resend the link</Link>.
            </div>
          </div>
        )}
        <Field label="Email address" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required className="input" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required
              className="input pr-11" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-500 hover:text-ink-800">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-between text-[12.5px]">
          <Link to="/forgot-password" className="font-medium text-ink-600 hover:text-ink-900">Forgot password?</Link>
          {!admin && <Link to="/register" className="font-medium text-mint-700 hover:text-mint-600">Create account</Link>}
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? <><Spinner /> Signing in…</> : <>Sign in <ArrowRight size={15} /></>}
        </button>
      </form>
      {!admin && (
        <p className="mt-6 text-center text-[12.5px] text-ink-500">
          New to SiteOps? <Link to="/register" className="font-semibold text-ink-900 hover:underline">Create a free account</Link>
        </p>
      )}
    </AuthLayout>
  )
}

export default LoginPage
