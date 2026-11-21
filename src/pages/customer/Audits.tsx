import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ListChecks, RefreshCw, Play } from 'lucide-react'
import { api } from '../../lib/api'
import type { AuditRequest } from '../../lib/types'
import { EmptyState, ErrorState, PageHeader, SkeletonRows, Spinner, Tabs, useToast } from '../../components/ui'
import { formatDate, prettyHost, scoreTone, timeAgo } from '../../lib/format'
import { AuditStatusPill } from './Websites'

type Filter = 'all' | 'pending' | 'completed' | 'failed'

export default function AuditsPage() {
  const { push } = useToast()
  const [audits, setAudits] = useState<AuditRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [running, setRunning] = useState<string | null>(null)

  const load = (quiet = false) => {
    if (!quiet) setError(null)
    api.get<{ audits: AuditRequest[] }>('/audits').then((r) => setAudits(r.audits)).catch((e) => setError(e.message))
  }
  useEffect(() => { load() }, [])
  // Poll while anything is in flight so status changes appear without a reload.
  useEffect(() => {
    if (!audits?.some((a) => a.status === 'pending' || a.status === 'running')) return
    const t = setInterval(() => load(true), 5000)
    return () => clearInterval(t)
  }, [audits])

  async function retry(id: string) {
    setRunning(id)
    try {
      await api.post(`/audits/${id}/run`)
      push({ kind: 'success', title: 'Audit re-run complete', body: 'Open the request to see the result.' })
      load()
    } catch (e) {
      push({ kind: 'error', title: 'Audit still failing', body: (e as Error).message })
      load()
    } finally {
      setRunning(null)
    }
  }

  const counts = {
    all: audits?.length ?? 0,
    pending: audits?.filter((a) => a.status === 'pending' || a.status === 'running').length ?? 0,
    completed: audits?.filter((a) => a.status === 'completed').length ?? 0,
    failed: audits?.filter((a) => a.status === 'failed').length ?? 0,
  }
  const visible = (audits || []).filter((a) =>
    filter === 'all' ? true : filter === 'pending' ? ['pending', 'running'].includes(a.status) : a.status === filter)

  return (
    <div>
      <PageHeader eyebrow="Audits" title="Audit requests"
        subtitle="Every request, its live status and the provider response. Audits measure performance, SEO, accessibility and best practices."
        actions={<button className="btn-ghost" onClick={() => load()}><RefreshCw size={14} /> Refresh</button>} />

      <div className="mb-4"><Tabs tabs={[
        { id: 'all', label: 'All', count: counts.all },
        { id: 'pending', label: 'In progress', count: counts.pending },
        { id: 'completed', label: 'Completed', count: counts.completed },
        { id: 'failed', label: 'Failed', count: counts.failed },
      ]} value={filter} onChange={setFilter} /></div>

      {error && <div className="card"><ErrorState message={error} onRetry={() => load()} /></div>}
      {!error && audits === null && <div className="card"><SkeletonRows rows={4} /></div>}

      {audits && audits.length === 0 && (
        <div className="card"><EmptyState icon={<ListChecks size={22} />} title="No audits yet"
          body="Request an audit from any registered website. Results arrive here and in Reports."
          action={{ label: 'Go to websites', to: '/dashboard/websites' }} /></div>
      )}

      {audits && audits.length > 0 && (
        <div className="card overflow-hidden">
          {visible.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-ink-500">No audits in this category.</p>
          ) : (
            <ul className="divide-y divide-ink-900/[.06]">
              {visible.map((a) => (
                <li key={a.id} className="px-4 py-4 transition hover:bg-surface2 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-semibold text-ink-900">{a.website_name}</p>
                        <AuditStatusPill status={a.status} />
                        <span className="chip bg-ink-900/[.04] text-ink-600 capitalize">{a.strategy}</span>
                        {a.overall != null && (
                          <span className={`chip ${scoreTone(a.overall).bg} ${scoreTone(a.overall).text}`}>{a.overall}/100</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[12px] text-ink-500">
                        {prettyHost(a.url)} · requested {timeAgo(a.requested_at)}
                        {a.completed_at ? ` · completed ${formatDate(a.completed_at)}` : ''}
                        <span className="ml-1.5 text-ink-400">#{a.id.slice(0, 8).toUpperCase()}</span>
                      </p>
                      {a.customer_note && <p className="mt-1.5 truncate rounded-md bg-ink-900/[.03] px-2 py-1 text-[11.5px] text-ink-500">“{a.customer_note}”</p>}
                      {a.status === 'failed' && a.error && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11.5px] leading-relaxed text-red-800">
                          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                          <span><strong>Provider response:</strong> {a.error}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.report_id && <Link to={`/dashboard/reports/${a.report_id}`} className="btn-primary px-3 py-2 text-[12.5px]">View report <ArrowRight size={13} /></Link>}
                      {a.status === 'failed' && (
                        <button className="btn-ghost px-3 py-2 text-[12.5px]" disabled={running === a.id} onClick={() => retry(a.id)}>
                          {running === a.id ? <><Spinner size={13} /> Running…</> : <><Play size={13} /> Retry</>}
                        </button>
                      )}
                      {(a.status === 'pending' || a.status === 'running') && (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500"><Spinner size={13} /> measuring…</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
