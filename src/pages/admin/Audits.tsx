import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Play, RefreshCw, Search } from 'lucide-react'
import { api } from '../../lib/api'
import type { AuditRequest } from '../../lib/types'
import { EmptyState, ErrorState, PageHeader, SkeletonRows, Tabs, useToast } from '../../components/ui'
import { formatDate, prettyHost, timeAgo } from '../../lib/format'
import { AuditStatusPill } from '../customer/Websites'

type Filter = 'all' | 'pending' | 'running' | 'failed' | 'completed'

export default function AdminAudits() {
  const { push } = useToast()
  const [audits, setAudits] = useState<AuditRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = (quiet = false) => {
    if (!quiet) setError(null)
    const query = new URLSearchParams()
    if (filter !== 'all') query.set('status', filter)
    if (q.trim()) query.set('q', q.trim())
    api.get<{ audits: AuditRequest[] }>(`/admin/audits?${query}`)
      .then((r) => setAudits(r.audits)).catch((e) => setError(e.message))
  }
  useEffect(() => { load() }, [filter])

  async function run(id: string) {
    setBusy(id)
    try {
      await api.post(`/admin/audits/${id}/run`)
      push({ kind: 'success', title: 'Audit queued', body: 'PageSpeed Insights is measuring the site now.' })
      load(true)
    } catch (e) { push({ kind: 'error', title: 'Could not queue audit', body: (e as Error).message }) } finally { setBusy(null) }
  }

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Audit queue"
        subtitle="Every customer request with live provider status. Run audits, open reports and deliver PDFs by email."
        actions={<button className="btn-ghost" onClick={() => load()}><RefreshCw size={14} /> Refresh</button>} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={[
          { id: 'all', label: 'All' }, { id: 'pending', label: 'Pending' }, { id: 'running', label: 'Running' },
          { id: 'failed', label: 'Failed' }, { id: 'completed', label: 'Completed' },
        ]} value={filter} onChange={setFilter} />
        <form className="relative" onSubmit={(e) => { e.preventDefault(); load() }}>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input className="input w-full pl-9 sm:w-72" placeholder="Search URL, name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audits" />
        </form>
      </div>

      {error && <div className="card"><ErrorState message={error} onRetry={() => load()} /></div>}
      {!error && audits === null && <div className="card"><SkeletonRows rows={5} /></div>}
      {audits && audits.length === 0 && (
        <div className="card"><EmptyState icon={<Play size={22} />} title="Nothing in this queue"
          body="New customer audit requests appear here immediately. Try a different filter or clear the search." /></div>
      )}

      {audits && audits.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[840px]">
              <thead><tr className="border-b border-ink-900/[.07]">
                <th className="table-head">Website</th><th className="table-head">Customer</th>
                <th className="table-head">Status</th><th className="table-head">Requested</th>
                <th className="table-head">Score</th><th className="table-head text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-900/[.05]">
                {audits.map((a) => (
                  <tr key={a.id} className="hover:bg-[#FBFCFE]">
                    <td className="table-cell">
                      <Link to={`/admin/audits/${a.id}`} className="font-medium text-ink-900 hover:text-mint-700">{a.website_name}</Link>
                      <p className="text-[11.5px] text-ink-500">{prettyHost(a.url)} · <span className="capitalize">{a.strategy}</span> · #{a.id.slice(0, 6).toUpperCase()}</p>
                      {a.error && <p className="mt-1 flex items-start gap-1 text-[11px] text-red-600"><AlertTriangle size={11} className="mt-0.5 shrink-0" /><span className="line-clamp-1">{a.error}</span></p>}
                    </td>
                    <td className="table-cell"><p className="text-ink-800">{a.customer}</p><p className="text-[11.5px] text-ink-500">{a.email}</p></td>
                    <td className="table-cell"><AuditStatusPill status={a.status} /></td>
                    <td className="table-cell whitespace-nowrap text-ink-500">{timeAgo(a.requested_at)}<p className="text-[11px]">{formatDate(a.requested_at)}</p></td>
                    <td className="table-cell">{a.overall != null ? <span className="font-semibold text-ink-900">{a.overall}/100</span> : <span className="text-ink-500">—</span>}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1.5">
                        {a.report_id && <Link to={`/admin/audits/${a.id}`} className="btn-ghost px-2.5 py-1.5 text-[12px]">Report</Link>}
                        {['pending', 'failed'].includes(a.status) && (
                          <button className="btn-primary px-2.5 py-1.5 text-[12px]" disabled={busy === a.id} onClick={() => run(a.id)}>
                            <Play size={12} /> {busy === a.id ? 'Queuing…' : a.status === 'failed' ? 'Retry' : 'Run'}
                          </button>
                        )}
                        <Link to={`/admin/audits/${a.id}`} className="btn-quiet px-2 py-1.5" aria-label="Open audit">Open</Link>
                      </div>
                    </td>
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
