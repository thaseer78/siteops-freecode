import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, Bell, CalendarClock, CheckCircle2, Clock3, FileBarChart2,
  Globe2, ListChecks, Plus, TrendingDown, TrendingUp, Zap,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { DashboardData } from '../../lib/types'
import { ErrorState, PageHeader, ScorePill, ScoreRing, SkeletonRows, Stat } from '../../components/ui'
import { formatDate, prettyHost, scoreTone, timeAgo } from '../../lib/format'

export default function CustomerDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [integrations, setIntegrations] = useState<{ pagespeed_key: boolean; email: boolean } | null>(null)

  const load = () => {
    setError(null)
    api.get<DashboardData>('/dashboard').then(setData).catch((e) => setError(e.message))
    api.get<{ pagespeed_key: boolean; email: boolean }>('/health').then(setIntegrations).catch(() => setIntegrations(null))
  }
  useEffect(load, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return (
    <div>
      <PageHeader title="Overview" subtitle="Loading your website health…" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[116px]" />)}</div>
      <div className="card mt-4"><SkeletonRows /></div>
    </div>
  )

  const { counts, websites, recentReports, notifications, health } = data
  const latest = [...recentReports]
  const trend = latest.length >= 2 && latest[0].overall != null && latest[1].overall != null
    ? latest[0].overall - latest[1].overall : null

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${user?.full_name?.split(' ')[0]}`}
        subtitle={websites.length
          ? 'Here’s where your websites stand today and what needs attention next.'
          : 'Add your first website to start measuring performance, SEO and accessibility.'}
        actions={
          <>
            <Link to="/app/websites?add=1" className="btn-primary"><Plus size={15} /> Add website</Link>
            {websites.length > 0 && <Link to="/app/websites" className="btn-ghost">Request audit <ArrowRight size={15} /></Link>}
          </>
        }
      />

      {integrations && (!integrations.pagespeed_key || !integrations.email) && (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-sky-900">
            <Zap size={15} /> Deployment integrations not configured yet
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-sky-900/80">
            This build has no <code className="rounded bg-white/70 px-1">PAGESPEED_API_KEY</code>
            {!integrations.email && <> or <code className="rounded bg-white/70 px-1">RESEND_API_KEY</code></>}.
            Audits will show the provider’s real error instead of scores, and emails are logged as
            <em> not configured</em>. Set the keys in <code className="rounded bg-white/70 px-1">.env</code> and restart.
            See <code className="rounded bg-white/70 px-1">docs/SETUP.md</code>.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Registered websites" value={counts.websites} hint={websites.length ? `Across ${new Set(websites.map((w) => prettyHost(w.url))).size} domains` : 'None yet'} icon={<Globe2 size={16} />} accent="ink" />
        <Stat label="Total audits" value={counts.total} hint={`${counts.completed} completed`} icon={<ListChecks size={16} />} accent="sky" />
        <Stat label="Pending audits" value={counts.pending} hint={counts.pending ? 'In progress now' : 'Nothing queued'} icon={<Clock3 size={16} />} accent={counts.pending ? 'amber' : 'ink'} />
        <Stat label="Average health" value={health == null ? '—' : health} hint={health == null ? 'No completed audit yet' : `${scoreTone(health).label} across scored sites`} icon={<Zap size={16} />} accent="mint" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Health overview */}
        <div className="card card-pad lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Website health</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-500">Latest measured score per website</p>
            </div>
            <Link to="/app/websites" className="text-[12.5px] font-semibold text-mint-700 hover:text-mint-600">Manage →</Link>
          </div>
          {websites.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-ink-900/15 bg-[#FBFCFE] px-5 py-8 text-center">
              <Globe2 className="mx-auto text-ink-500" size={22} />
              <p className="mt-2.5 text-[13.5px] font-semibold text-ink-900">No websites registered yet</p>
              <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-ink-500">Add a URL to request your first audit. No code access needed.</p>
              <Link to="/app/websites?add=1" className="btn-primary mt-4"><Plus size={14} /> Add your first website</Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-ink-900/[.06]">
              {websites.slice(0, 5).map((w) => {
                const tone = scoreTone(w.latest_score)
                return (
                  <li key={w.id} className="flex items-center gap-3.5 py-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[13px] font-bold ${tone.bg} ${tone.text}`}>
                      {w.latest_score ?? '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink-900">{w.name}</p>
                      <p className="truncate text-[12px] text-ink-500">{prettyHost(w.url)} · {w.latest_at ? `audited ${timeAgo(w.latest_at)}` : 'never audited'}</p>
                    </div>
                    <Link to={`/app/websites`} className="btn-quiet px-2.5 py-1.5 text-[12.5px]">Open <ArrowUpRight size={13} /></Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Score card */}
        <div className="card card-pad">
          <h2 className="text-[15px] font-semibold text-ink-900">Latest report</h2>
          {recentReports[0] ? (
            <div className="mt-3">
              <div className="flex items-center gap-4">
                <ScoreRing score={recentReports[0].overall} size={88} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink-900">{recentReports[0].website_name}</p>
                  <p className="truncate text-[11.5px] text-ink-500">{prettyHost(recentReports[0].url)}</p>
                  <p className="mt-1 text-[11.5px] text-ink-500">{formatDate(recentReports[0].fetched_at)}</p>
                  {trend != null && (
                    <span className={`mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold ${trend >= 0 ? 'text-mint-700' : 'text-red-600'}`}>
                      {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {trend > 0 ? '+' : ''}{trend} vs previous
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ScorePill score={recentReports[0].performance} label="Performance" />
                <ScorePill score={recentReports[0].accessibility} label="Accessibility" />
                <ScorePill score={recentReports[0].seo} label="SEO" />
                <ScorePill score={recentReports[0].best_practices} label="Best practices" />
              </div>
              <Link to={`/app/reports/${recentReports[0].id}`} className="btn-ghost mt-3 w-full">View full report <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-ink-900/15 px-4 py-7 text-center">
              <FileBarChart2 className="mx-auto text-ink-500" size={20} />
              <p className="mt-2 text-[13px] font-semibold text-ink-900">No reports yet</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-500">Completed audits appear here with full findings.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Recent reports */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-ink-900/[.07] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink-900">Recent reports</h2>
            <Link to="/app/reports" className="text-[12.5px] font-semibold text-mint-700 hover:text-mint-600">All reports →</Link>
          </div>
          {recentReports.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-ink-500">Reports will appear here once an audit completes.</div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[520px]">
                <thead><tr className="border-b border-ink-900/[.06]">
                  <th className="table-head">Website</th><th className="table-head">Overall</th>
                  <th className="table-head">Perf</th><th className="table-head">SEO</th><th className="table-head">Date</th><th className="table-head" />
                </tr></thead>
                <tbody className="divide-y divide-ink-900/[.05]">
                  {recentReports.map((r) => (
                    <tr key={r.id} className="hover:bg-[#FBFCFE]">
                      <td className="table-cell">
                        <p className="font-medium text-ink-900">{r.website_name}</p>
                        <p className="text-[11.5px] text-ink-500">{prettyHost(r.url)} · {r.strategy}</p>
                      </td>
                      <td className="table-cell"><span className={`chip ${scoreTone(r.overall).bg} ${scoreTone(r.overall).text}`}>{r.overall ?? '—'}</span></td>
                      <td className="table-cell text-ink-600">{r.performance ?? '—'}</td>
                      <td className="table-cell text-ink-600">{r.seo ?? '—'}</td>
                      <td className="table-cell whitespace-nowrap text-ink-500">{formatDate(r.fetched_at)}</td>
                      <td className="table-cell text-right"><Link to={`/app/reports/${r.id}`} className="text-[12.5px] font-semibold text-mint-700 hover:underline">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-ink-900/[.07] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink-900">Recent activity</h2>
            <Link to="/app/notifications" className="text-ink-500 hover:text-ink-800" aria-label="All notifications"><Bell size={15} /></Link>
          </div>
          {notifications.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-ink-500">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-ink-900/[.05]">
              {notifications.slice(0, 5).map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <Link to={n.link || '/app/notifications'} className="block">
                    <p className="flex items-start gap-2 text-[12.5px] font-semibold text-ink-900">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint-500" />{n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 pl-3.5 text-[11.5px] leading-relaxed text-ink-500">{n.body}</p>
                    <p className="mt-1 pl-3.5 text-[10.5px] text-ink-500">{timeAgo(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { to: '/app/websites', label: 'Request an audit', body: 'Mobile or desktop, real Lighthouse data.', icon: Zap },
          { to: '/app/reports', label: 'Download a PDF', body: 'Branded reports ready to forward.', icon: FileBarChart2 },
          { to: '/app/profile', label: 'Notification settings', body: 'Control audit and report emails.', icon: CalendarClock },
        ].map((a) => (
          <Link key={a.label} to={a.to} className="card group flex items-center gap-3.5 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900/[.045] text-ink-700 transition group-hover:bg-ink-900 group-hover:text-mint-300"><a.icon size={17} /></span>
            <span className="flex-1">
              <span className="block text-[13px] font-semibold text-ink-900">{a.label}</span>
              <span className="block text-[11.5px] text-ink-500">{a.body}</span>
            </span>
            <ArrowUpRight size={15} className="text-ink-500" />
          </Link>
        ))}
      </div>

      {counts.failed > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-amber-700" />
          <div className="text-[12.5px] leading-relaxed text-amber-900">
            <p className="font-semibold">{counts.failed} audit{counts.failed > 1 ? 's' : ''} couldn’t complete</p>
            <p className="mt-0.5">PageSpeed Insights may have been unavailable or the site unreachable. Open the audit to see the provider’s exact message and retry.</p>
            <Link to="/app/audits" className="mt-1.5 inline-block font-semibold underline">View audit requests</Link>
          </div>
        </div>
      )}
    </div>
  )
}
