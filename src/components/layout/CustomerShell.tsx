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
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/websites', label: 'My websites', icon: Globe2 },
  { to: '/dashboard/requests', label: 'Audit requests', icon: ListChecks },
  { to: '/dashboard/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { to: '/dashboard/settings', label: 'Profile & settings', icon: Settings },
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
      <div className="flex h-[70px] items-center justify-between px-5">
        <Link to="/dashboard" aria-label="SiteOps home"><Logo light /></Link>
        <button className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>
      <div className="px-4 pb-3">
        <Link to="/dashboard/websites?add=1" className="btn w-full rounded-xl bg-primary-600 text-white shadow-glow hover:bg-primary-700">
          <Plus size={15} /> Add website
        </Link>
      </div>
      <nav className="mt-3 flex-1 space-y-1 px-3" aria-label="Main">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <item.icon size={17} strokeWidth={1.9} />
            <span className="flex-1">{item.label}</span>
            {item.label === 'Notifications' && unread > 0 && (
              <span className="rounded-full bg-primary-500 px-1.5 py-0.5 text-[10.5px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mx-3 mb-3 rounded-xl border border-[#262432] bg-gradient-to-br from-primary-600/[.18] to-transparent p-3.5">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[.09em] text-primary-300">
          <ShieldCheck size={13} /> Ops partner
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#A1A1AA]">
          Need repairs or ongoing maintenance? Reply to any report email and our team picks it up.
        </p>
      </div>
      <div className="border-t border-[#262432] p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-600/20 text-[12px] font-bold text-primary-300">
            {initials(user?.full_name || 'SiteOps')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-white">{user?.full_name}</p>
            <p className="truncate text-[11px] text-[#A1A1AA]">{user?.email}</p>
          </div>
          <button onClick={async () => { await logout(); navigate('/') }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-white/40 transition hover:bg-white/10 hover:text-white">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div data-theme="dark" className="min-h-screen bg-plum-900 text-[#A1A1AA]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-[#262432] bg-plum-800 lg:flex">{SidebarBody}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[272px] flex-col border-r border-[#262432] bg-plum-800 shadow-lift">{SidebarBody}</aside>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[70px] items-center gap-3 border-b border-[#262432] bg-plum-900/85 px-4 backdrop-blur-xl sm:px-6">
          <button className="rounded-lg p-2 text-[#A1A1AA] hover:bg-white/[.06] hover:text-white lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={19} />
          </button>
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-[12.5px] text-[#A1A1AA]">
              {greeting}, <span className="font-semibold text-white">{user?.full_name?.split(' ')[0]}</span>
              {user?.company ? <span className="text-[#71717A]"> · {user.company}</span> : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Link to="/dashboard/notifications" className="relative rounded-lg p-2 text-[#A1A1AA] transition hover:bg-white/[.06] hover:text-white" aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary-400 ring-2 ring-plum-900" />}
            </Link>
            <div className="relative">
              <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition hover:bg-white/[.06]" aria-haspopup="menu" aria-expanded={menu}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-[11.5px] font-bold text-white">
                  {initials(user?.full_name || 'S')}
                </span>
                <ChevronDown size={14} className="text-[#71717A]" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-60 animate-rise overflow-hidden rounded-xl border border-[#262432] bg-plum-800 shadow-lift" role="menu">
                    <div className="border-b border-[#262432] px-4 py-3">
                      <p className="truncate text-[13px] font-semibold text-white">{user?.full_name}</p>
                      <p className="truncate text-[11.5px] text-[#A1A1AA]">{user?.email}</p>
                    </div>
                    <Link to="/dashboard/settings" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#D4D4D8] hover:bg-white/[.05] hover:text-white" role="menuitem">
                      <UserRound size={15} /> Profile & settings
                    </Link>
                    {user?.role !== 'customer' && (
                      <Link to="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#D4D4D8] hover:bg-white/[.05] hover:text-white" role="menuitem">
                        <ShieldCheck size={15} /> Operations console
                      </Link>
                    )}
                    <button onClick={async () => { await logout(); navigate('/') }}
                      className="flex w-full items-center gap-2.5 border-t border-[#262432] px-4 py-2.5 text-left text-[13px] text-[#D4D4D8] hover:bg-white/[.05] hover:text-white" role="menuitem">
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
