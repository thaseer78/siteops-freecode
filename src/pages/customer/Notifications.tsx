import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellOff, CheckCheck, FileBarChart2, ShieldCheck, ListChecks } from 'lucide-react'
import { api } from '../../lib/api'
import type { Notification } from '../../lib/types'
import { EmptyState, ErrorState, PageHeader, SkeletonRows, useToast } from '../../components/ui'
import { timeAgo } from '../../lib/format'

const iconFor = (type: string) => {
  if (type === 'report') return FileBarChart2
  if (type === 'audit') return ListChecks
  if (type === 'account') return ShieldCheck
  return Bell
}

export default function NotificationsPage() {
  const { push } = useToast()
  const [items, setItems] = useState<Notification[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.get<{ notifications: Notification[]; unread: number }>('/notifications')
      .then((r) => { setItems(r.notifications); setUnread(r.unread) })
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  async function markAll() {
    try {
      await api.post('/notifications/read-all')
      push({ kind: 'success', title: 'All caught up', body: 'Notifications marked as read.' })
      load()
    } catch (e) { push({ kind: 'error', title: 'Could not update', body: (e as Error).message }) }
  }

  async function markOne(n: Notification) {
    if (n.read_at) return
    try { await api.post(`/notifications/${n.id}/read`); load() } catch { /* non-critical */ }
  }

  return (
    <div>
      <PageHeader eyebrow="Notifications" title="Your notifications"
        subtitle="Audit updates, report deliveries and account messages. All in-app alerts appear here."
        actions={unread > 0 && <button className="btn-ghost" onClick={markAll}><CheckCheck size={14} /> Mark all read</button>} />

      {error && <div className="card"><ErrorState message={error} onRetry={load} /></div>}
      {!error && items === null && <div className="card"><SkeletonRows rows={5} /></div>}
      {items && items.length === 0 && (
        <div className="card"><EmptyState icon={<BellOff size={22} />} title="No notifications yet"
          body="Request an audit and your status updates will appear here." action={{ label: 'Go to websites', to: '/dashboard/websites' }} /></div>
      )}
      {items && items.length > 0 && (
        <div className="card divide-y divide-ink-900/[.06]">
          {items.map((n) => {
            const Icon = iconFor(n.type)
            const unreadItem = !n.read_at
            return (
              <Link key={n.id} to={n.link || '/dashboard/notifications'} onClick={() => markOne(n)}
                className={`flex items-start gap-3.5 px-4 py-4 transition hover:bg-surface2 sm:px-5 ${unreadItem ? 'bg-primary-50/30' : ''}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${unreadItem ? 'bg-primary-100 text-primary-700' : 'bg-ink-900/[.045] text-ink-500'}`}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-[13.5px] ${unreadItem ? 'font-semibold text-ink-900' : 'font-medium text-ink-800'}`}>{n.title}</p>
                    <span className="shrink-0 text-[11px] text-ink-500">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{n.body}</p>
                </div>
                {unreadItem && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-label="Unread" />}
              </Link>
            )
          })}
        </div>
      )}
      <p className="mt-4 text-center text-[11.5px] text-ink-500">
        Email preferences are managed in <Link to="/dashboard/settings" className="font-medium underline">Profile & settings</Link>.
        Push notifications require the SiteOps mobile app.
      </p>
    </div>
  )
}
