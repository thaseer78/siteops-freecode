import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, MailCheck, ShieldAlert } from 'lucide-react'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Field, InlineError, Spinner } from '../../components/ui'
import { api } from '../../lib/api'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const prefill = params.get('email') || ''
  const [state, setState] = useState<'idle' | 'working' | 'ok' | 'error'>(token ? 'working' : 'idle')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(prefill)
  const [resent, setResent] = useState<string | null>(null)
  const [devLink, setDevLink] = useState<string | null>(null)
  const navigate = useNavigate()
  const fired = useRef(false)

  useEffect(() => {
    if (!token) return
    // Single-use token: only exchange it once, even with StrictMode double effects.
    if (fired.current) return
    fired.current = true
    api.post<{ message: string }>('/auth/verify-email', { token })
      .then((r) => { setState('ok'); setMessage(r.message) })
      .catch((e) => { setState('error'); setMessage(e.message) })
  }, [token])

  async function resend(e: React.FormEvent) {
    e.preventDefault()
    setResent(null)
    try {
      const r = await api.post<{ message: string; dev_verification_url?: string }>('/auth/resend-verification', { email })
      setResent(r.message)
      if (r.dev_verification_url) setDevLink(r.dev_verification_url)
    } catch (err) {
      setMessage((err as Error).message)
    }
  }

  return (
    <AuthLayout title="Verify your email" subtitle="Email verification keeps your account and reports secure.">
      {state === 'working' && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface2 p-4 text-[13.5px] text-ink-600">
          <Spinner /> Confirming your verification link…
        </div>
      )}
      {state === 'ok' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary-700" />
            <p className="text-[13px] leading-relaxed text-primary-900">{message}</p>
          </div>
          <button className="btn-primary w-full py-3" onClick={() => navigate('/login')}>Sign in to continue <ArrowRight size={15} /></button>
        </div>
      )}
      {state === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-red-600" />
            <div className="text-[13px] leading-relaxed text-red-800">
              <p className="font-semibold">We couldn’t verify this link</p>
              <p className="mt-1">{message}</p>
            </div>
          </div>
          <form onSubmit={resend} className="space-y-3">
            <Field label="Email address" htmlFor="e"><input id="e" type="email" className="input" required value={email} onChange={(ev) => setEmail(ev.target.value)} /></Field>
            <button className="btn-ghost w-full py-3" type="submit">Send a new link</button>
          </form>
        </div>
      )}
      {state === 'idle' && (
        <form onSubmit={resend} className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4 text-[13px] leading-relaxed text-primary-900">
            <MailCheck size={18} className="mt-0.5 shrink-0" /> Enter your email and we’ll send a fresh verification link.
          </div>
          <Field label="Email address" htmlFor="em">
            <input id="em" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </Field>
          <button type="submit" className="btn-primary w-full py-3">Send verification link</button>
          {resent && <p className="rounded-lg bg-primary-50 px-3 py-2 text-[12.5px] text-primary-800">{resent}</p>}
          {devLink && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[12px] leading-relaxed text-amber-900">
              Email is not configured on this deployment. <Link className="font-semibold underline" to={devLink.replace(window.location.origin, '')}>Open the link directly</Link>.
            </div>
          )}
        </form>
      )}
      <p className="mt-6 text-center text-[12.5px] text-ink-500">
        <Link to="/login" className="font-medium hover:text-ink-900">Back to sign in</Link>
      </p>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await api.post<{ message: string; dev_reset_url?: string }>('/auth/forgot-password', { email })
      setSent(true)
      if (r.dev_reset_url) setDevLink(r.dev_reset_url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your account email and we’ll send a secure reset link.">
      {sent ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-[13px] leading-relaxed text-primary-900">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. The link expires in one hour.
          </p>
          {devLink && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[12px] leading-relaxed text-amber-900">
              Email is not configured on this deployment.{' '}
              <Link className="font-semibold underline" to={devLink.replace(window.location.origin, '')}>Open the reset link</Link>.
            </div>
          )}
          <Link to="/login" className="btn-ghost w-full">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <InlineError message={error} />
          <Field label="Email address" htmlFor="fp"><input id="fp" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy ? <><Spinner /> Sending…</> : 'Send reset link'}</button>
        </form>
      )}
      <p className="mt-6 text-center text-[12.5px] text-ink-500">
        Remembered it? <Link to="/login" className="font-semibold text-ink-900 hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="All active sessions will be signed out for your security.">
      {!token ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800">
          This page needs a valid reset token. <Link to="/forgot-password" className="font-semibold underline">Request a new link</Link>.
        </div>
      ) : done ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-[13px] text-primary-900">Password updated. You can now sign in with your new password.</p>
          <Link to="/login" className="btn-primary w-full py-3">Sign in <ArrowRight size={15} /></Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <InlineError message={error} />
          <Field label="New password" htmlFor="np" hint="At least 10 characters with letters and numbers.">
            <input id="np" type="password" className="input" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="np2">
            <input id="np2" type="password" className="input" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy ? <><Spinner /> Updating…</> : 'Update password'}</button>
        </form>
      )}
    </AuthLayout>
  )
}
