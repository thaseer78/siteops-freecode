import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, FileBarChart2, TrendingDown, TrendingUp } from 'lucide-react'
import { api, downloadFile } from '../../lib/api'
import type { Report } from '../../lib/types'
import { EmptyState, ErrorState, PageHeader, SkeletonRows, useToast } from '../../components/ui'
import { formatDate, prettyHost, scoreTone } from '../../lib/format'

type Row = Pick<Report, 'id' | 'url' | 'strategy' | 'overall' | 'performance' | 'seo' | 'accessibility' | 'best_practices' | 'fetched_at' | 'website_name' | 'audit_request_id' | 'website_id'>

export default function ReportsPage() {
  const { push } = useToast()
  const [reports, setReports] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.get<{ reports: Row[] }>('/reports').then((r) => setReports(r.reports)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  async function download(r: Row) {
    setBusy(r.id)
    try {
      await downloadFile(`/reports/${r.id}/pdf`, `SiteOps-${r.website_name.replace(/[^a-z0-9]+/gi, '-')}-${r.fetched_at.slice(0, 10)}.pdf`)
    } catch (e) {
      push({ kind: 'error', title: 'Download failed', body: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  // Group by website to make trend direction visible at a glance.
  const bySite = new Map<string, Row[]>()
  for (const r of reports || []) {
    const k = r.website_id
    bySite.set(k, [...(bySite.get(k) || []), r])
  }

  return (
    <div>
      <PageHeader eyebrow="Reports" title="Audit reports"
        subtitle="Every completed audit is archived here with its measurements. Download a branded PDF or compare scores over time." />

      {error && <div className="card"><ErrorState message={error} onRetry={load} /></div>}
      {!error && reports === null && <div className="card"><SkeletonRows rows={5} /></div>}

      {reports && reports.length === 0 && (
        <div className="card"><EmptyState icon={<FileBarChart2 size={22} />} title="No reports yet"
          body="Once an audit completes, the full report appears here with findings, metrics and PDF export."
          action={{ label: 'Request an audit', to: '/app/websites' }} /></div>
      )}

      {reports && reports.length > 0 && (
        <div className="space-y-4">
          {[...bySite.entries()].map(([siteId, rows]) => {
            const latest = rows[0]
            const prev = rows[1]
            const delta = latest.overall != null && prev?.overall != null ? latest.overall - prev.overall : null
            return (
              <section key={siteId} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-900/[.07] px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink-900">{latest.website_name}</p>
                    <p className="truncate text-[12px] text-ink-500">{prettyHost(latest.url)} · {rows.length} report{rows.length > 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {delta != null && (
                      <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${delta >= 0 ? 'text-mint-700' : 'text-red-600'}`}>
                        {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{delta > 0 ? '+' : ''}{delta} pts
                      </span>
                    )}
                    <span className={`rounded-lg px-2.5 py-1 text-[13px] font-bold ${scoreTone(latest.overall).bg} ${scoreTone(latest.overall).text}`}>
                      {latest.overall ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[620px]">
                    <thead><tr className="border-b border-ink-900/[.06]">
                      <th className="table-head">Measured</th><th className="table-head">Strategy</th>
                      <th className="table-head">Perf</th><th className="table-head">A11y</th>
                      <th className="table-head">Best pr.</th><th className="table-head">SEO</th>
                      <th className="table-head">Overall</th><th className="table-head text-right">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-ink-900/[.05]">
                      {rows.map((r) => (
                        <tr key={r.id} className="hover:bg-[#FBFCFE]">
                          <td className="table-cell whitespace-nowrap">{formatDate(r.fetched_at, true)}</td>
                          <td className="table-cell capitalize text-ink-500">{r.strategy}</td>
                          {[r.performance, r.accessibility, r.best_practices, r.seo].map((v, i) => (
                            <td key={i} className="table-cell"><span className={`font-medium ${scoreTone(v).text}`}>{v ?? '—'}</span></td>
                          ))}
                          <td className="table-cell">
                            <span className={`chip ${scoreTone(r.overall).bg} ${scoreTone(r.overall).text}`}>{r.overall ?? '—'}</span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center justify-end gap-1.5">
                              <button className="btn-quiet px-2 py-1.5" onClick={() => download(r)} disabled={busy === r.id} aria-label="Download PDF">
                                <Download size={14} />
                              </button>
                              <Link to={`/app/reports/${r.id}`} className="btn-ghost px-2.5 py-1.5 text-[12px]">Open <ArrowRight size={12} /></Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
