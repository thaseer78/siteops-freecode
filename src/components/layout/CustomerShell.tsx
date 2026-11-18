import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, ChevronDown, FileBarChart2, Globe2, LayoutDashboard, ListChecks, LogOut, Menu,
  Settings, ShieldCheck, UserRound, X, Plus,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { api } from '../../lib/api'
import { Logo } from '../Brand'
import { initials } from '../../lib/format'

const nav = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/websites', label: 'Websites', icon: Globe2 },
  { to: '/app/audits', label: 'Audits', icon: ListChecks },
  { to: '/app/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/profile', label: 'Profile & settings', icon: Settings },
]

export default function CustomerShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [unread, setUnread] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setOpen(false); setMenu(false) }, [location.pathname])
  useEffect(() => {
    let alive = true
    const load = () => api.get<{ unread: number }>('/notifications')
      .then((r) => { if (alive) setUnread(r.unread) }).catch(() => {})
    void load()
    const t = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [location.pathname])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const SidebarBody = (
    <>
      <div className="flex h-16 items-center justify-between px-5">
        <Link to="/app" aria-label="SiteOps home"><Logo light /></Link>
        <button className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>
      <div className="px-4 pb-2">
        <Link to="/app/websites?add=1" className="btn w-full bg-white/10 text-white hover:bg-white/[.16]">
          <Plus size={15} /> Add website
        </Link>
      </div>
      <nav className="mt-2 flex-1 space-y-1 px-3" aria-label="Main">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <item.icon size={17} strokeWidth={1.9} />
            <span className="flex-1">{item.label}</span>
            {item.label === 'Notifications' && unread > 0 && (
              <span className="rounded-full bg-mint-500 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-950">{unread > 9 ? '9+' : unread}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/[.04] p-3.5">
        <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wider text-mint-300">
          <ShieldCheck size={13} /> Ops partner
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
          Need repairs or ongoing maintenance? Reply to any report email and our team picks it up.
        </p>
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-500/15 text-[12.5px] font-bold text-mint-300">
            {initials(user?.full_name || 'SiteOps')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{user?.full_name}</p>
            <p className="truncate text-[11.5px] text-white/50">{user?.email}</p>
          </div>
          <button onClick={async () => { await logout(); navigate('/') }} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#F6F8FC]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-ink-900 lg:flex">{SidebarBody}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[272px] flex-col bg-ink-900 shadow-lift">{SidebarBody}</aside>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-900/[.07] bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <button className="rounded-lg p-2 text-ink-600 hover:bg-ink-900/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={19} />
          </button>
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-[13px] text-ink-500">
              {greeting}, <span className="font-semibold text-ink-800">{user?.full_name?.split(' ')[0]}</span>
              {user?.company ? ` · ${user.company}` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Link to="/app/notifications" className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-900/5" aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-mint-500 ring-2 ring-white" />}
            </Link>
            <div className="relative">
              <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 hover:bg-ink-900/5" aria-haspopup="menu" aria-expanded={menu}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-900 text-[11.5px] font-bold text-mint-300">
                  {initials(user?.full_name || 'S')}
                </span>
                <ChevronDown size={14} className="text-ink-500" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-60 animate-rise overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-lift" role="menu">
                    <div className="border-b border-ink-900/[.07] px-4 py-3">
                      <p className="truncate text-[13px] font-semibold text-ink-900">{user?.full_name}</p>
                      <p className="truncate text-[12px] text-ink-500">{user?.email}</p>
                    </div>
                    <Link to="/app/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink-700 hover:bg-ink-900/[.04]" role="menuitem">
                      <UserRound size={15} /> Profile & settings
                    </Link>
                    {user?.role !== 'customer' && (
                      <Link to="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink-700 hover:bg-ink-900/[.04]" role="menuitem">
                        <ShieldCheck size={15} /> Operations console
                      </Link>
                    )}
                    <button onClick={async () => { await logout(); navigate('/') }}
                      className="flex w-full items-center gap-2.5 border-t border-ink-900/[.06] px-4 py-2.5 text-left text-[13px] text-ink-700 hover:bg-ink-900/[.04]" role="menuitem">
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
