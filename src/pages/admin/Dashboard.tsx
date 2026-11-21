import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, FileBarChart2, Globe2,
  ListChecks, Mail, Plus, Send, Users, XCircle,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { AdminStats, EmailLog } from '../../lib/types'
import { ErrorState, SkeletonRows, Stat } from '../../components/ui'
import { formatDate, initials, prettyHost, timeAgo } from '../../lib/format'
import { AuditStatusPill } from '../customer/Websites'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [emails, setEmails] = useState<EmailLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.get<AdminStats>('/admin/overview').then(setStats).catch((e) => setError(e.message))
    api.get<{ emails: EmailLog[] }>('/admin/emails').then((r) => setEmails(r.emails)).catch(() => setEmails([]))
  }
  useEffect(load, [])

  if (error) return <ErrorState message={error} onRetry={load} />

  const enquiries = stats?.recentEnquiries ?? stats?.recentAudits ?? []
  const sent = emails?.filter((e) => e.status === 'sent').length ?? null
  const attempted = emails?.length ?? 0
  const deliveryRate = sent != null && attempted > 0 ? Math.round((sent / attempted) * 100) : null

  return (
    <div className="animate-rise">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-.025em] text-[#111827] sm:text-[30px]">
            Admin Dashboard
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#52525B]">
            Everything below reflects the live database — {user?.full_name} · {user?.role.replace('_', ' ')}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/enquiries" className="btn-primary">Audit queue <ArrowRight size={14} /></Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] py-1 pl-1 pr-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-600 text-[10.5px] font-bold text-white">
              {initials(user?.full_name || 'A')}
            </span>
            <span className="text-[11px] font-semibold text-white">Admin</span>
          </span>
        </div>
      </div>

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[128px]" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total customers" value={stats.customers} hint="Registered customer accounts" icon={<Users size={16} />} accent="ink" />
            <Stat label="Audit requests" value={stats.audits.total + stats.audits.pending} hint={`${stats.audits.pending} in flight · ${stats.audits.completed} completed`} icon={<ListChecks size={16} />} accent="sky" />
            <Stat label="Reports sent" value={sent == null ? '—' : sent} hint={attempted ? `${attempted} email attempts logged` : 'No email attempts yet'} icon={<Mail size={16} />} accent="mint" />
            <Stat label="Delivery rate" value={deliveryRate == null ? '—' : `${deliveryRate}%`} hint={stats.failedDeliveries ? `${stats.failedDeliveries} failed — needs review` : 'No failed deliveries'} icon={<FileBarChart2 size={16} />} accent={stats.failedDeliveries ? 'amber' : 'ink'} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_.9fr]">
            {/* Recent audit requests table */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#EAE8F2] px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#111827]">Recent Audit Requests</h2>
                  <p className="mt-0.5 text-[12px] text-[#71717A]">Newest customer requests across every website</p>
                </div>
                <Link to="/admin/enquiries" className="text-[12px] font-semibold text-primary-700 hover:text-primary-600">Open queue →</Link>
              </div>
              {enquiries.length === 0 ? (
                <p className="px-5 py-12 text-center text-[13px] text-[#71717A]">No audit requests yet.</p>
              ) : (
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr className="border-b border-[#EAE8F2] bg-[#FAFAFC]">
                        <th className="table-head">Website</th>
                        <th className="table-head">Customer</th>
                        <th className="table-head">Status</th>
                        <th className="table-head">Requested</th>
                        <th className="table-head" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE8F2]">
                      {enquiries.slice(0, 6).map((a) => (
                        <tr key={a.id} className="transition hover:bg-[#FAF5FF]">
                          <td className="table-cell">
                            <p className="font-medium text-[#111827]">{a.website_name}</p>
                            <p className="text-[11.5px] text-[#71717A]">{prettyHost(a.url)}</p>
                          </td>
                          <td className="table-cell text-[#52525B]">{a.customer}</td>
                          <td className="table-cell"><AuditStatusPill status={a.status} /></td>
                          <td className="table-cell whitespace-nowrap text-[#71717A]">{timeAgo(a.requested_at)}</td>
                          <td className="table-cell text-right">
                            <Link to={`/admin/enquiries/${a.id}`} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary-700 hover:underline">
                              Open <ArrowRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Send report card */}
            <div className="flex flex-col gap-4">
              <div className="relative overflow-hidden rounded-2xl border border-primary-200 bg-gradient-to-br from-[#F3E8FF] via-[#FAF5FF] to-white p-5">
                <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary-300/30 blur-2xl" />
                <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-primary-600 text-white shadow-glow"><Send size={17} /></span>
                <h2 className="relative mt-4 text-[15px] font-semibold text-[#111827]">Send Report</h2>
                <p className="relative mt-1 text-[12.5px] leading-relaxed text-[#52525B]">
                  Reports are only emailed when you send them — never automatically. Recipient address is locked to the customer record.
                </p>
                <Link to="/admin/reports" className="relative mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-primary-700">
                  Send Email <ArrowRight size={14} />
                </Link>
                {stats.email && (
                  <p className="relative mt-2.5 text-[11px] leading-relaxed text-[#71717A]">
                    {stats.email.configured ? `Sender: ${stats.email.sender}` : 'Email is not configured on this deployment.'}
                  </p>
                )}
              </div>

              <div className="card card-pad">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.09em] text-[#71717A]">Average score</p>
                <p className="mt-1.5 font-display text-[34px] font-bold leading-none tabular-nums text-[#111827]">{stats.avgScore ?? '—'}</p>
                <p className="mt-1.5 text-[11.5px] text-[#71717A]">Last 50 completed reports</p>
                <div className="mt-4 space-y-2.5 border-t border-[#EAE8F2] pt-3.5 text-[12.5px]">
                  <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[#52525B]"><CheckCircle2 size={13} className="text-[#059669]" />Completed</span><span className="font-semibold tabular-nums text-[#111827]">{stats.audits.completed}</span></div>
                  <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[#52525B]"><Clock3 size={13} className="text-[#D97706]" />In flight</span><span className="font-semibold tabular-nums text-[#111827]">{stats.audits.pending}</span></div>
                  <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[#52525B]"><XCircle size={13} className="text-[#DC2626]" />Failed</span><span className="font-semibold tabular-nums text-[#111827]">{stats.audits.failed}</span></div>
                  <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[#52525B]"><Mail size={13} className="text-[#71717A]" />Email issues</span><span className="font-semibold tabular-nums text-[#111827]">{stats.unreadMailFailures}</span></div>
                </div>
                <Link to="/admin/emails" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:underline">Email delivery log <ArrowUpRight size={12} /></Link>
              </div>
            </div>
          </div>

          {stats.unreadMailFailures > 0 && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#D97706]" />
              <div className="text-[12.5px] leading-relaxed text-[#92400E]">
                <p className="font-semibold">{stats.unreadMailFailures} email {stats.unreadMailFailures === 1 ? 'attempt was' : 'attempts were'} not delivered</p>
                <p className="mt-0.5">Either the provider rejected the send or <code className="rounded bg-white/70 px-1">RESEND_API_KEY</code> is not configured. Reports are never marked as delivered unless the provider accepted them.</p>
                <Link to="/admin/emails" className="mt-1.5 inline-block font-semibold underline">Review delivery log</Link>
              </div>
            </div>
          )}

          <div className="card mt-4">
            <div className="flex items-center justify-between border-b border-[#EAE8F2] px-5 py-4">
              <h2 className="text-[15px] font-semibold text-[#111827]">Newest customers</h2>
              <Link to="/admin/customers" className="text-[12px] font-semibold text-primary-700 hover:text-primary-600">All customers →</Link>
            </div>
            {stats.recentCustomers.length === 0 ? <div className="p-0"><SkeletonRows rows={2} /></div> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[560px]">
                  <thead><tr className="border-b border-[#EAE8F2] bg-[#FAFAFC]">
                    <th className="table-head">Customer</th><th className="table-head">Company</th>
                    <th className="table-head">Verified</th><th className="table-head">Joined</th><th className="table-head" />
                  </tr></thead>
                  <tbody className="divide-y divide-[#EAE8F2]">
                    {stats.recentCustomers.map((c) => (
                      <tr key={c.id} className="transition hover:bg-[#FAF5FF]">
                        <td className="table-cell"><p className="font-medium text-[#111827]">{c.full_name}</p><p className="text-[11.5px] text-[#71717A]">{c.email}</p></td>
                        <td className="table-cell text-[#52525B]">{c.company || '—'}</td>
                        <td className="table-cell">{c.email_verified_at
                          ? <span className="chip bg-[#ECFDF5] text-[#059669]">verified</span>
                          : <span className="chip bg-[#FFFBEB] text-[#D97706]">pending</span>}</td>
                        <td className="table-cell whitespace-nowrap text-[#71717A]">{formatDate(c.created_at)}</td>
                        <td className="table-cell text-right"><Link to={`/admin/customers/${c.id}`} className="text-[12.5px] font-semibold text-primary-700 hover:underline">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { to: '/admin/enquiries', icon: ListChecks, t: 'Process the queue', d: 'Run audits, add notes, deliver PDFs.' },
              { to: '/admin/customers', icon: Users, t: 'Support a customer', d: 'Search accounts, review history, suspend abuse.' },
              { to: '/admin/emails', icon: Mail, t: 'Check delivery', d: 'Retry failed report emails with full logs.' },
            ].map((a) => (
              <Link key={a.t} to={a.to}
                className="group flex items-center gap-3 rounded-2xl border border-[#EAE8F2] bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-[0_16px_36px_-28px_rgba(124,58,237,.55)]">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F3E8FF] text-[#7C3AED] transition group-hover:bg-primary-600 group-hover:text-white"><a.icon size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-[#111827]">{a.t}</span><span className="block text-[11.5px] text-[#71717A]">{a.d}</span></span>
                <ArrowUpRight size={14} className="text-[#A1A1AA]" />
              </Link>
            ))}
          </div>
        </>
      )}
      <span className="sr-only"><Globe2 /> <Plus /></span>
    </div>
  )
}
