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
import { formatDate, initials, prettyHost, scoreTone, timeAgo } from '../../lib/format'

/* Health trend built only from real reported scores, oldest → newest. */
function HealthTrend({ points }: { points: Array<{ overall: number | null }> }) {
  const values = points.map((p) => p.overall).filter((v): v is number => v != null).slice(0, 8).reverse()
  if (values.length < 2) return null
  const w = 520, h = 150, pad = 8
  const step = (w - pad * 2) / (values.length - 1)
  const y = (v: number) => pad + (1 - v / 100) * (h - pad * 2)
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${pad + i * step},${y(v)}`).join(' ')
  const area = `${line} L${pad + (values.length - 1) * step},${h - pad} L${pad},${h - pad} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-5 h-[150px] w-full" role="img" aria-label="Website health trend">
      <defs>
        <linearGradient id="healthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="healthLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} stroke="#262432" strokeWidth="1" strokeDasharray="3 5" />
      ))}
      <path d={area} fill="url(#healthFill)" />
      <path d={line} fill="none" stroke="url(#healthLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={pad + i * step} cy={y(v)} r="3.5" fill="#0F0E13" stroke="#C084FC" strokeWidth="2" />
      ))}
    </svg>
  )
}

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[128px]" />)}</div>
      <div className="card mt-4"><SkeletonRows /></div>
    </div>
  )

  const { counts, websites, recentReports, notifications, health } = data
  const latest = [...recentReports]
  const trend = latest.length >= 2 && latest[0].overall != null && latest[1].overall != null
    ? latest[0].overall - latest[1].overall : null

  return (
    <div className="animate-rise">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.09em] text-primary-300">Overview</p>
          <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-[-.025em] text-white sm:text-[30px]">
            Welcome back, {user?.full_name?.split(' ')[0]}!
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#A1A1AA]">
            {websites.length
              ? 'Here’s where your websites stand today and what needs attention next.'
              : 'Add your first website to start measuring performance, SEO and accessibility.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/websites?add=1" className="btn-primary"><Plus size={15} /> Add website</Link>
          {websites.length > 0 && <Link to="/dashboard/websites" className="btn-ghost">Request audit <ArrowRight size={15} /></Link>}
          <span className="ml-1 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-[13px] font-bold text-white ring-2 ring-primary-500/25">
            {initials(user?.full_name || 'S')}
          </span>
        </div>
      </div>

      {integrations && (!integrations.pagespeed_key || !integrations.email) && (
        <div className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#D97706]">
            <Zap size={15} /> Deployment integrations not configured yet
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#D97706]/80">
            This build has no <code>PAGESPEED_API_KEY</code>
            {!integrations.email && <> or <code>RESEND_API_KEY</code></>}.
            Audits will show the provider’s real error instead of scores, and emails are logged as
            <em> not configured</em>. Set the keys in <code>.env</code> and restart.
            See <code>docs/SETUP.md</code>.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total websites" value={counts.websites} hint={websites.length ? `Across ${new Set(websites.map((w) => prettyHost(w.url))).size} domains` : 'None yet'} icon={<Globe2 size={16} />} accent="sky" />
        <Stat label="Audit requests" value={counts.total} hint={`${counts.completed} completed`} icon={<ListChecks size={16} />} accent="ink" />
        <Stat label="Reports ready" value={recentReports.length} hint={counts.pending ? `${counts.pending} audit in flight` : 'Nothing queued'} icon={<FileBarChart2 size={16} />} accent={counts.pending ? 'amber' : 'ink'} />
        <Stat label="Avg score" value={health == null ? '—' : health} hint={health == null ? 'No completed audit yet' : `${scoreTone(health).label} across scored sites`} icon={<Zap size={16} />} accent="mint" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Health overview chart */}
        <div className="card card-pad lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-white">Website Health Overview</h2>
              <p className="mt-0.5 text-[12px] text-[#A1A1AA]">Overall score per report, oldest to newest</p>
            </div>
            <Link to="/dashboard/reports" className="text-[12px] font-semibold text-primary-300 hover:text-primary-200">View all →</Link>
          </div>

          {recentReports.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[#2F2C3D] bg-white/[.02] px-5 py-10 text-center">
              <Globe2 className="mx-auto text-[#71717A]" size={22} />
              <p className="mt-2.5 text-[13.5px] font-semibold text-white">No measurements yet</p>
              <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-[#A1A1AA]">
                Add a website and request your first audit. Real PageSpeed data appears here once it completes.
              </p>
              <Link to="/dashboard/websites?add=1" className="btn-primary mt-4"><Plus size={14} /> Add your first website</Link>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[.09em] text-[#71717A]">Latest overall</p>
                  <p className="mt-1 font-display text-[34px] font-bold leading-none tabular-nums text-white">{recentReports[0].overall ?? '—'}</p>
                </div>
                {trend != null && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${trend >= 0 ? 'bg-[#10B981]/15 text-[#34D399]' : 'bg-[#EF4444]/15 text-[#FCA5A5]'}`}>
                    {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {trend > 0 ? '+' : ''}{trend} vs previous
                  </span>
                )}
                <span className="ml-auto text-[11.5px] text-[#71717A]">{formatDate(recentReports[0].fetched_at)}</span>
              </div>
              <HealthTrend points={recentReports} />
              <ul className="mt-4 divide-y divide-[#262432]">
                {websites.slice(0, 4).map((w) => {
                  const tone = scoreTone(w.latest_score)
                  return (
                    <li key={w.id} className="flex items-center gap-3.5 py-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[13px] font-bold tabular-nums" style={{ background: 'rgba(124,58,237,.14)', color: '#C084FC' }}>
                        {w.latest_score ?? '—'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-white">{w.name}</p>
                        <p className="truncate text-[11.5px] text-[#71717A]">{prettyHost(w.url)} · {w.latest_at ? `audited ${timeAgo(w.latest_at)}` : 'never audited'}</p>
                      </div>
                      <span className={`chip ${tone.bg} ${tone.text}`}>{tone.label}</span>
                      <Link to="/dashboard/websites" className="rounded-lg p-1.5 text-[#71717A] transition hover:bg-white/[.06] hover:text-white" aria-label={`Open ${w.name}`}>
                        <ArrowUpRight size={14} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        {/* Latest report */}
        <div className="card card-pad">
          <h2 className="text-[15px] font-semibold text-white">Latest report</h2>
          {recentReports[0] ? (
            <div className="mt-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <ScoreRing score={recentReports[0].overall} size={104} stroke={9} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">{recentReports[0].website_name}</p>
                  <p className="truncate text-[11.5px] text-[#71717A]">{prettyHost(recentReports[0].url)}</p>
                  <p className="mt-0.5 text-[11.5px] text-[#71717A]">{formatDate(recentReports[0].fetched_at)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ScorePill score={recentReports[0].performance} label="Performance" />
                <ScorePill score={recentReports[0].accessibility} label="Accessibility" />
                <ScorePill score={recentReports[0].seo} label="SEO" />
                <ScorePill score={recentReports[0].best_practices} label="Best practices" />
              </div>
              <Link to={`/dashboard/reports/${recentReports[0].id}`} className="btn-primary mt-4 w-full">View full report <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[#2F2C3D] px-4 py-9 text-center">
              <FileBarChart2 className="mx-auto text-[#71717A]" size={20} />
              <p className="mt-2 text-[13px] font-semibold text-white">No reports yet</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#A1A1AA]">Completed audits appear here with full findings.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Recent reports */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#262432] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-white">Recent reports</h2>
            <Link to="/dashboard/reports" className="text-[12px] font-semibold text-primary-300 hover:text-primary-200">All reports →</Link>
          </div>
          {recentReports.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-[#A1A1AA]">Reports will appear here once an audit completes.</div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[520px]">
                <thead><tr className="border-b border-[#262432]">
                  <th className="table-head">Website</th><th className="table-head">Overall</th>
                  <th className="table-head">Perf</th><th className="table-head">SEO</th><th className="table-head">Date</th><th className="table-head" />
                </tr></thead>
                <tbody className="divide-y divide-[#262432]">
                  {recentReports.map((r) => (
                    <tr key={r.id} className="transition hover:bg-white/[.03]">
                      <td className="table-cell">
                        <p className="font-medium text-white">{r.website_name}</p>
                        <p className="text-[11.5px] text-[#71717A]">{prettyHost(r.url)} · {r.strategy}</p>
                      </td>
                      <td className="table-cell"><span className={`chip ${scoreTone(r.overall).bg} ${scoreTone(r.overall).text}`}>{r.overall ?? '—'}</span></td>
                      <td className="table-cell tabular-nums text-[#A1A1AA]">{r.performance ?? '—'}</td>
                      <td className="table-cell tabular-nums text-[#A1A1AA]">{r.seo ?? '—'}</td>
                      <td className="table-cell whitespace-nowrap text-[#71717A]">{formatDate(r.fetched_at)}</td>
                      <td className="table-cell text-right"><Link to={`/dashboard/reports/${r.id}`} className="text-[12.5px] font-semibold text-primary-300 hover:underline">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity timeline */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-[#262432] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-white">Recent Activity</h2>
            <Link to="/dashboard/notifications" className="text-[#71717A] transition hover:text-white" aria-label="All notifications"><Bell size={15} /></Link>
          </div>
          {notifications.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[#A1A1AA]">No activity yet.</p>
          ) : (
            <ul className="relative px-5 py-4">
              <span className="absolute bottom-6 left-[27px] top-6 w-px bg-[#262432]" aria-hidden />
              {notifications.slice(0, 5).map((n, i) => (
                <li key={n.id} className="relative pb-4 pl-6 last:pb-0">
                  <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full ring-4 ring-plum-800"
                    style={{ background: ['#10B981', '#A855F7', '#F59E0B', '#C084FC', '#10B981'][i % 5] }} />
                  <Link to={n.link || '/dashboard/notifications'} className="block">
                    <p className="text-[12.5px] font-semibold leading-snug text-white">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-[#A1A1AA]">{n.body}</p>
                    <p className="mt-1 text-[10.5px] tabular-nums text-[#71717A]">{timeAgo(n.created_at)}</p>
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
          { to: '/dashboard/websites', label: 'Request an audit', body: 'Mobile or desktop, real Lighthouse data.', icon: Zap },
          { to: '/dashboard/reports', label: 'Download a PDF', body: 'Branded reports ready to forward.', icon: FileBarChart2 },
          { to: '/dashboard/settings', label: 'Notification settings', body: 'Control audit and report emails.', icon: CalendarClock },
        ].map((a) => (
          <Link key={a.label} to={a.to}
            className="group flex items-center gap-3.5 rounded-2xl border border-[#262432] bg-gradient-to-br from-primary-600/[.14] to-transparent p-4 transition hover:border-primary-500/40 hover:from-primary-600/[.22]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-600/15 text-primary-300 transition group-hover:bg-primary-600 group-hover:text-white"><a.icon size={17} /></span>
            <span className="flex-1">
              <span className="block text-[13px] font-semibold text-white">{a.label}</span>
              <span className="block text-[11.5px] text-[#A1A1AA]">{a.body}</span>
            </span>
            <ArrowUpRight size={15} className="text-[#71717A] transition group-hover:text-primary-300" />
          </Link>
        ))}
      </div>

      {counts.failed > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#D97706]" />
          <div className="text-[12.5px] leading-relaxed text-[#D97706]">
            <p className="font-semibold">{counts.failed} audit{counts.failed > 1 ? 's' : ''} couldn’t complete</p>
            <p className="mt-0.5">PageSpeed Insights may have been unavailable or the site unreachable. Open the audit to see the provider’s exact message and retry.</p>
            <Link to="/dashboard/requests" className="mt-1.5 inline-block font-semibold underline">View audit requests</Link>
          </div>
        </div>
      )}

      {/* Keep the clock icon referenced for the in-flight hint above. */}
      <span className="sr-only"><Clock3 /></span>
    </div>
  )
}
