import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, ExternalLink, Mail, Play, Save, ShieldCheck, StickyNote,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { AuditRequest, Report } from '../../lib/types'
import {
  ErrorState, Field, InlineError, PageHeader, SkeletonRows, Spinner, useToast,
} from '../../components/ui'
import { formatDate, prettyHost, scoreTone, timeAgo } from '../../lib/format'
import { AuditStatusPill } from '../customer/Websites'

interface Note { id: string; body: string; author: string; created_at: string }
interface Enquiry extends AuditRequest {
  website_name: string
  customer: string
  email: string
  customer_id: string
  company: string | null
  phone: string | null
  internal_admin_notes: string | null
  assigned_admin: string | null
  report_id?: string | null
}
interface Payload {
  enquiry: Enquiry
  report: Report | null
  raw_report: { id: string } | null
  notes: Note[]
  emails: Array<{ id: string; status: string; recipient_email: string; created_at: string; error_message: string | null }>
}

const STATUSES = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'] as const

export default function AdminEnquiryDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { push } = useToast()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<string>('')
  const [assignee, setAssignee] = useState<string>('')
  const [staff, setStaff] = useState<Array<{ id: string; full_name: string; role: string }>>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const canOperate = ['admin', 'super_admin'].includes(user?.role || '')

  const load = (quiet = false) => {
    if (!quiet) setError(null)
    api.get<Payload>(`/admin/enquiries/${id}`).then((r) => {
      setData(r)
      setStatus(r.enquiry.status === 'running' ? 'in_progress' : r.enquiry.status)
      setNotes(r.enquiry.internal_admin_notes || '')
      setAssignee(r.enquiry.assigned_admin_id || '')
    }).catch((e) => setError(e.message))
  }
  useEffect(() => { void load() }, [id])
  useEffect(() => {
    api.get<{ staff: Array<{ id: string; full_name: string; role: string }> }>('/admin/staff')
      .then((r) => setStaff(r.staff)).catch(() => setStaff([]))
  }, [])
  useEffect(() => {
    if (!data || !['pending', 'in_progress', 'running'].includes(data.enquiry.status)) return
    const t = setInterval(() => load(true), 6000)
    return () => clearInterval(t)
  }, [data])

  async function save() {
    setFormError(null); setBusy('save')
    try {
      await api.patch(`/admin/enquiries/${id}`, {
        status, internal_admin_notes: notes, assigned_admin_id: assignee || null,
      })
      push({ kind: 'success', title: 'Enquiry updated', body: 'Status, assignment and internal notes saved.' })
      load(true)
    } catch (e) { setFormError((e as Error).message) } finally { setBusy(null) }
  }

  async function run() {
    setBusy('run')
    try {
      await api.post(`/admin/enquiries/${id}/run`)
      push({ kind: 'success', title: 'Audit queued', body: 'Measuring mobile and desktop. This page refreshes automatically.' })
      load(true)
    } catch (e) { push({ kind: 'error', title: 'Could not run', body: (e as Error).message }) } finally { setBusy(null) }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (note.trim().length < 2) return setFormError('Write a note first.')
    setBusy('note')
    try {
      await api.post(`/admin/enquiries/${id}/notes`, { body: note.trim() })
      setNote('')
      push({ kind: 'success', title: 'Note added', body: 'Internal only — customers never see notes.' })
      load(true)
    } catch (err) { setFormError((err as Error).message) } finally { setBusy(null) }
  }

  async function emailReport() {
    if (!data?.raw_report) return
    setBusy('send')
    try {
      const r = await api.post<{ ok: boolean; message: string }>(`/admin/reports/${data.raw_report.id}/send`)
      push({ kind: r.ok ? 'success' : 'error', title: r.ok ? 'Report sent' : 'Report not sent', body: r.message })
      load(true)
    } catch (e) { push({ kind: 'error', title: 'Report not sent', body: (e as Error).message }) } finally { setBusy(null) }
  }

  if (error) return <><PageHeader title="Enquiry" /><div className="card"><ErrorState message={error} onRetry={() => load()} /></div></>
  if (!data) return <><PageHeader title="Enquiry" subtitle="Loading…" /><div className="card"><SkeletonRows rows={5} /></div></>

  const { enquiry, report, notes: noteList, emails } = data
  const inFlight = ['pending', 'in_progress', 'running'].includes(enquiry.status)

  return (
    <div>
      <Link to="/admin/enquiries" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Audit enquiries
      </Link>

      <PageHeader eyebrow={`Enquiry #${enquiry.id.slice(0, 8).toUpperCase()}`} title={enquiry.website_name || prettyHost(enquiry.url)}
        subtitle={`${enquiry.url} · ${enquiry.customer} (${enquiry.email}) · requested ${formatDate(enquiry.requested_at, true)}`}
        actions={<>
          {report && <Link to={`/admin/reports/${report.id}`} className="btn-ghost">Open report</Link>}
          {canOperate && !inFlight && (
            <button className="btn-accent" onClick={run} disabled={busy === 'run'}>
              {busy === 'run' ? <><Spinner /> Queuing…</> : <><Play size={14} /> Run live PageSpeed audit</>}
            </button>
          )}
          {inFlight && <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500"><Spinner size={13} /> Measurement in progress…</span>}
        </>} />

      {enquiry.error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-red-600" />
          <div className="text-[12.5px] leading-relaxed text-red-800">
            <p className="font-semibold">Last run failed at the provider</p>
            <p className="mt-0.5 break-words">{enquiry.error}</p>
            <p className="mt-1 text-red-700/80">No scores were produced. Do not report this as a successful audit.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <div className="space-y-4">
          <div className="card">
            <div className="border-b border-ink-900/[.07] px-5 py-4">
              <h2 className="text-[14.5px] font-semibold text-ink-900">Enquiry management</h2>
              <p className="mt-0.5 text-[12px] text-ink-500">Status, assignment and internal notes. Notes are never sent to the customer.</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <InlineError message={formError} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status" htmlFor="status">
                  <select id="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canOperate}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </Field>
                <Field label="Assigned operator" htmlFor="assignee">
                  <select id="assignee" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canOperate}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.role.replace('_', ' ')}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Internal admin notes" htmlFor="internal">
                <textarea id="internal" className="input min-h-[96px] resize-y" maxLength={5000} value={notes}
                  onChange={(e) => setNotes(e.target.value)} disabled={!canOperate}
                  placeholder="Access details, client preferences, blockers. Customers never see this." />
              </Field>
              <button className="btn-primary" onClick={save} disabled={!canOperate || busy === 'save'}>
                {busy === 'save' ? <><Spinner /> Saving…</> : <><Save size={14} /> Save changes</>}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="border-b border-ink-900/[.07] px-5 py-4">
              <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-ink-900">
                <StickyNote size={15} className="text-ink-500" /> Note history
              </h2>
            </div>
            <form onSubmit={addNote} className="border-b border-ink-900/[.06] px-5 py-4">
              <Field label="Add a timestamped note" htmlFor="note">
                <textarea id="note" className="input min-h-[70px] resize-y" maxLength={2000} value={note}
                  onChange={(e) => setNote(e.target.value)} placeholder="Called the customer; hero image needs replacing." />
              </Field>
              <button className="btn-ghost mt-2.5" type="submit" disabled={busy === 'note'}>
                {busy === 'note' ? <><Spinner /> Saving…</> : 'Add note'}
              </button>
            </form>
            {noteList.length === 0 ? <p className="px-5 py-5 text-[12.5px] text-ink-500">No notes yet.</p> : (
              <ul className="divide-y divide-ink-900/[.05]">
                {noteList.map((n) => (
                  <li key={n.id} className="px-5 py-3">
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

          {report && (
            <div className="card">
              <div className="flex flex-wrap items-center gap-4 border-b border-ink-900/[.07] px-5 py-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Overall</p>
                  <p className="font-display text-[32px] font-semibold leading-none" style={{ color: scoreTone(report.overall).ring }}>{report.overall ?? '—'}</p>
                </div>
                <p className="text-[12px] text-ink-500">Mobile {report.mobile_overall ?? '—'} · Desktop {report.desktop_overall ?? '—'}</p>
                <div className="ml-auto flex gap-1.5">
                  <Link to={`/admin/reports/${report.id}`} className="btn-ghost px-2.5 py-1.5 text-[12px]">Report builder</Link>
                  {canOperate && (
                    <button className="btn-primary px-2.5 py-1.5 text-[12px]" onClick={emailReport} disabled={busy === 'send'}>
                      {busy === 'send' ? 'Sending…' : <><Mail size={12} /> Send email</>}
                    </button>
                  )}
                </div>
              </div>
              <ul className="divide-y divide-ink-900/[.05]">
                {emails.length === 0 ? <li className="px-5 py-3 text-[12.5px] text-ink-500">No report email attempts.</li> : emails.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
                    <span className={`chip ${e.status === 'sent' ? 'bg-primary-50 text-primary-700' : e.status === 'queued' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>{e.status}</span>
                    <span className="text-[12px] text-ink-700">{e.recipient_email}</span>
                    <span className="ml-auto text-[11px] text-ink-500">{timeAgo(e.created_at)}</span>
                    {e.error_message && <p className="w-full text-[11px] text-red-600">{e.error_message}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card card-pad">
            <h2 className="text-[14px] font-semibold text-ink-900">Request details</h2>
            <dl className="mt-3 space-y-2.5 text-[12.5px]">
              <div><dt className="text-ink-500">Status</dt><dd className="mt-1"><AuditStatusPill status={enquiry.status} /></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-500">Scope</dt><dd className="font-medium text-ink-800">{enquiry.audit_scope || 'full_site_health'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-500">Devices</dt><dd className="font-medium text-ink-800">Mobile + desktop</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-500">Requested</dt><dd className="text-right font-medium text-ink-800">{formatDate(enquiry.requested_at, true)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-500">Completed</dt><dd className="text-right font-medium text-ink-800">{formatDate(enquiry.completed_at, true)}</dd></div>
              <div className="border-t border-ink-900/[.06] pt-2.5">
                <dt className="text-ink-500">Customer notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink-700">{enquiry.customer_notes || enquiry.customer_note || '—'}</dd>
              </div>
            </dl>
            <Link to={`/admin/customers/${enquiry.customer_id}`} className="btn-ghost mt-4 w-full text-[12.5px]">Customer profile</Link>
            <a href={enquiry.url} target="_blank" rel="noreferrer noopener" className="btn-quiet mt-2 w-full text-[12.5px]">
              Open website <ExternalLink size={12} />
            </a>
          </div>

          <div className="rounded-xl border border-ink-900/10 bg-white p-4 text-[11.5px] leading-relaxed text-ink-600">
            <p className="flex items-center gap-1.5 font-semibold text-ink-800"><ShieldCheck size={13} className="text-primary-600" /> Handling rule</p>
            <p className="mt-1">If the provider fails, the enquiry is marked failed with Google's message. Scores are never invented.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
