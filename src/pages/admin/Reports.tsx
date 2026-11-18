import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Download, Mail, RefreshCw, RotateCw, Search, ShieldCheck } from 'lucide-react'
import { api, downloadFile } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { EmailLog, Report } from '../../lib/types'
import { EmptyState, ErrorState, PageHeader, SkeletonRows, useToast } from '../../components/ui'
import { formatDate, prettyHost, scoreTone, timeAgo } from '../../lib/format'

type AdminReport = Pick<Report, 'id' | 'url' | 'strategy' | 'overall' | 'performance' | 'seo' | 'accessibility' | 'best_practices' | 'fetched_at' | 'website_name' | 'audit_request_id'>

export function AdminReports() {
  const [rows, setRows] = useState<AdminReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const { push } = useToast()

  const load = () => {
    setError(null)
    // Reuse the admin audit list to enumerate completed reports, then hydrate ids.
    api.get<{ audits: Array<{ report_id: string | null; website_name: string; url: string; strategy: string; overall: number | null; completed_at: string | null; id: string }> }>('/admin/audits?status=completed')
      .then((r) => {
        const list = r.audits.filter((a) => a.report_id)
        return Promise.all(list.map((a) => api.get<{ report: Report }>(`/admin/audits/${a.id}`).then((d) => ({
          id: a.report_id!, url: d.report.url, strategy: d.report.strategy, overall: d.report.overall,
          performance: d.report.performance, seo: d.report.seo, accessibility: d.report.accessibility,
          best_practices: d.report.best_practices, fetched_at: d.report.fetched_at, website_name: d.report.website_name || a.website_name,
          audit_request_id: a.id,
        }))))
      })
      .then(setRows).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  async function download(r: AdminReport) {
    setBusy(r.id)
    try { await downloadFile(`/admin/reports/${r.id}/pdf`, `SiteOps-${r.website_name.replace(/[^a-z0-9]+/gi, '-')}.pdf`) }
    catch (e) { push({ kind: 'error', title: 'PDF failed', body: (e as Error).message }) } finally { setBusy(null) }
  }

  const visible = (rows || []).filter((r) => !q.trim() || r.website_name.toLowerCase().includes(q.toLowerCase()) || r.url.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Reports"
        subtitle="All completed reports across customers. Download a PDF or open the request to send it by email."
        actions={<button className="btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>} />
      <div className="mb-4 relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
        <input className="input pl-9" placeholder="Filter by website or URL" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter reports" />
      </div>

      {error && <div className="card"><ErrorState message={error} onRetry={load} /></div>}
      {!error && rows === null && <div className="card"><SkeletonRows rows={5} /></div>}
      {rows && rows.length === 0 && <div className="card"><EmptyState title="No reports yet" body="Reports appear here once an audit completes successfully." /></div>}
      {rows && rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[760px]">
              <thead><tr className="border-b border-ink-900/[.07]">
                <th className="table-head">Website</th><th className="table-head">Measured</th>
                <th className="table-head">Perf</th><th className="table-head">A11y</th><th className="table-head">SEO</th>
                <th className="table-head">Overall</th><th className="table-head text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-900/[.05]">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-[#FBFCFE]">
                    <td className="table-cell"><p className="font-medium text-ink-900">{r.website_name}</p><p className="text-[11.5px] text-ink-500">{prettyHost(r.url)} · {r.strategy}</p></td>
                    <td className="table-cell whitespace-nowrap text-ink-500">{formatDate(r.fetched_at, true)}</td>
                    <td className="table-cell">{r.performance ?? '—'}</td>
                    <td className="table-cell">{r.accessibility ?? '—'}</td>
                    <td className="table-cell">{r.seo ?? '—'}</td>
                    <td className="table-cell"><span className={`chip ${scoreTone(r.overall).bg} ${scoreTone(r.overall).text}`}>{r.overall ?? '—'}</span></td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-quiet px-2 py-1.5" onClick={() => download(r)} disabled={busy === r.id} aria-label="Download PDF"><Download size={14} /></button>
                        <Link to={`/admin/audits/${r.audit_request_id}`} className="btn-ghost px-2.5 py-1.5 text-[12px]">Open</Link>
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

export function AdminEmails() {
  const { user } = useAuth()
  const { push } = useToast()
  const [emails, setEmails] = useState<EmailLog[] | null>(null)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const canSend = ['admin', 'super_admin'].includes(user?.role || '')

  const load = () => {
    setError(null)
    api.get<{ emails: EmailLog[]; configured: boolean }>('/admin/email-logs')
      .then((r) => { setEmails(r.emails); setConfigured(r.configured) }).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  async function retry(id: string) {
    setBusy(id)
    try {
      const r = await api.post<{ ok: boolean; status: string; error?: string }>(`/admin/email-logs/${id}/retry`)
      push({ kind: r.ok ? 'success' : 'error', title: r.ok ? 'Email sent' : 'Retry failed', body: r.ok ? 'Provider accepted the message.' : r.error })
      load()
    } catch (e) { push({ kind: 'error', title: 'Retry failed', body: (e as Error).message }) } finally { setBusy(null) }
  }

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Email delivery"
        subtitle="Every transactional email attempt with the provider response. Failed report emails can be retried."
        actions={<button className="btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>} />

      {!configured && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-700" />
          <div className="text-[12.5px] leading-relaxed text-amber-900">
            <p className="font-semibold">Email provider is not configured</p>
            <p className="mt-0.5">Set <code className="rounded bg-white/70 px-1">RESEND_API_KEY</code> and <code className="rounded bg-white/70 px-1">MAIL_FROM</code> in the server environment. Until then every attempt is logged as <em>not configured</em> — never as delivered.</p>
          </div>
        </div>
      )}
      {error && <div className="card"><ErrorState message={error} onRetry={load} /></div>}
      {!error && emails === null && <div className="card"><SkeletonRows rows={5} /></div>}
      {emails && emails.length === 0 && <div className="card"><EmptyState icon={<Mail size={22} />} title="No emails sent yet" body="Verification, audit and report emails appear here with their delivery status." /></div>}
      {emails && emails.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[860px]">
              <thead><tr className="border-b border-ink-900/[.07]">
                <th className="table-head">Recipient</th><th className="table-head">Type</th>
                <th className="table-head">Subject</th><th className="table-head">Status</th>
                <th className="table-head">When</th><th className="table-head text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-900/[.05]">
                {emails.map((e) => (
                  <tr key={e.id} className="hover:bg-[#FBFCFE]">
                    <td className="table-cell"><p className="font-medium text-ink-900">{e.to_email}</p>{e.customer && <p className="text-[11.5px] text-ink-500">{e.customer}</p>}</td>
                    <td className="table-cell capitalize text-ink-600">{e.kind.replace(/_/g, ' ')}</td>
                    <td className="table-cell max-w-[260px]"><p className="truncate text-ink-700">{e.subject}</p>{e.error && <p className="truncate text-[11px] text-red-600">{e.error}</p>}</td>
                    <td className="table-cell"><span className={`chip ${e.status === 'sent' ? 'bg-mint-50 text-mint-700' : e.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-ink-900/[.05] text-ink-600'}`}>{e.status.replace('_', ' ')}</span></td>
                    <td className="table-cell whitespace-nowrap text-ink-500">{timeAgo(e.created_at)}</td>
                    <td className="table-cell text-right">
                      {e.status !== 'sent' && e.report_id && canSend && (
                        <button className="btn-ghost px-2.5 py-1.5 text-[12px]" disabled={busy === e.id} onClick={() => retry(e.id)}>
                          <RotateCw size={12} /> {busy === e.id ? 'Retrying…' : 'Retry'}
                        </button>
                      )}
                      {e.report_id && <Link to={`/admin/audits`} className="ml-1 text-[12px] font-semibold text-mint-700 hover:underline">Report</Link>}
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

export function AdminActivity() {
  const [rows, setRows] = useState<Array<{ id: string; actor_email: string | null; action: string; entity: string | null; entity_id: string | null; meta: Record<string, unknown>; created_at: string }> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.get<{ activity: typeof rows }>('/admin/activity').then((r) => setRows(r.activity as typeof rows)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Activity log"
        subtitle="Immutable record of authentication, audit and delivery actions across the platform."
        actions={<button className="btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>} />
      {error && <div className="card"><ErrorState message={error} onRetry={load} /></div>}
      {!error && rows === null && <div className="card"><SkeletonRows rows={6} /></div>}
      {rows && rows.length === 0 && <div className="card"><EmptyState icon={<ShieldCheck size={22} />} title="No activity yet" body="Actions will be recorded here as customers and staff use the platform." /></div>}
      {rows && rows.length > 0 && (
        <div className="card divide-y divide-ink-900/[.05]">
          {rows.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
              <span className="chip bg-ink-900/[.05] text-ink-700">{a.action}</span>
              <span className="text-[12px] text-ink-600">{a.actor_email || 'system'}</span>
              {a.entity && <span className="text-[11.5px] text-ink-500">· {a.entity}{a.entity_id ? ` #${a.entity_id.slice(0, 8)}` : ''}</span>}
              {Object.keys(a.meta || {}).length > 0 && <span className="hidden truncate text-[11px] text-ink-500 sm:inline">· {JSON.stringify(a.meta).slice(0, 90)}</span>}
              <span className="ml-auto whitespace-nowrap text-[11px] text-ink-500">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
