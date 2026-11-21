import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, RefreshCw, Search } from 'lucide-react'
import { api } from '../../lib/api'
import type { ActivityLogRow } from '../../lib/types'
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from '../../components/ui'
import { formatDate, timeAgo } from '../../lib/format'

/** Actions the spec calls out get a friendly label and a tone. */
const TONE: Record<string, string> = {
  ADMIN_LOGIN: 'bg-primary-50 text-primary-700',
  ADMIN_LOGIN_DENIED: 'bg-red-50 text-red-700',
  AUDIT_EXECUTED: 'bg-primary-50 text-primary-700',
  AUDIT_FAILED: 'bg-red-50 text-red-700',
  AUDIT_QUEUED_BY_ADMIN: 'bg-amber-50 text-amber-800',
  REPORT_PDF_GENERATED: 'bg-ink-900/[.05] text-ink-700',
  REPORT_EMAIL_SENT: 'bg-primary-50 text-primary-700',
  REPORT_EMAIL_FAILED: 'bg-red-50 text-red-700',
  EMAIL_RETRIED: 'bg-primary-50 text-primary-700',
  ENQUIRY_STATUS_UPDATED: 'bg-amber-50 text-amber-800',
  ENQUIRY_UPDATED: 'bg-amber-50 text-amber-800',
  INTERNAL_NOTES_UPDATED: 'bg-ink-900/[.05] text-ink-700',
  USER_REGISTERED: 'bg-ink-900/[.05] text-ink-700',
}

export default function AdminLogs() {
  const [rows, setRows] = useState<ActivityLogRow[] | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')

  const load = () => {
    setError(null)
    const query = new URLSearchParams()
    if (q.trim()) query.set('q', q.trim())
    if (action) query.set('action', action)
    api.get<{ activity: ActivityLogRow[]; actions: string[] }>(`/admin/logs?${query}`)
      .then((r) => { setRows(r.activity); setActions(r.actions) })
      .catch((e) => setError(e.message))
  }
  useEffect(() => { void load() }, [action])

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Activity log"
        subtitle="Audit trail of administrative actions: logins, audit runs, PDF generation, email deliveries and enquiry changes."
        actions={<button className="btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>} />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); load() }}>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input className="input w-full pl-9" placeholder="Search action, actor or entity" value={q}
            onChange={(e) => setQ(e.target.value)} aria-label="Search activity" />
        </form>
        <select className="input sm:w-64" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {error && <div className="card"><ErrorState message={error} onRetry={load} /></div>}
      {!error && rows === null && <div className="card"><SkeletonRows rows={6} /></div>}
      {rows && rows.length === 0 && (
        <div className="card"><EmptyState icon={<Activity size={22} />} title="No matching activity" body="Try clearing the search or picking a different action." /></div>
      )}
      {rows && rows.length > 0 && (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-ink-900/[.05]">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                <span className={`chip shrink-0 ${TONE[r.action] || 'bg-ink-900/[.05] text-ink-700'}`}>{r.action.replace(/_/g, ' ')}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] text-ink-800">
                    <span className="font-medium">{r.actor_email || 'system'}</span>
                    {r.actor_role && <span className="text-ink-500"> · {r.actor_role.replace('_', ' ')}</span>}
                    {r.entity_type && <span className="text-ink-500"> · {r.entity_type}{r.entity_id ? ` ${r.entity_id.slice(0, 8)}` : ''}</span>}
                  </p>
                  {r.metadata && Object.keys(r.metadata).length > 0 && (
                    <p className="mt-0.5 break-words text-[11px] text-ink-500">
                      {Object.entries(r.metadata).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11.5px] text-ink-500" title={formatDate(r.created_at, true)}>{timeAgo(r.created_at)}</p>
                  {r.ip_address && <p className="text-[10.5px] text-ink-400">{r.ip_address}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[11.5px] text-ink-500">
        Customer report emails and PDF generation are recorded here automatically. Enquiries are managed from{' '}
        <Link to="/admin/enquiries" className="font-semibold text-primary-700 hover:underline">audit enquiries</Link>.
      </p>
    </div>
  )
}
