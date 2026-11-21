import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, Download, ExternalLink, Info, Lightbulb, Share2, Smartphone, Monitor, Sparkles,
} from 'lucide-react'
import { api, downloadFile } from '../../lib/api'
import type { Report } from '../../lib/types'
import { ErrorState, PageHeader, SkeletonRows, useToast } from '../../components/ui'
import { categoryLabel, formatDate, prettyHost, scoreTone, severityDot } from '../../lib/format'

interface Payload {
  report: Report
  website: { id: string; name: string; url: string }
  history: Array<{ id: string; overall: number | null; performance: number | null; seo: number | null; accessibility: number | null; best_practices: number | null; fetched_at: string }>
  request: { id: string; requested_at: string; completed_at: string | null; strategy: string } | null
}

const cats: Array<{ key: keyof Pick<Report, 'performance' | 'accessibility' | 'best_practices' | 'seo'>; label: string }> = [
  { key: 'performance', label: 'Performance' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'seo', label: 'SEO' },
  { key: 'best_practices', label: 'Best Practices' },
]

const severityOf = (score: number | null | undefined) => {
  if (score == null) return 'Medium'
  if (score < 0.5) return 'Critical'
  if (score < 0.7) return 'High'
  return 'Medium'
}

export default function ReportDetailPage() {
  const { id } = useParams()
  const { push } = useToast()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setData(null); setError(null)
    api.get<Payload>(`/reports/${id}`).then(setData).catch((e) => setError(e.message))
  }, [id])

  async function download() {
    if (!data) return
    setBusy(true)
    try {
      await downloadFile(`/reports/${data.report.id}/pdf`, `SiteOps-${data.website.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`)
    } catch (e) { push({ kind: 'error', title: 'Download failed', body: (e as Error).message }) } finally { setBusy(false) }
  }

  async function share() {
    if (!data) return
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: `SiteOps report — ${data.website.name}`, url }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard?.writeText(url)
      push({ kind: 'success', title: 'Link copied', body: 'Share this report link with your team.' })
    }
  }

  if (error) return <><PageHeader title="Report" /><div className="card"><ErrorState message={error} /></div></>
  if (!data) return <><PageHeader title="Report" subtitle="Loading measurements…" /><div className="card"><SkeletonRows rows={5} /></div></>

  const { report, website, history, request } = data
  const prev = history.length > 1 ? history[history.length - 2] : null
  const groups = new Map<string, typeof report.findings>()
  for (const f of report.findings) groups.set(f.category, [...(groups.get(f.category) || []), f])
  const overallTone = scoreTone(report.overall)

  return (
    <div className="animate-rise">
      <Link to="/dashboard/reports" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#A1A1AA] transition hover:text-white">
        <ArrowLeft size={14} /> All reports
      </Link>

      {/* White report container on the obsidian page */}
      <div data-theme="light" className="relative overflow-hidden rounded-2xl border border-[#EAE8F2] bg-white shadow-[0_30px_80px_-50px_rgba(0,0,0,.9)]">
        <span className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#F3E8FF] blur-2xl" />

        {/* Header */}
        <div className="relative flex flex-wrap items-start justify-between gap-5 border-b border-[#EAE8F2] px-5 py-6 sm:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-primary-600">
                <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden>
                  <path d="M7 22c0-5 3.6-7.4 9-7.4s9 2.4 9 7.4" stroke="#FFF" strokeWidth="3.1" fill="none" strokeLinecap="round" />
                  <circle cx="16" cy="9.4" r="2.4" fill="#FFF" />
                </svg>
              </span>
              <span className="font-display text-[15px] font-bold tracking-[-.02em] text-[#111827]">SiteOps</span>
              <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-[#A1A1AA]">Website Health Report</span>
            </div>
            <h1 className="mt-3 truncate font-display text-[24px] font-bold tracking-[-.025em] text-[#111827] sm:text-[28px]">{website.name}</h1>
            <a href={website.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#52525B] hover:text-primary-700">
              {website.url} <ExternalLink size={12} />
            </a>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-[#71717A]">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#EAE8F2] bg-[#FAFAFC] px-2.5 py-1 capitalize">
                {report.strategy === 'mobile' ? <Smartphone size={11} /> : report.strategy === 'desktop' ? <Monitor size={11} /> : <><Smartphone size={11} /><Monitor size={11} /></>} {report.strategy}
              </span>
              <span>Audit date {formatDate(report.fetched_at, true)}</span>
              {report.lighthouse_version && <span>· Lighthouse {report.lighthouse_version}</span>}
            </div>
          </div>

          {/* Emerald gauge */}
          <div className="flex items-center gap-4">
            <div className="relative grid h-[104px] w-[104px] place-items-center rounded-full"
              style={{ background: `conic-gradient(${overallTone.ring} 0 ${report.overall ?? 0}%, #F1F0F6 ${report.overall ?? 0}% 100%)` }}>
              <div className="grid h-[82px] w-[82px] place-items-center rounded-full bg-white">
                <div className="text-center">
                  <span className="block font-display text-[26px] font-bold leading-none tabular-nums text-[#111827]">{report.overall ?? '—'}</span>
                  <span className="mt-0.5 block text-[8.5px] font-semibold uppercase tracking-[.09em] text-[#A1A1AA]">Overall</span>
                </div>
              </div>
            </div>
            <div>
              <span className="chip" style={{ background: overallTone.bg, color: overallTone.text }}>{overallTone.label}</span>
              <p className="mt-2 text-[11.5px] leading-relaxed text-[#71717A]">
                Mobile {report.mobile_overall ?? '—'} · Desktop {report.desktop_overall ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="relative grid gap-3 border-b border-[#EAE8F2] px-5 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
          {cats.map((c) => {
            const value = report[c.key]
            const before = prev?.[c.key]
            const delta = value != null && before != null ? value - before : null
            const tone = scoreTone(value)
            return (
              <div key={c.key} className="rounded-xl border border-[#EAE8F2] bg-white p-3.5 shadow-[0_4px_20px_rgba(17,12,34,.03)]">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-[#52525B]">{c.label}</p>
                  <span className={`chip ${tone.bg} ${tone.text}`}>{value ?? '—'}</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#F1F0F6]">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value ?? 0}%`, background: tone.ring }} />
                </div>
                <p className="mt-2 text-[11px] text-[#71717A]">
                  {tone.label}{delta != null && <span className={delta >= 0 ? ' text-[#059669]' : ' text-[#DC2626]'}> · {delta > 0 ? '+' : ''}{delta} vs previous</span>}
                </p>
              </div>
            )
          })}
        </div>

        {/* Executive summary */}
        <div className="relative border-b border-[#EAE8F2] px-5 py-5 sm:px-7">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#111827]"><Sparkles size={15} className="text-[#7C3AED]" /> Executive summary</h2>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-[#52525B]">
            {report.executive_summary
              || `${website.name} scored ${report.overall ?? '—'}/100 overall across ${report.strategy === 'both' ? 'mobile and desktop' : report.strategy}. ${report.findings.length} Lighthouse audits were flagged below 90. Scores come from Google Lighthouse via PageSpeed Insights for this URL.`}
          </p>
        </div>

        {/* Findings + recommendations */}
        <div className="relative grid gap-5 px-5 py-5 sm:px-7 lg:grid-cols-[1.4fr_.6fr]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Key findings</h2>
            <p className="mt-0.5 text-[12px] text-[#71717A]">{report.findings.length} Lighthouse audits scored below 90</p>
            {report.findings.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-[12.5px] text-[#059669]">
                Nothing was flagged in this run.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-[#F1F0F6]">
                {[...groups.entries()].map(([cat, items]) => (
                  <div key={cat} className="py-3 first:pt-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-[.09em] text-[#A1A1AA]">{categoryLabel[cat] || cat}</p>
                    <ul className="mt-1.5 space-y-2.5">
                      {items.slice(0, 8).map((f) => {
                        const sev = severityOf(f.score)
                        return (
                          <li key={f.id} className="flex items-start gap-2.5">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: severityDot[sev] }} title={sev} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium leading-snug text-[#111827]">{f.title.replace(/\[|\]/g, '')}</p>
                              {f.description && <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-[#71717A]">{f.description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</p>}
                            </div>
                            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: `${severityDot[sev]}18`, color: severityDot[sev] }}>
                              {sev}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[#EAE8F2] bg-[#FAFAFC] p-4">
              <div className="flex items-center gap-2">
                <Lightbulb size={15} className="text-[#D97706]" />
                <h3 className="text-[13px] font-semibold text-[#111827]">Fix these first</h3>
              </div>
              {report.recommendations.length === 0 ? (
                <p className="mt-2 text-[12px] leading-relaxed text-[#71717A]">Lighthouse flagged no failed audits for this run.</p>
              ) : (
                <ol className="mt-2.5 space-y-2.5">
                  {report.recommendations.slice(0, 4).map((r, i) => (
                    <li key={r.title + i} className="flex gap-2.5">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-600 text-[10px] font-bold text-white">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium leading-snug text-[#111827]">{r.title.replace(/\[|\]/g, '')}</p>
                        {r.impact && <p className="mt-0.5 text-[11px] font-semibold text-primary-700">{r.impact}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-xl border border-[#EAE8F2] p-4">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-[#7C3AED]" />
                <h3 className="text-[12.5px] font-semibold text-[#111827]">What this covers</h3>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#71717A]">
                Scores come from Google Lighthouse via PageSpeed Insights for this URL and device strategy. A single
                run varies with network conditions. Not a penetration test, uptime monitor or vulnerability scan.
              </p>
            </div>

            {request && (
              <div className="rounded-xl border border-[#EAE8F2] p-4">
                <h3 className="text-[12.5px] font-semibold text-[#111827]">Request</h3>
                <dl className="mt-2 space-y-1.5 text-[11.5px]">
                  <div className="flex justify-between gap-3"><dt className="text-[#71717A]">Reference</dt><dd className="font-medium tabular-nums text-[#111827]">#{request.id.slice(0, 8).toUpperCase()}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-[#71717A]">Completed</dt><dd className="font-medium text-[#111827]">{formatDate(request.completed_at)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-[#71717A]">Strategy</dt><dd className="font-medium capitalize text-[#111827]">{request.strategy}</dd></div>
                </dl>
              </div>
            )}
          </div>
        </div>

        {Object.keys(report.metrics).length > 0 && (
          <div className="relative border-t border-[#EAE8F2] px-5 py-5 sm:px-7">
            <h2 className="text-[15px] font-semibold text-[#111827]">Measured metrics</h2>
            <p className="mt-0.5 text-[12px] text-[#71717A]">Reported directly by Lighthouse for this run.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(report.metrics).map(([k, m]) => {
                const v = Math.round((m.score ?? 0) * 100)
                return (
                  <div key={k} className="rounded-xl border border-[#EAE8F2] p-3.5">
                    <p className="text-[11.5px] text-[#71717A]">{m.label || k}</p>
                    <p className="mt-1 font-display text-[20px] font-semibold tabular-nums text-[#111827]">{m.value}</p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#F1F0F6]">
                      <div className="h-full rounded-full" style={{ width: `${v}%`, background: scoreTone(v).ring }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {history.length >= 2 && (
          <div className="relative border-t border-[#EAE8F2] px-5 py-5 sm:px-7">
            <h2 className="text-[15px] font-semibold text-[#111827]">Score history</h2>
            <p className="mt-0.5 text-[12px] text-[#71717A]">Overall score across audits</p>
            <TrendChart history={history} />
            <div className="mt-3 flex flex-wrap gap-2">
              {[...history].reverse().slice(0, 5).map((h) => (
                <Link key={h.id} to={`/dashboard/reports/${h.id}`}
                  className="rounded-full border border-[#EAE8F2] px-2.5 py-1 text-[11.5px] transition hover:border-primary-300 hover:bg-[#FAF5FF]">
                  <span className="text-[#71717A]">{formatDate(h.fetched_at)}</span>
                  <span className={`ml-1.5 font-semibold tabular-nums ${scoreTone(h.overall).text}`}>{h.overall ?? '—'}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Next steps bar */}
        <div className="relative flex flex-wrap items-center gap-3 border-t border-[#EAE8F2] bg-[#FAFAFC] px-5 py-4 sm:px-7">
          <div className="mr-auto flex items-center gap-2 text-[12px] text-[#52525B]">
            <CheckCircle2 size={15} className="text-[#059669]" />
            Next step: work through the top fixes, then re-audit to confirm the gain.
          </div>
          <button className="btn" onClick={share} style={{ border: '1px solid #EAE8F2', background: '#fff', color: '#111827' }}>
            <Share2 size={14} /> Share
          </button>
          <button className="btn-primary" onClick={download} disabled={busy}>
            <Download size={14} /> {busy ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <p className="mt-5 text-center text-[11.5px] text-[#71717A]">
        {prettyHost(report.url)} · report generated by SiteOps · measurements © Google Lighthouse
      </p>
    </div>
  )
}

function TrendChart({ history }: { history: Payload['history'] }) {
  const w = 560, h = 96
  const pts = history.map((p, i) => {
    const x = history.length === 1 ? w / 2 : (i / (history.length - 1)) * (w - 12) + 6
    const y = h - 8 - ((p.overall ?? 0) / 100) * (h - 16)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-[96px] w-full" role="img" aria-label="Overall score trend">
      {[0, 25, 50, 75, 100].map((v) => (
        <line key={v} x1="0" x2={w} y1={h - 8 - (v / 100) * (h - 16)} y2={h - 8 - (v / 100) * (h - 16)} stroke="#F1F0F6" strokeWidth="1" />
      ))}
      <polyline points={pts.join(' ')} fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {history.map((p, i) => {
        const [x, y] = pts[i].split(',')
        return <circle key={p.id} cx={x} cy={y} r="2.8" fill="#fff" stroke={scoreTone(p.overall).ring} strokeWidth="2" />
      })}
    </svg>
  )
}
