import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Play, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { api } from '../../lib/api'
import type { AuditRequest } from '../../lib/types'
import { EmptyState, ErrorState, PageHeader, SkeletonRows, Tabs, useToast } from '../../components/ui'
import { formatDate, prettyHost, timeAgo } from '../../lib/format'
import { AuditStatusPill } from '../customer/Websites'

type Filter = 'all' | 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export default function AdminEnquiries() {
  const { push } = useToast()
  const [rows, setRows] = useState<AuditRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = (quiet = false) => {
    if (!quiet) setError(null)
    const query = new URLSearchParams()
    if (filter !== 'all') query.set('status', filter)
    if (q.trim()) query.set('q', q.trim())
    api.get<{ enquiries: AuditRequest[] }>(`/admin/enquiries?${query}`)
      .then((r) => setRows(r.enquiries)).catch((e) => setError(e.message))
  }
  useEffect(() => { void load() }, [filter])

  async function run(id: string) {
    setBusy(id)
    try {
      await api.post(`/admin/enquiries/${id}/run`)
      push({ kind: 'success', title: 'Audit queued', body: 'PageSpeed Insights is measuring mobile and desktop now.' })
      load(true)
    } catch (e) { push({ kind: 'error', title: 'Could not queue audit', body: (e as Error).message }) } finally { setBusy(null) }
  }

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Audit enquiries"
        subtitle="Every customer request. Update status, assign an operator, keep internal notes, and run live PageSpeed audits."
        actions={<button className="btn-ghost" onClick={() => load()}><RefreshCw size={14} /> Refresh</button>} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={[
          { id: 'all', label: 'All' }, { id: 'pending', label: 'Pending' }, { id: 'in_progress', label: 'In progress' },
          { id: 'completed', label: 'Completed' }, { id: 'failed', label: 'Failed' }, { id: 'cancelled', label: 'Cancelled' },
        ]} value={filter} onChange={setFilter} />
        <form className="relative" onSubmit={(e) => { e.preventDefault(); load() }}>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input className="input w-full pl-9 sm:w-72" placeholder="Search domain, name or email"
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search enquiries" />
        </form>
      </div>

      {error && <div className="card"><ErrorState message={error} onRetry={() => load()} /></div>}
      {!error && rows === null && <div className="card"><SkeletonRows rows={5} /></div>}
      {rows && rows.length === 0 && (
        <div className="card"><EmptyState icon={<Play size={22} />} title="Nothing in this queue"
          body="New customer audit enquiries appear here immediately. Try a different filter or clear the search." /></div>
      )}
      {rows && rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[860px]">
              <thead><tr className="border-b border-ink-900/[.07]">
                <th className="table-head">Enquiry</th><th className="table-head">Customer</th>
                <th className="table-head">Status</th><th className="table-head">Assigned</th>
                <th className="table-head">Requested</th><th className="table-head text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-900/[.05]">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-surface2">
                    <td className="table-cell">
                      <Link to={`/admin/enquiries/${a.id}`} className="font-medium text-ink-900 hover:text-primary-700">
                        {a.website_name || prettyHost(a.url)}
                      </Link>
                      <p className="text-[11.5px] text-ink-500">{prettyHost(a.url)} · #{a.id.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-ink-800">{a.customer}</p>
                      <p className="text-[11.5px] text-ink-500">{a.email}</p>
                    </td>
                    <td className="table-cell"><AuditStatusPill status={a.status} />
                      {a.status === 'failed' && a.error && (
                        <p className="mt-1 max-w-[220px] truncate text-[11px] text-red-600" title={a.error}>{a.error}</p>
                      )}
                    </td>
                    <td className="table-cell text-ink-600">{a.assigned_admin || '—'}</td>
                    <td className="table-cell whitespace-nowrap text-ink-500" title={formatDate(a.requested_at, true)}>{timeAgo(a.requested_at)}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {a.report_id && (
                          <Link to={`/admin/reports/${a.report_id}`} className="btn-quiet px-2.5 py-1.5 text-[12px]">Report</Link>
                        )}
                        {['pending', 'failed', 'cancelled'].includes(a.status) && (
                          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => run(a.id)} disabled={busy === a.id}>
                            {busy === a.id ? 'Queuing…' : a.status === 'failed' ? 'Retry' : 'Run audit'}
                          </button>
                        )}
                        <Link to={`/admin/enquiries/${a.id}`} className="btn-quiet px-2.5 py-1.5 text-[12px]">Open</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-ink-900/10 bg-white p-4 text-[12px] leading-relaxed text-ink-600">
        <ShieldAlert size={15} className="mt-0.5 shrink-0 text-ink-400" />
        <p>Internal notes and assignments are staff-only. They are never included in customer or mobile API responses.</p>
        <Link to="/admin/logs" className="ml-auto inline-flex shrink-0 items-center gap-1.5 font-semibold text-primary-700 hover:underline">
          <Activity size={12} /> Activity log
        </Link>
      </div>
    </div>
  )
}
