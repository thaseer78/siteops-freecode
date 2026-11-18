import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Download, ExternalLink, Mail, MessageSquare, Play, Send, Smartphone, Monitor, StickyNote,
} from 'lucide-react'
import { api, downloadFile } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { AuditRequest, EmailLog, Report } from '../../lib/types'
import {
  ErrorState, Field, InlineError, PageHeader, ScorePill, ScoreRing, SkeletonRows, Spinner, useToast,
} from '../../components/ui'
import { categoryLabel, formatDate, prettyHost, scoreTone, timeAgo } from '../../lib/format'
import { AuditStatusPill } from '../customer/Websites'

interface Note { id: string; body: string; author: string; created_at: string }
interface Payload {
  audit: AuditRequest & { website_name: string; customer: string; email: string; customer_id: string; error: string | null }
  report: Report | null
  notes: Note[]
  emails: EmailLog[]
}

const rank: Record<string, number> = { support: 1, admin: 2, super_admin: 3 }

export default function AdminAuditDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { push } = useToast()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const canOperate = (rank[user?.role || ''] || 0) >= 2

  const load = (quiet = false) => {
    if (!quiet) setError(null)
    api.get<Payload>(`/admin/audits/${id}`).then(setData).catch((e) => setError(e.message))
  }
  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (!data || !['pending', 'running'].includes(data.audit.status)) return
    const t = setInterval(() => load(true), 6000)
    return () => clearInterval(t)
  }, [data])

  async function runAudit() {
    setBusy('run')
    try {
      await api.post(`/admin/audits/${id}/run`)
      push({ kind: 'success', title: 'Audit queued', body: 'Measurement has started. This page refreshes automatically.' })
      load(true)
    } catch (e) { push({ kind: 'error', title: 'Could not run', body: (e as Error).message }) } finally { setBusy(null) }
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault()
    setNoteError(null)
    if (note.trim().length < 2) return setNoteError('Write a note first.')
    setBusy('note')
    try {
      await api.post(`/admin/audits/${id}/notes`, { body: note.trim() })
      setNote('')
      push({ kind: 'success', title: 'Note added', body: 'Internal only — customers never see notes.' })
      load(true)
    } catch (e) { setNoteError((e as Error).message) } finally { setBusy(null) }
  }

  async function download() {
    if (!data?.report) return
    setBusy('pdf')
    try {
      await downloadFile(`/admin/reports/${data.report.id}/pdf`, `SiteOps-${data.audit.website_name.replace(/[^a-z0-9]+/gi, '-')}.pdf`)
    } catch (e) { push({ kind: 'error', title: 'PDF failed', body: (e as Error).message }) } finally { setBusy(null) }
  }

  async function sendReport() {
    if (!data?.report) return
    setBusy('send')
    try {
      const r = await api.post<{ ok: boolean; status: string; message: string }>(`/admin/reports/${data.report.id}/send`)
      push({ kind: r.ok ? 'success' : 'error', title: r.ok ? 'Report sent' : 'Report not sent', body: r.message })
      load(true)
    } catch (e) { push({ kind: 'error', title: 'Report not sent', body: (e as Error).message }) } finally { setBusy(null) }
  }

  async function setStatus(status: 'pending' | 'cancelled') {
    setBusy('status')
    try {
      await api.patch(`/admin/audits/${id}/status`, { status })
      push({ kind: 'success', title: `Request marked ${status}` })
      load()
    } catch (e) { push({ kind: 'error', title: 'Could not update', body: (e as Error).message }) } finally { setBusy(null) }
  }

  if (error) return <><PageHeader title="Audit request" /><div className="card"><ErrorState message={error} onRetry={() => load()} /></div></>
  if (!data) return <><PageHeader title="Audit request" subtitle="Loading request…" /><div className="card"><SkeletonRows rows={5} /></div></>

  const { audit, report, notes, emails } = data

  return (
    <div>
      <Link to="/admin/audits" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Audit queue
      </Link>

      <PageHeader eyebrow={`Request #${audit.id.slice(0, 8).toUpperCase()}`} title={audit.website_name}
        subtitle={`${audit.url} · requested ${formatDate(audit.requested_at, true)} by ${audit.customer} (${audit.email})`}
        actions={
          <>
            {report && <button className="btn-ghost" onClick={download} disabled={busy === 'pdf'}><Download size={14} /> {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>}
            {report && canOperate && (
              <button className="btn-primary" onClick={sendReport} disabled={busy === 'send'}>
                {busy === 'send' ? <><Spinner /> Sending…</> : <><Mail size={14} /> Send report by email</>}
              </button>
            )}
            {canOperate && ['pending', 'failed'].includes(audit.status) && (
              <button className="btn-accent" onClick={runAudit} disabled={busy === 'run'}><Play size={14} /> {audit.status === 'failed' ? 'Retry audit' : 'Run audit'}</button>
            )}
          </>
        } />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <div className="space-y-4">
          {audit.error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-red-600" />
              <div className="text-[12.5px] leading-relaxed text-red-800">
                <p className="font-semibold">Last run failed at the provider</p>
                <p className="mt-0.5 break-words">{audit.error}</p>
                <p className="mt-1 text-red-700/80">No scores were produced. Do not report this as a successful audit.</p>
              </div>
            </div>
          )}

          {report ? (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-5 border-b border-ink-900/[.07] px-5 py-5">
                <ScoreRing score={report.overall} size={92} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-ink-500">
                    {report.strategy === 'mobile' ? <Smartphone size={12} /> : <Monitor size={12} />} {report.strategy} result
                  </p>
                  <p className="mt-1 truncate text-[13.5px] font-semibold text-ink-900">{report.url}</p>
                  <p className="text-[11.5px] text-ink-500">Measured {formatDate(report.fetched_at, true)} · Lighthouse {report.lighthouse_version || 'n/a'}</p>
                </div>
                <Link to={`/app/reports/${report.id}`} className="btn-quiet px-2.5 py-1.5 text-[12px]">Customer view <ExternalLink size={12} /></Link>
              </div>
              <div className="grid gap-2.5 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
                <ScorePill score={report.performance} label="Performance" />
                <ScorePill score={report.accessibility} label="Accessibility" />
                <ScorePill score={report.best_practices} label="Best practices" />
                <ScorePill score={report.seo} label="SEO" />
              </div>
              <div className="border-t border-ink-900/[.07]">
                {Object.keys(report.metrics).length > 0 && (
                  <div className="grid gap-2 px-5 py-4 sm:grid-cols-3">
                    {Object.entries(report.metrics).slice(0, 6).map(([k, m]) => (
                      <div key={k} className="rounded-lg bg-[#FBFCFE] px-3 py-2">
                        <p className="text-[10.5px] text-ink-500">{m.label || k}</p>
                        <p className="text-[13px] font-semibold text-ink-900">{m.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-ink-900/[.06] px-5 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Top findings ({report.findings.length})</p>
                  <ul className="mt-2 space-y-1.5">
                    {report.findings.slice(0, 6).map((f) => (
                      <li key={f.id} className="flex items-start justify-between gap-3 text-[12.5px]">
                        <span className="min-w-0"><span className="font-medium text-ink-900">{f.title}</span>
                          <span className="ml-1.5 text-[10.5px] uppercase tracking-wide text-ink-500">{categoryLabel[f.category] || f.category}</span></span>
                        <span className="shrink-0 text-[11.5px] text-ink-500">{f.displayValue || '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-6">
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-ink-900/15 bg-[#FBFCFE] p-4">
                <Play size={16} className="mt-0.5 shrink-0 text-ink-500" />
                <div className="text-[12.5px] leading-relaxed text-ink-600">
                  <p className="font-semibold text-ink-900">No report yet</p>
                  <p className="mt-0.5">
                    {audit.status === 'running' ? 'A measurement is in progress. This page refreshes automatically.'
                      : audit.status === 'completed' ? 'This request is marked completed but no report row exists — investigate before delivering anything.'
                        : 'Run the audit to generate real PageSpeed Insights measurements. Nothing is fabricated if the provider fails.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Email delivery history for this request */}
          <div className="card">
            <div className="border-b border-ink-900/[.07] px-5 py-4">
              <h2 className="text-[14.5px] font-semibold text-ink-900">Email delivery</h2>
              <p className="mt-0.5 text-[12px] text-ink-500">Report emails must be sent manually. Status below is the provider's response.</p>
            </div>
            {emails.length === 0 ? (
              <p className="px-5 py-6 text-[12.5px] text-ink-500">No report email has been sent for this customer yet.</p>
            ) : (
              <ul className="divide-y divide-ink-900/[.05]">
                {emails.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                    <span className={`chip ${e.status === 'sent' ? 'bg-mint-50 text-mint-700' : e.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-ink-900/[.05] text-ink-600'}`}>{e.status.replace('_', ' ')}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-800">{e.subject}</span>
                    <span className="text-[11.5px] text-ink-500">{e.to_email} · {timeAgo(e.created_at)}</span>
                    {e.error && <p className="w-full text-[11px] text-red-600">{e.error}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Notes */}
          <div className="card">
            <div className="border-b border-ink-900/[.07] px-5 py-4">
              <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-ink-900"><StickyNote size={15} className="text-ink-500" /> Internal notes</h2>
              <p className="mt-0.5 text-[12px] text-ink-500">Visible to SiteOps staff only. Never exposed to customers or the mobile app.</p>
            </div>
            <form onSubmit={saveNote} className="border-b border-ink-900/[.06] px-5 py-4">
              <InlineError message={noteError} />
              <Field label="Add a note" htmlFor="note">
                <textarea id="note" className="input min-h-[74px] resize-y" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Checked image weight; customer needs Shopify access for the hero fix." />
              </Field>
              <button className="btn-ghost mt-2.5" type="submit" disabled={busy === 'note'}>
                {busy === 'note' ? <><Spinner /> Saving…</> : <><MessageSquare size={14} /> Add note</>}
              </button>
            </form>
            {notes.length === 0 ? <p className="px-5 py-5 text-[12.5px] text-ink-500">No internal notes yet.</p> : (
              <ul className="divide-y divide-ink-900/[.05]">
                {notes.map((n) => (
                  <li key={n.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-ink-900">{n.author || 'Staff'}</p>
                      <p className="text-[11px] text-ink-500">{timeAgo(n.created_at)}</p>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-600">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card card-pad">
            <h2 className="text-[14px] font-semibold text-ink-900">Request details</h2>
            <dl className="mt-3 space-y-2.5 text-[12.5px]">
              <div><dt className="text-ink-500">Status</dt><dd className="mt-1"><AuditStatusPill status={audit.status} /></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-500">Strategy</dt><dd className="font-medium capitalize text-ink-800">{audit.strategy}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-500">Priority</dt><dd className="font-medium capitalize text-ink-800">{audit.priority}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-500">Requested</dt><dd className="text-right font-medium text-ink-800">{formatDate(audit.requested_at, true)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-500">Started</dt><dd className="text-right font-medium text-ink-800">{formatDate(audit.started_at, true)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-500">Completed</dt><dd className="text-right font-medium text-ink-800">{formatDate(audit.completed_at, true)}</dd></div>
              <div className="border-t border-ink-900/[.06] pt-2.5"><dt className="text-ink-500">Customer note</dt><dd className="mt-1 whitespace-pre-wrap text-ink-700">{audit.customer_note || '—'}</dd></div>
            </dl>
            <Link to={`/admin/customers/${audit.customer_id}`} className="btn-ghost mt-4 w-full text-[12.5px]">Customer profile</Link>
          </div>

          <div className="card card-pad">
            <h2 className="text-[14px] font-semibold text-ink-900">Operator actions</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
              {canOperate ? 'Support staff can read and annotate. Running audits and sending email requires administrator access.' : 'You have read and annotate access as support staff.'}
            </p>
            <div className="mt-3 space-y-2">
              <a href={audit.url} target="_blank" rel="noreferrer noopener" className="btn-ghost w-full text-[12.5px]">Open the website <ExternalLink size={13} /></a>
              {canOperate && !['cancelled'].includes(audit.status) && (
                <button className="btn-quiet w-full text-[12.5px] text-red-600 hover:bg-red-50" onClick={() => setStatus('cancelled')} disabled={busy === 'status'}>
                  Cancel request
                </button>
              )}
              {canOperate && audit.status === 'cancelled' && (
                <button className="btn-ghost w-full text-[12.5px]" onClick={() => setStatus('pending')} disabled={busy === 'status'}>Re-open request</button>
              )}
            </div>
          </div>

          <div className="card card-pad bg-[#FBFCFE]">
            <p className="text-[12px] font-semibold text-ink-900">Score legend</p>
            <div className="mt-2 space-y-1.5 text-[11.5px]">
              {[{ l: '90–100 excellent', s: 95 }, { l: '70–89 good', s: 78 }, { l: '50–69 needs work', s: 58 }, { l: '0–49 poor', s: 32 }].map((r) => (
                <p key={r.l} className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full`} style={{ background: scoreTone(r.s).ring }} /><span className="text-ink-600">{r.l}</span></p>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">{prettyHost(audit.url)} · measurements from Google Lighthouse</p>
          </div>
        </div>
      </div>
      <div className="sr-only"><Send size={12} /></div>
    </div>
  )
}
