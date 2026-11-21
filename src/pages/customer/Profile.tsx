import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, Mail, Save, ShieldCheck, UserRound } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Field, InlineError, PageHeader, Spinner, useToast } from '../../components/ui'
import { formatDate } from '../../lib/format'

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: user?.full_name || '', company: user?.company || '', phone: user?.phone || '' })
  const [prefs, setPrefs] = useState(user?.notification_prefs || {})
  const [profileBusy, setProfileBusy] = useState(false)
  const [prefsBusy, setPrefsBusy] = useState(false)
  const [pw, setPw] = useState({ current_password: '', password: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setProfileBusy(true)
    try {
      const r = await api.patch<{ user: typeof user }>('/auth/profile', form)
      setUser(r.user)
      push({ kind: 'success', title: 'Profile saved' })
    } catch (e) { push({ kind: 'error', title: 'Could not save', body: (e as Error).message }) } finally { setProfileBusy(false) }
  }

  async function togglePref(key: 'email_reports' | 'email_audits' | 'push') {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next); setPrefsBusy(true)
    try {
      await api.patch('/auth/preferences', next)
      push({ kind: 'success', title: 'Preferences updated' })
    } catch (e) {
      setPrefs(prefs)
      push({ kind: 'error', title: 'Could not update', body: (e as Error).message })
    } finally { setPrefsBusy(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    if (pw.password !== pw.confirm) return setPwError('New passwords do not match.')
    setPwBusy(true)
    try {
      await api.post('/auth/change-password', { current_password: pw.current_password, password: pw.password })
      push({ kind: 'success', title: 'Password changed', body: 'Please sign in again with your new password.' })
      setUser(null)
      navigate('/login')
    } catch (e) { setPwError((e as Error).message) } finally { setPwBusy(false) }
  }

  const prefRows: Array<{ key: 'email_reports' | 'email_audits' | 'push'; label: string; body: string }> = [
    { key: 'email_audits', label: 'Audit status emails', body: 'Confirmation when a request is received and when it completes.' },
    { key: 'email_reports', label: 'Report delivery emails', body: 'PDF reports sent by our team to your inbox.' },
    { key: 'push', label: 'Mobile push notifications', body: 'Alerts in the SiteOps Android and iOS app. Requires the app installed.' },
  ]

  return (
    <div>
      <PageHeader eyebrow="Account" title="Profile & settings"
        subtitle="Your account details, security and notification preferences across web and mobile." />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-4">
          <form onSubmit={saveProfile} className="card card-pad">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><UserRound size={16} className="text-ink-500" /> Personal information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="pn"><input id="pn" className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="Company" htmlFor="pc"><input id="pc" className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
              <Field label="Phone" htmlFor="pp"><input id="pp" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91" inputMode="tel" /></Field>
              <Field label="Email" htmlFor="pe" hint="Contact support to change your login email.">
                <input id="pe" className="input bg-surface2 text-ink-500" value={user?.email || ''} readOnly />
              </Field>
            </div>
            <button className="btn-primary mt-4" type="submit" disabled={profileBusy}>
              {profileBusy ? <><Spinner /> Saving…</> : <><Save size={14} /> Save changes</>}
            </button>
          </form>

          <div className="card card-pad">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><Mail size={16} className="text-ink-500" /> Notification preferences</h2>
            <p className="mt-1 text-[12.5px] text-ink-500">In-app notifications are always on. These control email and push delivery.</p>
            <div className="mt-4 divide-y divide-ink-900/[.06]">
              {prefRows.map((r) => (
                <div key={r.key} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink-900">{r.label}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{r.body}</p>
                  </div>
                  <button type="button" role="switch" aria-checked={prefs[r.key] !== false} disabled={prefsBusy}
                    onClick={() => togglePref(r.key)} aria-label={r.label}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${prefs[r.key] !== false ? 'bg-primary-600' : 'bg-ink-900/15'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${prefs[r.key] !== false ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={changePassword} className="card card-pad" noValidate>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><KeyRound size={16} className="text-ink-500" /> Change password</h2>
            <p className="mt-1 text-[12.5px] text-ink-500">Changing your password signs out all other sessions.</p>
            <div className="mt-4 space-y-3.5">
              <InlineError message={pwError} />
              <Field label="Current password" htmlFor="cp"><input id="cp" type="password" className="input" required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password" htmlFor="npw" hint="10+ characters, letters and numbers."><input id="npw" type="password" className="input" required autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
                <Field label="Confirm new password" htmlFor="npw2"><input id="npw2" type="password" className="input" required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
              </div>
              <button className="btn-primary" type="submit" disabled={pwBusy}>{pwBusy ? <><Spinner /> Updating…</> : 'Update password'}</button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <div className="card card-pad">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-900 text-[15px] font-bold text-primary-300">
                {user?.full_name.split(' ').slice(0, 2).map((p) => p[0]).join('')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink-900">{user?.full_name}</p>
                <p className="truncate text-[12px] text-ink-500">{user?.email}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2.5 text-[12.5px]">
              <div className="flex justify-between gap-3"><dt className="text-ink-500">Account type</dt><dd className="font-medium capitalize text-ink-800">{user?.role.replace('_', ' ')}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-500">Status</dt><dd className="inline-flex items-center gap-1.5 font-medium text-primary-700"><span className="h-1.5 w-1.5 rounded-full bg-primary-500" />{user?.status}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-500">Email verified</dt><dd className="font-medium text-ink-800">{user?.email_verified ? formatDate(user.created_at) : 'No'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-500">Member since</dt><dd className="font-medium text-ink-800">{formatDate(user?.created_at)}</dd></div>
            </dl>
          </div>

          <div className="card card-pad">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-900"><ShieldCheck size={15} className="text-ink-500" /> Security</h2>
            <ul className="mt-2.5 space-y-2 text-[12px] leading-relaxed text-ink-500">
              <li>· Sessions are server-side and expire after 7 days.</li>
              <li>· Passwords are hashed with scrypt and a per-user salt.</li>
              <li>· You can only ever see your own websites and reports.</li>
            </ul>
            <button className="btn-danger mt-4 w-full" onClick={async () => { await logout(); navigate('/') }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>

          <div className="card card-pad bg-surface2">
            <p className="text-[13px] font-semibold text-ink-900">Mobile app</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
              The SiteOps Android and iOS app uses this same account. See <code className="rounded bg-white px-1">mobile/README.md</code> to build it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
