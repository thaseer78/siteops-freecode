import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Globe2, ListChecks,
  Mail, TrendingUp, Users, XCircle,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { AdminStats } from '../../lib/types'
import { ErrorState, PageHeader, SkeletonRows, Stat } from '../../components/ui'
import { formatDate, prettyHost, timeAgo } from '../../lib/format'
import { AuditStatusPill } from '../customer/Websites'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.get<AdminStats>('/admin/stats').then(setStats).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader eyebrow="Operations" title={`Console overview`}
        subtitle={`Signed in as ${user?.full_name} · ${user?.role.replace('_', ' ')}. Everything below reflects the live database.`}
        actions={<><Link to="/admin/audits" className="btn-primary">Audit queue <ArrowRight size={14} /></Link></>} />

      {!stats ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[116px]" />)}</div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Customers" value={stats.customers} hint="Registered customer accounts" icon={<Users size={16} />} accent="ink" />
            <Stat label="Websites" value={stats.websites} hint="Registered and not archived" icon={<Globe2 size={16} />} accent="sky" />
            <Stat label="Audit requests" value={stats.audits.total} hint={`${stats.audits.completed} completed · ${stats.reports} reports`} icon={<ListChecks size={16} />} accent="mint" />
            <Stat label="Pending queue" value={stats.audits.pending} hint={stats.audits.failed ? `${stats.audits.failed} failed needs review` : 'Nothing failing'} icon={<Clock3 size={16} />} accent={stats.audits.pending ? 'amber' : 'ink'} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <div className="card card-pad lg:col-span-1">
              <p className="text-[12px] font-medium uppercase tracking-wider text-ink-500">Average score</p>
              <p className="mt-2 font-display text-[34px] font-semibold leading-none text-ink-900">{stats.avgScore ?? '—'}</p>
              <p className="mt-2 text-[12px] text-ink-500">Last 50 completed reports</p>
              <div className="mt-4 space-y-2 border-t border-ink-900/[.06] pt-3 text-[12.5px]">
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-ink-600"><CheckCircle2 size={13} className="text-mint-600" />Completed</span><span className="font-semibold text-ink-900">{stats.audits.completed}</span></div>
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-ink-600"><Clock3 size={13} className="text-amber-600" />In flight</span><span className="font-semibold text-ink-900">{stats.audits.pending}</span></div>
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-ink-600"><XCircle size={13} className="text-red-600" />Failed</span><span className="font-semibold text-ink-900">{stats.audits.failed}</span></div>
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-ink-600"><Mail size={13} className="text-ink-500" />Email issues</span><span className="font-semibold text-ink-900">{stats.unreadMailFailures}</span></div>
              </div>
              <Link to="/admin/emails" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-mint-700 hover:underline">Email delivery log <ArrowUpRight size={12} /></Link>
            </div>

            <div className="card lg:col-span-3">
              <div className="flex items-center justify-between border-b border-ink-900/[.07] px-5 py-4">
                <h2 className="text-[15px] font-semibold text-ink-900">Recent audit activity</h2>
                <Link to="/admin/audits" className="text-[12.5px] font-semibold text-mint-700 hover:text-mint-600">Open queue →</Link>
              </div>
              {stats.recentAudits.length === 0 ? <p className="px-5 py-10 text-center text-[13px] text-ink-500">No audit requests yet.</p> : (
                <ul className="divide-y divide-ink-900/[.05]">
                  {stats.recentAudits.map((a) => (
                    <li key={a.id}>
                      <Link to={`/admin/audits/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-[#FBFCFE]">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-900">
                            {a.website_name}
                            <AuditStatusPill status={a.status} />
                          </p>
                          <p className="truncate text-[11.5px] text-ink-500">{a.customer} · {prettyHost(a.url)} · {timeAgo(a.requested_at)}</p>
                        </div>
                        {a.overall != null && <span className="text-[13px] font-bold text-ink-800">{a.overall}</span>}
                        <ArrowRight size={14} className="text-ink-500" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {stats.unreadMailFailures > 0 && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-700" />
              <div className="text-[12.5px] leading-relaxed text-amber-900">
                <p className="font-semibold">{stats.unreadMailFailures} email {stats.unreadMailFailures === 1 ? 'attempt was' : 'attempts were'} not delivered</p>
                <p className="mt-0.5">Either the provider rejected the send or <code>RESEND_API_KEY</code> is not configured. Reports are never marked as delivered unless the provider accepted them.</p>
                <Link to="/admin/emails" className="mt-1.5 inline-block font-semibold underline">Review delivery log</Link>
              </div>
            </div>
          )}

          <div className="mt-4 card">
            <div className="flex items-center justify-between border-b border-ink-900/[.07] px-5 py-4">
              <h2 className="text-[15px] font-semibold text-ink-900">Newest customers</h2>
              <Link to="/admin/customers" className="text-[12.5px] font-semibold text-mint-700 hover:text-mint-600">All customers →</Link>
            </div>
            {stats.recentCustomers.length === 0 ? <div className="p-0"><SkeletonRows rows={2} /></div> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[560px]">
                  <thead><tr className="border-b border-ink-900/[.06]">
                    <th className="table-head">Customer</th><th className="table-head">Company</th>
                    <th className="table-head">Verified</th><th className="table-head">Joined</th><th className="table-head" />
                  </tr></thead>
                  <tbody className="divide-y divide-ink-900/[.05]">
                    {stats.recentCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-[#FBFCFE]">
                        <td className="table-cell"><p className="font-medium text-ink-900">{c.full_name}</p><p className="text-[11.5px] text-ink-500">{c.email}</p></td>
                        <td className="table-cell text-ink-600">{c.company || '—'}</td>
                        <td className="table-cell">{c.email_verified_at ? <span className="chip bg-mint-50 text-mint-700">verified</span> : <span className="chip bg-amber-50 text-amber-800">pending</span>}</td>
                        <td className="table-cell whitespace-nowrap text-ink-500">{formatDate(c.created_at)}</td>
                        <td className="table-cell text-right"><Link to={`/admin/customers/${c.id}`} className="text-[12.5px] font-semibold text-mint-700 hover:underline">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { to: '/admin/audits', icon: ListChecks, t: 'Process the queue', d: 'Run audits, add notes, deliver PDFs.' },
              { to: '/admin/customers', icon: Users, t: 'Support a customer', d: 'Search accounts, review history, suspend abuse.' },
              { to: '/admin/emails', icon: TrendingUp, t: 'Check delivery', d: 'Retry failed report emails with full logs.' },
            ].map((a) => (
              <Link key={a.t} to={a.to} className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900/[.045] text-ink-700 transition group-hover:bg-ink-900 group-hover:text-mint-300"><a.icon size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink-900">{a.t}</span><span className="block text-[11.5px] text-ink-500">{a.d}</span></span>
                <ArrowUpRight size={14} className="text-ink-500" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
