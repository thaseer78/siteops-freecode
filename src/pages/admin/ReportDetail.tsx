import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Download, ExternalLink, FileText, Lock, Mail, Monitor, RefreshCw,
  RotateCw, Send, ShieldAlert, Smartphone, StickyNote, Wand2,
} from 'lucide-react'
import { api, downloadFile } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { EmailLog, Finding, Report, StrategyScores } from '../../lib/types'
import { ErrorState, PageHeader, SkeletonRows, Spinner, useToast } from '../../components/ui'
import { categoryLabel, formatDate, prettyHost, scoreTone, severityTone, timeAgo } from '../../lib/format'

interface Enquiry {
  id: string; status: string; url: string; website_name: string; customer: string; email: string
  customer_id: string; requested_at: string; internal_admin_notes: string | null; assigned_admin: string | null
}
interface Payload {
  report: Report & { website_name: string; customer: string; email: string }
  enquiry: Enquiry
  emails: EmailLog[]
  email: { configured: boolean; sandbox: boolean; sender: string; message: string | null }
}

const CATS = [
  ['performance', 'Performance'], ['accessibility', 'Accessibility'],
  ['best_practices', 'Best practices'], ['seo', 'SEO'],
] as const

export default function AdminReportDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { push } = useToast()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const canOperate = ['admin', 'super_admin'].includes(user?.role || '')

  const load = (quiet = false) => {
    if (!quiet) setError(null)
    api.get<Payload>(`/admin/reports/${id}`).then(setData).catch((e) => setError(e.message))
  }
  useEffect(() => { void load() }, [id])

  async function generate() {
    setBusy('pdf')
    try {
      const r = await api.post<{ ok: boolean; bytes: number }>(`/admin/reports/${id}/pdf`)
      push({ kind: 'success', title: 'PDF generated', body: `${Math.round(r.bytes / 1024)} KB, stored outside the public web root.` })
      load(true)
    } catch (e) { push({ kind: 'error', title: 'PDF failed', body: (e as Error).message }) } finally { setBusy(null) }
  }
  async function download() {
    setBusy('download')
    try {
      await downloadFile(`/admin/reports/${id}/pdf`, `SiteOps-${(data?.report.website_name || 'report').replace(/[^a-z0-9]+/gi, '-')}.pdf`)
    } catch (e) { push({ kind: 'error', title: 'Download failed', body: (e as Error).message }) } finally { setBusy(null) }
  }
  async function preview() {
    setBusy('preview')
    // Open the tab during the click so popup blockers allow it.
    const tab = window.open('', '_blank')
    try {
      const res = await fetch(`/api/v1/admin/reports/${id}/pdf`, { credentials: 'include' })
      if (!res.ok) throw new Error('Could not generate the PDF preview.')
      const url = URL.createObjectURL(await res.blob())
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      tab?.close()
      push({ kind: 'error', title: 'Preview failed', body: (e as Error).message })
    } finally { setBusy(null) }
  }

  async function send() {
    setBusy('send')
    try {
      const r = await api.post<{ ok: boolean; message: string; recipient: string }>(`/admin/reports/${id}/send`)
      push({ kind: r.ok ? 'success' : 'error', title: r.ok ? 'Report sent' : 'Report not sent', body: r.message })
      load(true)
    } catch (e) { push({ kind: 'error', title: 'Report not sent', body: (e as Error).message }) } finally { setBusy(null) }
  }
  async function retry(logId: string) {
    setBusy(logId)
    try {
      const r = await api.post<{ ok: boolean; error?: string }>(`/admin/email-logs/${logId}/retry`)
      push({ kind: r.ok ? 'success' : 'error', title: r.ok ? 'Email sent' : 'Retry failed', body: r.ok ? 'Provider accepted the message.' : r.error })
      load(true)
    } catch (e) { push({ kind: 'error', title: 'Retry failed', body: (e as Error).message }) } finally { setBusy(null) }
  }

  if (error) return <><PageHeader title="Report" /><div className="card"><ErrorState message={error} onRetry={() => load()} /></div></>
  if (!data) return <><PageHeader title="Report" subtitle="Loading measurements…" /><div className="card"><SkeletonRows rows={5} /></div></>

  const { report, enquiry, emails, email } = data
  const findings = report.findings || []
  const mobile: Partial<StrategyScores> = report.mobile_scores || {}
  const desktop: Partial<StrategyScores> | null = report.desktop_scores || null
  const recs = report.recommendations || []

  return (
    <div>
      <Link to="/admin/enquiries" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Audit enquiries
      </Link>

      <PageHeader eyebrow={`Report for ${enquiry.website_name}`} title={prettyHost(report.url)}
        subtitle={`${enquiry.customer} · ${enquiry.email} · measured ${formatDate(report.audited_at || report.fetched_at, true)}`}
        actions={<>
          <button className="btn-ghost" onClick={generate} disabled={busy === 'pdf'}>
            {busy === 'pdf' ? <><Spinner size={13} /> Generating…</> : <><Wand2 size={14} /> Generate PDF</>}
          </button>
          <button className="btn-ghost" onClick={download} disabled={busy === 'download'}><Download size={14} /> Download</button>
          <button className="btn-ghost" onClick={() => preview()} disabled={busy === 'preview'}><FileText size={14} /> Preview</button>
        </>} />

      {email.sandbox && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert size={17} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="text-[12.5px] leading-relaxed text-amber-900">
            <p className="font-semibold">Resend sandbox sender in use</p>
            <p className="mt-0.5">{email.message}</p>
            <p className="mt-1 text-amber-800/80">Sender: <code>{email.sender}</code></p>
          </div>
        </div>
      )}
      {!email.configured && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-red-600" />
          <div className="text-[12.5px] leading-relaxed text-red-800">
            <p className="font-semibold">Email is not configured</p>
            <p className="mt-0.5">Set <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code>. Attempts are logged as failed with the reason, never as sent.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.45fr_.55fr]">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-4 border-b border-ink-900/[.07] px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Overall</p>
                <p className="font-display text-[40px] font-semibold leading-none" style={{ color: scoreTone(report.overall).ring }}>{report.overall ?? '—'}</p>
              </div>
              {([
                { label: 'Mobile', val: report.mobile_overall ?? null, Icon: Smartphone },
                { label: 'Desktop', val: report.desktop_overall ?? null, Icon: Monitor },
              ]).map(({ label, val, Icon }) => (
                <div key={label} className="rounded-xl bg-surface2 px-4 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500"><Icon size={11} /> {label}</p>
                  <p className="mt-0.5 text-[22px] font-bold" style={{ color: scoreTone(val).ring }}>{val ?? '—'}</p>
                </div>
              ))}
              {report.executive_summary && (
                <p className="min-w-[220px] flex-1 text-[12px] leading-relaxed text-ink-600">{report.executive_summary}</p>
              )}
            </div>
            <table className="w-full">
              <thead><tr className="border-b border-ink-900/[.07]">
                <th className="table-head">Category</th><th className="table-head">Mobile</th><th className="table-head">Desktop</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-900/[.05]">
                {CATS.map(([key, label]) => (
                  <tr key={key}>
                    <td className="table-cell font-medium text-ink-800">{label}</td>
                    <td className="table-cell"><span className={`chip ${scoreTone(mobile[key]).bg} ${scoreTone(mobile[key]).text}`}>{mobile[key] ?? '—'}</span></td>
                    <td className="table-cell"><span className={`chip ${scoreTone(desktop?.[key]).bg} ${scoreTone(desktop?.[key]).text}`}>{desktop?.[key] ?? '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recs.length > 0 && (
            <div className="card">
              <div className="border-b border-ink-900/[.07] px-5 py-4"><h2 className="text-[14.5px] font-semibold text-ink-900">Priority fixes</h2></div>
              <ol className="divide-y divide-ink-900/[.05]">
                {recs.map((r, i) => (
                  <li key={i} className="px-5 py-3">
                    <p className="text-[13px] font-semibold text-ink-900">{i + 1}. {r.title}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-500">
                      {r.priority || r.impact} {r.strategy ? `· ${r.strategy}` : ''} {categoryLabel[r.category] ? `· ${categoryLabel[r.category]}` : ''}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] text-ink-600">{Array.isArray(r.action_steps) ? r.action_steps.join(' ') : r.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-900/[.07] px-5 py-4">
              <h2 className="text-[14.5px] font-semibold text-ink-900">Structured findings</h2>
              <span className="text-[11.5px] text-ink-500">{findings.length} below 90</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
              <table className="w-full min-w-[600px]">
                <thead className="sticky top-0 bg-white"><tr className="border-b border-ink-900/[.07]">
                  <th className="table-head">Finding</th><th className="table-head">Severity</th>
                  <th className="table-head">Category</th><th className="table-head">Device</th><th className="table-head">Value</th>
                </tr></thead>
                <tbody className="divide-y divide-ink-900/[.05]">
                  {findings.length === 0 && <tr><td className="table-cell text-ink-500" colSpan={5}>Lighthouse reported no failing audits.</td></tr>}
                  {findings.map((f: Finding) => (
                    <tr key={f.id}>
                      <td className="table-cell"><p className="font-medium text-ink-900">{f.title}</p>
                        <p className="line-clamp-1 text-[11px] text-ink-500">{f.description}</p></td>
                      <td className="table-cell"><span className={`chip ${severityTone[f.severity || 'Medium'] || ''}`}>{f.severity || 'Medium'}</span></td>
                      <td className="table-cell text-ink-600">{categoryLabel[f.category] || f.category}</td>
                      <td className="table-cell capitalize text-ink-600">{f.strategy || '—'}</td>
                      <td className="table-cell text-ink-600">{f.display_value || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Manual send */}
          <div className="card card-pad">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-900"><Mail size={15} className="text-ink-500" /> Send report by email</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
              Manual send only — audits never email a report automatically.
            </p>
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-ink-500">Recipient (locked to account)</label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-ink-900/10 bg-ink-900/[.03] px-3 py-2">
              <Lock size={13} className="shrink-0 text-ink-400" />
              <span className="truncate text-[13px] font-medium text-ink-800">{enquiry.email}</span>
            </div>
            <p className="mt-1 text-[11px] text-ink-500">Sourced from the customer record. Not editable here.</p>
            <button className="btn-primary mt-3 w-full" onClick={send} disabled={!canOperate || busy === 'send'}>
              {busy === 'send' ? <><Spinner size={13} /> Sending…</> : <><Send size={14} /> Send report to customer</>}
            </button>
            {!canOperate && <p className="mt-2 text-[11px] text-ink-500">Administrator access required to send.</p>}
          </div>

          {/* Delivery log */}
          <div className="card">
            <div className="flex items-center justify-between border-b border-ink-900/[.07] px-5 py-3.5">
              <h2 className="text-[14px] font-semibold text-ink-900">Delivery log</h2>
              <button className="btn-quiet px-2 py-1" onClick={() => load(true)} aria-label="Refresh"><RefreshCw size={13} /></button>
            </div>
            {emails.length === 0 ? <p className="px-5 py-5 text-[12.5px] text-ink-500">No delivery attempts for this report yet.</p> : (
              <ul className="divide-y divide-ink-900/[.05]">
                {emails.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`chip ${e.status === 'sent' ? 'bg-primary-50 text-primary-700' : e.status === 'queued' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>{e.status}</span>
                      <span className="ml-auto text-[11px] text-ink-500">{timeAgo(e.created_at)}</span>
                    </div>
                    <p className="mt-1 truncate text-[11.5px] text-ink-600">{e.recipient_email || e.to_email}</p>
                    {(e.retry_count ?? 0) > 0 && <p className="text-[11px] text-ink-500">Retries: {e.retry_count}</p>}
                    {e.provider_message_id && <p className="truncate text-[10.5px] text-ink-400">ID {e.provider_message_id}</p>}
                    {e.error_message && <p className="mt-1 break-words text-[11px] text-red-600">{e.error_message}</p>}
                    {e.status !== 'sent' && canOperate && (
                      <button className="btn-quiet mt-2 px-2 py-1 text-[11.5px]" onClick={() => retry(e.id)} disabled={busy === e.id}>
                        {busy === e.id ? <><Spinner size={11} /> Retrying…</> : <><RotateCw size={11} /> Retry failed email</>}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card card-pad">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-900"><StickyNote size={15} className="text-ink-500" /> Internal notes</h2>
            <p className="mt-1 text-[11.5px] text-ink-500">Staff only. Never returned by any customer API response.</p>
            <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-700">{enquiry.internal_admin_notes || 'No internal notes saved on this enquiry.'}</p>
            <Link to={`/admin/enquiries/${enquiry.id}`} className="btn-ghost mt-3 w-full text-[12.5px]">Edit on the enquiry <ExternalLink size={12} /></Link>
            <Link to={`/admin/customers/${enquiry.customer_id}`} className="btn-quiet mt-2 w-full text-[12.5px]">Customer profile</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
