import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, Download, ExternalLink, Info, Lightbulb, Share2, Smartphone, Monitor,
} from 'lucide-react'
import { api, downloadFile } from '../../lib/api'
import type { Report } from '../../lib/types'
import { ErrorState, PageHeader, ScoreRing, SkeletonRows, useToast } from '../../components/ui'
import { categoryLabel, formatDate, prettyHost, scoreTone } from '../../lib/format'

interface Payload {
  report: Report
  website: { id: string; name: string; url: string }
  history: Array<{ id: string; overall: number | null; performance: number | null; seo: number | null; accessibility: number | null; best_practices: number | null; fetched_at: string }>
  request: { id: string; requested_at: string; completed_at: string | null; strategy: string } | null
}

const cats: Array<{ key: keyof Pick<Report, 'performance' | 'accessibility' | 'best_practices' | 'seo'>; label: string }> = [
  { key: 'performance', label: 'Performance' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'best_practices', label: 'Best practices' },
  { key: 'seo', label: 'SEO' },
]

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

  return (
    <div className="animate-rise">
      <Link to="/app/reports" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> All reports
      </Link>

      <div className="card overflow-hidden">
        <div className="relative bg-ink-900 px-5 py-6 sm:px-7">
          <div className="grid-noise absolute inset-0 opacity-60" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-mint-300">Website health report</p>
              <h1 className="mt-1.5 truncate font-display text-[24px] font-semibold text-white sm:text-[28px]">{website.name}</h1>
              <a href={website.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white">
                {website.url} <ExternalLink size={12} />
              </a>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-white/50">
                <span className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-0.5 capitalize">
                  {report.strategy === 'mobile' ? <Smartphone size={11} /> : <Monitor size={11} />} {report.strategy}
                </span>
                <span>Measured {formatDate(report.fetched_at, true)}</span>
                {report.lighthouse_version && <span>· Lighthouse {report.lighthouse_version}</span>}
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="font-display text-[42px] font-semibold leading-none" style={{ color: scoreTone(report.overall).ring }}>{report.overall ?? '—'}</p>
                <p className="mt-1 text-[10.5px] uppercase tracking-wider text-white/45">Overall</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-ink-900/[.07] px-5 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
          {cats.map((c) => {
            const value = report[c.key]
            const before = prev?.[c.key]
            const delta = value != null && before != null ? value - before : null
            const tone = scoreTone(value)
            return (
              <div key={c.key} className="rounded-xl border border-ink-900/[.07] p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-ink-600">{c.label}</p>
                  <span className={`chip ${tone.bg} ${tone.text}`}>{value ?? '—'}</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-900/[.07]">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value ?? 0}%`, background: tone.ring }} />
                </div>
                <p className="mt-2 text-[11px] text-ink-500">
                  {tone.label}{delta != null && <span className={delta >= 0 ? ' text-mint-700' : ' text-red-600'}> · {delta > 0 ? '+' : ''}{delta} vs previous</span>}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-4 sm:px-7">
          <button className="btn-primary" onClick={download} disabled={busy}><Download size={14} /> {busy ? 'Preparing…' : 'Download PDF'}</button>
          <button className="btn-ghost" onClick={share}><Share2 size={14} /> Share</button>
          {request && <Link to="/app/audits" className="btn-quiet">Request details</Link>}
        </div>
      </div>

      {/* Metrics */}
      {Object.keys(report.metrics).length > 0 && (
        <div className="mt-4 card card-pad">
          <h2 className="text-[15px] font-semibold text-ink-900">Measured metrics</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">Reported directly by Lighthouse for this run.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(report.metrics).map(([k, m]) => {
              const v = Math.round((m.score ?? 0) * 100)
              return (
                <div key={k} className="rounded-xl border border-ink-900/[.07] p-3.5">
                  <p className="text-[11.5px] text-ink-500">{m.label || k}</p>
                  <p className="mt-1 font-display text-[20px] font-semibold text-ink-900">{m.value}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-900/[.07]">
                    <div className="h-full rounded-full" style={{ width: `${v}%`, background: scoreTone(v).ring }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <div className="space-y-4">
          {/* Recommendations */}
          <div className="card card-pad">
            <div className="flex items-start gap-2.5">
              <Lightbulb size={18} className="mt-0.5 text-amber-600" />
              <div>
                <h2 className="text-[15px] font-semibold text-ink-900">Fix these first</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-500">Ranked by Lighthouse weight and measured savings.</p>
              </div>
            </div>
            {report.recommendations.length === 0 ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-mint-200 bg-mint-50 p-4 text-[13px] text-mint-900">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                Lighthouse reported no failed audits for this run. Re-audit after future changes to confirm.
              </div>
            ) : (
              <ol className="mt-4 space-y-3">
                {report.recommendations.map((r, i) => (
                  <li key={r.title + i} className="rounded-xl border border-ink-900/[.07] bg-[#FBFCFE] p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-900 text-[11px] font-bold text-mint-300">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-ink-900">{r.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="chip bg-white text-ink-600 ring-1 ring-ink-900/10">{categoryLabel[r.category] || r.category}</span>
                          {r.impact && <span className="text-[11.5px] font-semibold text-mint-700">{r.impact}</span>}
                        </div>
                        {r.detail && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">{r.detail}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* All findings */}
          <div className="card">
            <div className="border-b border-ink-900/[.07] px-5 py-4">
              <h2 className="text-[15px] font-semibold text-ink-900">Detailed findings</h2>
              <p className="mt-0.5 text-[12px] text-ink-500">{report.findings.length} Lighthouse audits flagged</p>
            </div>
            {report.findings.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ink-500">Nothing was flagged in this run.</p>
            ) : (
              <div className="divide-y divide-ink-900/[.05]">
                {[...groups.entries()].map(([cat, items]) => (
                  <div key={cat} className="px-5 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{categoryLabel[cat] || cat}</p>
                    <ul className="mt-2 space-y-2.5">
                      {items.map((f) => (
                        <li key={f.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium leading-snug text-ink-900">{f.title}</p>
                            {f.description && <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-500">{f.description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</p>}
                          </div>
                          <span className="shrink-0 text-right text-[11px] font-semibold text-ink-600">
                            {f.displayValue || (f.savingsMs ? `${(f.savingsMs / 1000).toFixed(1)}s` : '—')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Trend */}
          <div className="card card-pad">
            <h2 className="text-[15px] font-semibold text-ink-900">Score history</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">Overall score across audits</p>
            {history.length < 2 ? (
              <p className="mt-4 rounded-lg bg-[#FBFCFE] px-3 py-4 text-[12px] leading-relaxed text-ink-500">
                Re-audit this website after making fixes to start a trend line.
              </p>
            ) : (
              <TrendChart history={history} />
            )}
            <div className="mt-4 space-y-1.5">
              {[...history].reverse().slice(0, 5).map((h) => (
                <Link key={h.id} to={`/app/reports/${h.id}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px] hover:bg-ink-900/[.03]">
                  <span className="text-ink-500">{formatDate(h.fetched_at)}</span>
                  <span className={`font-semibold ${scoreTone(h.overall).text}`}>{h.overall ?? '—'}/100</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="flex items-start gap-2.5">
              <Info size={16} className="mt-0.5 shrink-0 text-sky-600" />
              <div>
                <h2 className="text-[13.5px] font-semibold text-ink-900">What this covers</h2>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">
                  Scores come from Google Lighthouse via PageSpeed Insights for this URL and device strategy.
                  A single run varies with network conditions and third-party scripts. This is not a penetration
                  test, uptime monitor or vulnerability scan, and is not a guarantee of search ranking.
                </p>
                <Link to="/app/profile" className="mt-2.5 inline-block text-[12px] font-semibold text-mint-700 hover:underline">
                  Need the fixes done? Contact ops →
                </Link>
              </div>
            </div>
          </div>

          {request && (
            <div className="card card-pad">
              <h2 className="text-[13.5px] font-semibold text-ink-900">Request</h2>
              <dl className="mt-2.5 space-y-2 text-[12px]">
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Reference</dt><dd className="font-medium text-ink-800">#{request.id.slice(0, 8).toUpperCase()}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Requested</dt><dd className="font-medium text-ink-800">{formatDate(request.requested_at, true)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Completed</dt><dd className="font-medium text-ink-800">{formatDate(request.completed_at, true)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Strategy</dt><dd className="font-medium capitalize text-ink-800">{request.strategy}</dd></div>
              </dl>
            </div>
          )}
        </div>
      </div>

      <p className="mt-5 text-center text-[11.5px] text-ink-500">
        {prettyHost(report.url)} · report generated by SiteOps · measurements © Google Lighthouse
      </p>
      <div className="sr-only"><ScoreRing score={report.overall} /></div>
    </div>
  )
}

function TrendChart({ history }: { history: Payload['history'] }) {
  const w = 260, h = 84
  const pts = history.map((p, i) => {
    const x = history.length === 1 ? w / 2 : (i / (history.length - 1)) * (w - 12) + 6
    const y = h - 8 - ((p.overall ?? 0) / 100) * (h - 16)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full" role="img" aria-label="Overall score trend">
      {[0, 25, 50, 75, 100].map((v) => (
        <line key={v} x1="0" x2={w} y1={h - 8 - (v / 100) * (h - 16)} y2={h - 8 - (v / 100) * (h - 16)} stroke="#EDF1F7" strokeWidth="1" />
      ))}
      <polyline points={pts.join(' ')} fill="none" stroke="#0E9673" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {history.map((p, i) => {
        const [x, y] = pts[i].split(',')
        return <circle key={p.id} cx={x} cy={y} r="2.8" fill="#fff" stroke={scoreTone(p.overall).ring} strokeWidth="2" />
      })}
    </svg>
  )
}
