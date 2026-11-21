import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Copy } from 'lucide-react'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Field, InlineError, Spinner } from '../../components/ui'
import { api } from '../../lib/api'

export function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', company: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ email: string; devLink?: string; delivery: string } | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    if (form.password.length < 10) return setError('Use at least 10 characters with letters and numbers.')
    setBusy(true)
    try {
      const res = await api.post<{ email: string; email_delivery: string; dev_verification_url?: string }>('/auth/register', {
        full_name: form.full_name, email: form.email, company: form.company, password: form.password,
      })
      setDone({ email: res.email, devLink: res.dev_verification_url, delivery: res.email_delivery })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a verification link to ${done.email}.`}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary-700" />
            <div className="text-[13px] leading-relaxed text-primary-900">
              <p className="font-semibold">Account created</p>
              <p className="mt-1">Click the link in the email to activate your account. The link expires in 24 hours.</p>
            </div>
          </div>
          {done.delivery === 'not_configured' && done.devLink && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[12.5px] font-semibold text-amber-900">Email delivery is not configured on this deployment</p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                The verification link below is shown because no mail provider key is set. Set
                <code className="mx-1 rounded bg-ink-900/10 px-1 py-0.5">RESEND_API_KEY</code> to send real email.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <input readOnly value={done.devLink} className="input text-[11.5px]" onFocus={(e) => e.target.select()} />
                <button type="button" className="btn-ghost shrink-0 px-2.5" aria-label="Copy link"
                  onClick={() => navigator.clipboard?.writeText(done.devLink!)}><Copy size={14} /></button>
              </div>
              <Link to={done.devLink.replace(window.location.origin, '')} className="btn-accent mt-3 w-full">Open verification link</Link>
            </div>
          )}
          <Link to={`/login?email=${encodeURIComponent(done.email)}`} className="btn-ghost w-full">Go to sign in</Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your SiteOps account" subtitle="Free to start. Register a website and request your first audit.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <InlineError message={error} />
        <Field label="Full name" htmlFor="name">
          <input id="name" className="input" required autoComplete="name" value={form.full_name} onChange={set('full_name')} placeholder="Asha Rao" />
        </Field>
        <Field label="Work email" htmlFor="email">
          <input id="email" type="email" className="input" required autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@company.com" />
        </Field>
        <Field label="Company" hint="Optional — helps us address reports correctly." htmlFor="company">
          <input id="company" className="input" autoComplete="organization" value={form.company} onChange={set('company')} placeholder="Kaveri Crafts" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="pw" hint="10+ characters, letters and numbers.">
            <input id="pw" type="password" className="input" required autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>
          <Field label="Confirm password" htmlFor="pw2">
            <input id="pw2" type="password" className="input" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
          </Field>
        </div>
        <p className="text-[11.5px] leading-relaxed text-ink-500">
          By creating an account you agree to SiteOps using Google PageSpeed Insights to measure your website.
          Reports describe a single measurement and are not a security certification.
        </p>
        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? <><Spinner /> Creating account…</> : <>Create account <ArrowRight size={15} /></>}
        </button>
      </form>
      <p className="mt-6 text-center text-[12.5px] text-ink-500">
        Already have an account? <Link to="/login" className="font-semibold text-ink-900 hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  )
}

export default RegisterPage
