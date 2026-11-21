import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, CheckCircle2, Mail, Search, Users } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { EmailLog, Website } from '../../lib/types'
import { EmptyState, ErrorState, PageHeader, SkeletonRows, useToast } from '../../components/ui'
import { formatDate, prettyHost, scoreTone, timeAgo } from '../../lib/format'
import { AuditStatusPill } from '../customer/Websites'

interface CustomerRow {
  id: string; full_name: string; email: string; company: string | null; phone: string | null
  status: 'active' | 'suspended'; created_at: string; email_verified_at: string | null
  websites: number; audits: number; last_report: string | null
}

export function AdminCustomers() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<CustomerRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = (query = q) => {
    setError(null)
    api.get<{ customers: CustomerRow[] }>(`/admin/customers?q=${encodeURIComponent(query)}`)
      .then((r) => setRows(r.customers)).catch((e) => setError(e.message))
  }
  useEffect(() => { load('') }, [])

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Customers"
        subtitle="Search accounts, inspect their websites and audit history, and manage access according to your role." />
      <form className="mb-4 relative max-w-md" onSubmit={(e) => { e.preventDefault(); load() }} role="search">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or company" aria-label="Search customers" />
      </form>

      {error && <div className="card"><ErrorState message={error} onRetry={() => load()} /></div>}
      {!error && rows === null && <div className="card"><SkeletonRows rows={5} /></div>}
      {rows && rows.length === 0 && <div className="card"><EmptyState icon={<Users size={22} />} title="No customers found" body="Try a different search term, or wait for new registrations to arrive." /></div>}

      {rows && rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[820px]">
              <thead><tr className="border-b border-ink-900/[.07]">
                <th className="table-head">Customer</th><th className="table-head">Company</th>
                <th className="table-head">Websites</th><th className="table-head">Audits</th>
                <th className="table-head">Last report</th><th className="table-head">Status</th><th className="table-head text-right" />
              </tr></thead>
              <tbody className="divide-y divide-ink-900/[.05]">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-surface2">
                    <td className="table-cell">
                      <Link to={`/admin/customers/${c.id}`} className="font-medium text-ink-900 hover:text-primary-700">{c.full_name}</Link>
                      <p className="text-[11.5px] text-ink-500">{c.email}</p>
                    </td>
                    <td className="table-cell text-ink-600">{c.company || '—'}</td>
                    <td className="table-cell font-medium text-ink-800">{c.websites}</td>
                    <td className="table-cell text-ink-700">{c.audits}</td>
                    <td className="table-cell whitespace-nowrap text-ink-500">{c.last_report ? timeAgo(c.last_report) : '—'}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`chip ${c.status === 'active' ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-700'}`}>{c.status}</span>
                        {!c.email_verified_at && <span className="chip bg-amber-50 text-amber-800">unverified</span>}
                      </div>
                    </td>
                    <td className="table-cell text-right"><Link to={`/admin/customers/${c.id}`} className="text-[12.5px] font-semibold text-primary-700 hover:underline">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

interface Detail {
  customer: CustomerRow & { role: string }
  websites: Array<Website & { latest_score: number | null }>
  audits: Array<{ id: string; status: string; strategy: string; requested_at: string; completed_at: string | null; error: string | null; website_name: string; url: string; report_id: string | null; overall: number | null }>
  emails: EmailLog[]
  activity: Array<{ id: string; action: string; created_at: string; meta: Record<string, unknown> }>
}

export function AdminCustomerDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { push } = useToast()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canManage = ['admin', 'super_admin'].includes(user?.role || '')

  const load = () => {
    setError(null)
    api.get<Detail>(`/admin/customers/${id}`).then(setData).catch((e) => setError(e.message))
  }
  useEffect(load, [id])

  async function setStatus(status: 'active' | 'suspended') {
    setBusy(true)
    try {
      await api.patch(`/admin/customers/${id}`, { status })
      push({ kind: 'success', title: status === 'active' ? 'Account reactivated' : 'Account suspended', body: status === 'suspended' ? 'Active sessions were revoked immediately.' : undefined })
      load()
    } catch (e) { push({ kind: 'error', title: 'Could not update', body: (e as Error).message }) } finally { setBusy(false) }
  }

  if (error) return <><PageHeader title="Customer" /><div className="card"><ErrorState message={error} onRetry={load} /></div></>
  if (!data) return <><PageHeader title="Customer" subtitle="Loading account…" /><div className="card"><SkeletonRows rows={5} /></div></>
  const { customer, websites, audits, emails, activity } = data

  return (
    <div>
      <Link to="/admin/customers" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Customers
      </Link>
      <PageHeader eyebrow="Customer account" title={customer.full_name}
        subtitle={`${customer.email}${customer.company ? ` · ${customer.company}` : ''} · joined ${formatDate(customer.created_at)}`}
        actions={canManage && (customer.status === 'active'
          ? <button className="btn-danger" onClick={() => setStatus('suspended')} disabled={busy}><Ban size={14} /> Suspend account</button>
          : <button className="btn-accent" onClick={() => setStatus('active')} disabled={busy}><CheckCircle2 size={14} /> Reactivate</button>) || undefined} />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="card card-pad lg:col-span-1">
          <p className="text-[12px] font-medium uppercase tracking-wider text-ink-500">Account</p>
          <dl className="mt-3 space-y-2.5 text-[12.5px]">
            <div className="flex justify-between gap-2"><dt className="text-ink-500">Status</dt><dd><span className={`chip ${customer.status === 'active' ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-700'}`}>{customer.status}</span></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-500">Role</dt><dd className="font-medium capitalize text-ink-800">{customer.role.replace('_', ' ')}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-500">Verified</dt><dd className="font-medium text-ink-800">{customer.email_verified_at ? 'Yes' : 'No'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-500">Phone</dt><dd className="font-medium text-ink-800">{customer.phone || '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-500">Websites</dt><dd className="font-medium text-ink-800">{websites.length}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-ink-500">Audits</dt><dd className="font-medium text-ink-800">{audits.length}</dd></div>
          </dl>
          <a href={`mailto:${customer.email}`} className="btn-ghost mt-4 w-full text-[12.5px]"><Mail size={13} /> Email customer</a>
          {!canManage && <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">Support staff have read-only access to account status.</p>}
        </div>

        <div className="space-y-4 lg:col-span-3">
          <div className="card">
            <div className="border-b border-ink-900/[.07] px-5 py-4"><h2 className="text-[14.5px] font-semibold text-ink-900">Registered websites</h2></div>
            {websites.length === 0 ? <p className="px-5 py-6 text-[12.5px] text-ink-500">This customer has not registered a website yet.</p> : (
              <ul className="divide-y divide-ink-900/[.05]">
                {websites.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`grid h-9 w-9 place-items-center rounded-lg text-[12px] font-bold ${scoreTone(w.latest_score).bg} ${scoreTone(w.latest_score).text}`}>{w.latest_score ?? '—'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-900">{w.name}</p>
                      <p className="truncate text-[11.5px] text-ink-500">{prettyHost(w.url)} · added {formatDate(w.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="border-b border-ink-900/[.07] px-5 py-4"><h2 className="text-[14.5px] font-semibold text-ink-900">Audit history</h2></div>
            {audits.length === 0 ? <p className="px-5 py-6 text-[12.5px] text-ink-500">No audit requests from this customer.</p> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[620px]">
                  <thead><tr className="border-b border-ink-900/[.06]">
                    <th className="table-head">Website</th><th className="table-head">Status</th><th className="table-head">Requested</th><th className="table-head">Score</th><th className="table-head text-right" />
                  </tr></thead>
                  <tbody className="divide-y divide-ink-900/[.05]">
                    {audits.map((a) => (
                      <tr key={a.id} className="hover:bg-surface2">
                        <td className="table-cell"><p className="font-medium text-ink-900">{a.website_name}</p><p className="text-[11.5px] text-ink-500">{prettyHost(a.url)}</p></td>
                        <td className="table-cell"><AuditStatusPill status={a.status as 'pending'} /></td>
                        <td className="table-cell whitespace-nowrap text-ink-500">{formatDate(a.requested_at)}</td>
                        <td className="table-cell">{a.overall ?? '—'}</td>
                        <td className="table-cell text-right"><Link to={`/admin/audits/${a.id}`} className="text-[12.5px] font-semibold text-primary-700 hover:underline">Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card">
              <div className="border-b border-ink-900/[.07] px-5 py-4"><h2 className="text-[14px] font-semibold text-ink-900">Email history</h2></div>
              {emails.length === 0 ? <p className="px-5 py-5 text-[12px] text-ink-500">No emails logged.</p> : (
                <ul className="divide-y divide-ink-900/[.05]">
                  {emails.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex items-center gap-2 px-5 py-2.5">
                      <span className={`chip ${e.status === 'sent' ? 'bg-primary-50 text-primary-700' : e.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-ink-900/[.05] text-ink-600'}`}>{e.status.replace('_', ' ')}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-700">{e.kind}</span>
                      <span className="text-[11px] text-ink-500">{timeAgo(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card">
              <div className="border-b border-ink-900/[.07] px-5 py-4"><h2 className="text-[14px] font-semibold text-ink-900">Account activity</h2></div>
              {activity.length === 0 ? <p className="px-5 py-5 text-[12px] text-ink-500">No activity recorded.</p> : (
                <ul className="divide-y divide-ink-900/[.05]">
                  {activity.slice(0, 6).map((a) => (
                    <li key={a.id} className="px-5 py-2.5">
                      <p className="text-[12px] font-medium text-ink-800">{a.action}</p>
                      <p className="text-[11px] text-ink-500">{timeAgo(a.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
