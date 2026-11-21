import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight, Globe2, Loader2, MoreHorizontal, Pencil, Play, Plus, Trash2, Zap,
} from 'lucide-react'
import { api } from '../../lib/api'
import type { AuditStatus, Website } from '../../lib/types'
import {
  EmptyState, ErrorState, Field, InlineError, Modal, PageHeader, SkeletonRows, Spinner,
} from '../../components/ui'
import { formatDate, prettyHost, scoreTone, statusTone, timeAgo } from '../../lib/format'
import { useToast } from '../../components/ui'

export default function WebsitesPage() {
  const [params, setParams] = useSearchParams()
  const { push } = useToast()
  const [sites, setSites] = useState<Website[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Website | null>(null)
  const [deleting, setDeleting] = useState<Website | null>(null)
  const [auditing, setAuditing] = useState<Website | null>(null)
  const [menu, setMenu] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.get<{ websites: Website[] }>('/websites').then((r) => setSites(r.websites)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  async function remove() {
    if (!deleting) return
    try {
      await api.del(`/websites/${deleting.id}`)
      push({ kind: 'success', title: 'Website removed', body: `${deleting.name} and its audit history were deleted.` })
      setDeleting(null)
      load()
    } catch (e) {
      push({ kind: 'error', title: 'Could not delete', body: (e as Error).message })
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Websites" title="Your websites"
        subtitle="Register every site you want SiteOps to watch. Audits use the public URL only — no code access or DNS changes."
        actions={<button className="btn-primary" onClick={() => setParams({ add: '1' })}><Plus size={15} /> Add website</button>} />

      {error && <div className="card"><ErrorState message={error} onRetry={load} /></div>}

      {!error && sites === null && <div className="card"><SkeletonRows rows={3} /></div>}

      {sites && sites.length === 0 && (
        <div className="card">
          <EmptyState icon={<Globe2 size={22} />} title="No websites registered"
            body="Add the URL your business runs on. We'll request a PageSpeed audit and deliver a branded report."
            action={{ label: 'Add your first website', onClick: () => setParams({ add: '1' }) }} />
        </div>
      )}

      {sites && sites.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {sites.map((w) => {
            const tone = scoreTone(w.latest_score)
            const st = w.latest_request_status ? statusTone[w.latest_request_status] : null
            return (
              <div key={w.id} className="card card-pad transition hover:shadow-lift">
                <div className="flex items-start gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[14px] font-bold ${tone.bg} ${tone.text}`}>
                    {w.latest_score ?? '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-semibold text-ink-900">{w.name}</p>
                        <a href={w.url} target="_blank" rel="noreferrer noopener"
                          className="inline-flex max-w-full items-center gap-1 truncate text-[12px] text-ink-500 hover:text-primary-700">
                          {prettyHost(w.url)} <ArrowUpRight size={11} />
                        </a>
                      </div>
                      <div className="relative">
                        <button className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-900/5" aria-label="Website actions" onClick={() => setMenu(menu === w.id ? null : w.id)}>
                          <MoreHorizontal size={16} />
                        </button>
                        {menu === w.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                            <div className="absolute right-0 z-20 mt-1 w-44 animate-rise overflow-hidden rounded-xl border border-ink-900/10 bg-white py-1 shadow-lift">
                              <button onClick={() => { setMenu(null); setEditing(w) }} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12.5px] text-ink-700 hover:bg-ink-900/[.04]"><Pencil size={13} /> Edit website</button>
                              <button onClick={() => { setMenu(null); setAuditing(w) }} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12.5px] text-ink-700 hover:bg-ink-900/[.04]"><Zap size={13} /> Request audit</button>
                              <button onClick={() => { setMenu(null); setDeleting(w) }} className="flex w-full items-center gap-2 border-t border-ink-900/[.06] px-3.5 py-2 text-left text-[12.5px] text-red-600 hover:bg-red-50"><Trash2 size={13} /> Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {st ? <span className={`chip ${st.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span>
                        : <span className="chip bg-ink-900/[.05] text-ink-500">Not audited</span>}
                      <span className="chip bg-ink-900/[.04] text-ink-600">{w.audit_count ?? 0} audits</span>
                      {w.latest_at && <span className="text-[11.5px] text-ink-500">· {timeAgo(w.latest_at)}</span>}
                    </div>
                  </div>
                </div>
                {w.notes && <p className="mt-3 line-clamp-2 rounded-lg bg-surface2 px-3 py-2 text-[12px] leading-relaxed text-ink-500">{w.notes}</p>}
                <div className="mt-3.5 flex items-center gap-2">
                  <button className="btn-primary flex-1 px-3 py-2 text-[12.5px]" onClick={() => setAuditing(w)}><Zap size={13} /> Request audit</button>
                  <Link to={`/dashboard/requests`} className="btn-ghost px-3 py-2 text-[12.5px]">History</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddWebsiteModal open={params.get('add') === '1'} onClose={() => setParams({})} onSaved={load} />
      {editing && <EditWebsiteModal site={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      <AuditModal site={auditing} onClose={() => { setAuditing(null); load() }} onDone={load} />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete this website?"
        description="This permanently removes the website and all its audit requests and reports."
        footer={<><button className="btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
          <button className="btn-danger" onClick={remove}><Trash2 size={14} /> Delete website</button></>}>
        <p className="text-[13.5px] leading-relaxed text-ink-600">
          You’re about to delete <strong className="text-ink-900">{deleting?.name}</strong> ({deleting && prettyHost(deleting.url)}).
          Downloaded PDFs stay on your machine, but report history in SiteOps will be gone. This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}

export function AddWebsiteModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast()
  const [form, setForm] = useState({ name: '', url: '', notes: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setForm({ name: '', url: '', notes: '' }); setError(null) } }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await api.post('/websites', form)
      push({ kind: 'success', title: 'Website added', body: 'You can request an audit right away.' })
      onSaved(); onClose()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a website" description="Only public http(s) URLs can be audited."
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" form="add-site" type="submit" disabled={busy}>{busy ? <><Spinner /> Saving…</> : 'Add website'}</button></>}>
      <form id="add-site" onSubmit={submit} className="space-y-4" noValidate>
        <InlineError message={error} />
        <Field label="Website name" htmlFor="wn" hint="How it appears in reports, e.g. “Kaveri Crafts store”.">
          <input id="wn" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kaveri Crafts" />
        </Field>
        <Field label="Website URL" htmlFor="wu" hint="https://kavericrafts.in — we add https:// if you leave it out.">
          <input id="wu" className="input" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="kavericrafts.in" inputMode="url" />
        </Field>
        <Field label="Internal note" htmlFor="wno" hint="Optional. Not shown in reports.">
          <textarea id="wno" className="input min-h-[76px] resize-y" maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Main storefront, Shopify" />
        </Field>
      </form>
    </Modal>
  )
}

function EditWebsiteModal({ site, onClose, onSaved }: { site: Website; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast()
  const [form, setForm] = useState({ name: site.name, url: site.url, notes: site.notes || '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      await api.patch(`/websites/${site.id}`, form)
      push({ kind: 'success', title: 'Website updated' })
      onSaved()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Edit website" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" type="submit" form="edit-site" disabled={busy}>{busy ? <><Spinner /> Saving…</> : 'Save changes'}</button></>}>
      <form id="edit-site" onSubmit={submit} className="space-y-4" noValidate>
        <InlineError message={error} />
        <Field label="Website name" htmlFor="en"><input id="en" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Website URL" htmlFor="eu"><input id="eu" className="input" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
        <Field label="Internal note" htmlFor="eno"><textarea id="eno" className="input min-h-[76px] resize-y" maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <p className="text-[11.5px] text-ink-500">Changing the URL affects future audits only. Past reports keep their original measurements.</p>
      </form>
    </Modal>
  )
}

export function AuditModal({ site, onClose, onDone }: { site: Website | null; onClose: () => void; onDone: () => void }) {
  const { push } = useToast()
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ status: AuditStatus; id: string } | null>(null)

  useEffect(() => { if (site) { setStrategy('mobile'); setNote(''); setError(null); setResult(null) } }, [site])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      const r = await api.post<{ audit_request_id: string; status: AuditStatus }>(`/websites/${site!.id}/audits`, { strategy, note })
      setResult({ status: r.status, id: r.audit_request_id })
      push({ kind: 'success', title: 'Audit requested', body: 'We’re measuring your site now. This can take up to a minute.' })
      onDone()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open={!!site} onClose={onClose} title={result ? 'Audit queued' : 'Request an audit'}
      description={site ? `${site.name} · ${prettyHost(site.url)}` : ''}
      footer={result
        ? <><button className="btn-ghost" onClick={onClose}>Close</button><Link to="/dashboard/requests" className="btn-primary">View progress</Link></>
        : <><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" type="submit" form="audit-form" disabled={busy}>{busy ? <><Spinner /> Requesting…</> : <>Run audit <Play size={14} /></>}</button></>}>
      {result ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4">
            <Zap size={17} className="mt-0.5 shrink-0 text-primary-700" />
            <div className="text-[13px] leading-relaxed text-primary-900">
              <p className="font-semibold">Measurement in progress</p>
              <p className="mt-1">Google PageSpeed Insights is auditing the page. Most runs finish in 20–60 seconds. If the site is unreachable or the API quota is exhausted, the request is marked failed with the provider’s exact message — no scores are invented.</p>
            </div>
          </div>
          <p className="text-[11.5px] text-ink-500">Request reference: {result.id.slice(0, 8).toUpperCase()}</p>
        </div>
      ) : (
        <form id="audit-form" onSubmit={submit} className="space-y-4">
          <InlineError message={error} />
          <div>
            <p className="label">Device strategy</p>
            <div className="grid grid-cols-2 gap-2.5">
              {(['mobile', 'desktop'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStrategy(s)}
                  className={`rounded-xl border p-3 text-left transition ${strategy === s ? 'border-primary-500 bg-primary-50/50 ring-4 ring-primary-500/10' : 'border-ink-900/10 hover:border-ink-900/20'}`}>
                  <p className="text-[13px] font-semibold capitalize text-ink-900">{s}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
                    {s === 'mobile' ? 'Moves most Indian traffic. Slower, stricter.' : 'Desktop Lighthouse profile.'}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <Field label="What should we look at?" htmlFor="an" hint="Optional context for our operators.">
            <textarea id="an" className="input min-h-[76px] resize-y" maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Homepage loads slowly on mobile after the redesign." />
          </Field>
          <p className="text-[11.5px] leading-relaxed text-ink-500">
            The audit measures performance, SEO, accessibility and best practices. It is not a security scan.
          </p>
        </form>
      )}
    </Modal>
  )
}

export function AuditStatusPill({ status }: { status: AuditStatus | 'in_progress' }) {
  // `running` is the pre-upgrade name for what the API now reports as in_progress.
  const key = status === 'running' ? 'in_progress' : status
  const st = statusTone[key] || statusTone.pending
  return (
    <span className={`chip ${st.chip}`}>
      {key === 'in_progress' && <Loader2 size={11} className="animate-spin" />}
      {key !== 'in_progress' && <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />}
      {st.label}
    </span>
  )
}

export { formatDate }
