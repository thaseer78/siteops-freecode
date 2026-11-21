import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, ArrowUpRight, Bell, ChevronDown, FileBarChart2, LayoutDashboard, ListChecks,
  LogOut, Mail, Menu, ShieldCheck, Users, X, Globe2,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { api } from '../../lib/api'
import { Logo } from '../Brand'
import { initials } from '../../lib/format'

const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, min: 'admin' as const },
  { to: '/admin/enquiries', label: 'Audit requests', icon: ListChecks, min: 'admin' as const },
  { to: '/admin/customers', label: 'Customers', icon: Users, min: 'admin' as const },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart2, min: 'admin' as const },
  { to: '/admin/emails', label: 'Email logs', icon: Mail, min: 'admin' as const },
  { to: '/admin/logs', label: 'Activity logs', icon: Activity, min: 'admin' as const },
  { to: '/admin/staff', label: 'Team & roles', icon: ShieldCheck, min: 'admin' as const },
]
const rank = { support: 1, admin: 2, super_admin: 3 } as const
const roleLabel = { support: 'Support staff', admin: 'Administrator', super_admin: 'Super admin', customer: 'Customer' }

export default function AdminShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [pending, setPending] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setOpen(false); setMenu(false) }, [location.pathname])
  useEffect(() => {
    let alive = true
    const load = () => api.get<{ audits: { pending: number; failed: number } }>('/admin/stats')
      .then((r) => { if (alive) setPending((r.audits?.pending || 0)) }).catch(() => {})
    void load()
    const t = setInterval(load, 45_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!user) return null
  const visible = nav.filter((n) => rank[user.role as keyof typeof rank] >= rank[n.min])

  const body = (
    <>
      <div className="flex h-[70px] items-center justify-between border-b border-[#EAE8F2] px-5">
        <Link to="/admin" className="flex items-center gap-2.5" aria-label="SiteOps operations">
          <Logo />
          <span className="rounded-md border border-primary-200 bg-primary-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[.08em] text-primary-700">Admin</span>
        </Link>
        <button className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-900/5 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Operations navigation">
        {visible.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <item.icon size={17} strokeWidth={1.9} />
            <span className="flex-1">{item.label}</span>
            {item.label === 'Audit requests' && pending > 0 && (
              <span className="rounded-full bg-[#FFFBEB] px-1.5 py-0.5 text-[10.5px] font-bold text-[#D97706]">{pending}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mx-3 mb-3 rounded-xl border border-[#EAE8F2] bg-gradient-to-br from-primary-50 to-white p-3.5">
        <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.09em] text-primary-700">
          <Globe2 size={12} /> Shared backend
        </p>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-600">
          Same accounts and audit data as the customer portal and mobile app.
        </p>
        <Link to="/dashboard" className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary-700 hover:text-primary-600">
          Open customer view <ArrowUpRight size={12} />
        </Link>
      </div>
      <div className="border-t border-[#EAE8F2] p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-[12px] font-bold text-white">
            {initials(user.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-ink-900">{user.full_name}</p>
            <p className="truncate text-[11px] text-primary-700">{roleLabel[user.role]}</p>
          </div>
          <button onClick={async () => { await logout(); navigate('/admin/login') }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-ink-500 transition hover:bg-ink-900/5 hover:text-ink-900">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div data-theme="light" className="min-h-screen bg-[#F8F7FC]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(60%_50%_at_100%_0%,rgba(192,132,252,.14),transparent_60%)]" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-[#EAE8F2] bg-white lg:flex">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#111827]/35 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[272px] flex-col border-r border-[#EAE8F2] bg-white shadow-lift">{body}</aside>
        </div>
      )}
      <div className="relative z-10 lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[70px] items-center gap-3 border-b border-[#EAE8F2] bg-white/80 px-4 backdrop-blur-xl sm:px-6">
          <button className="rounded-lg p-2 text-ink-600 hover:bg-ink-900/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EAE8F2] bg-[#F8F7FC] px-2.5 py-1 text-[11px] font-semibold text-ink-600">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" /> Operations console
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Link to="/admin/enquiries" className="relative rounded-lg p-2 text-ink-600 transition hover:bg-ink-900/5" aria-label="Audit enquiries">
              <Bell size={18} />
              {pending > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#F59E0B] ring-2 ring-white" />}
            </Link>
            <div className="relative">
              <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition hover:bg-ink-900/5" aria-haspopup="menu" aria-expanded={menu}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-2.5 py-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-600 text-[10px] font-bold text-white">{initials(user.full_name)}</span>
                  <span className="text-[11px] font-semibold text-white">Admin</span>
                </span>
                <ChevronDown size={14} className="text-ink-500" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-60 animate-rise overflow-hidden rounded-xl border border-[#EAE8F2] bg-white shadow-lift" role="menu">
                    <div className="border-b border-[#EAE8F2] px-4 py-3">
                      <p className="truncate text-[13px] font-semibold text-ink-900">{user.full_name}</p>
                      <p className="truncate text-[11.5px] text-ink-500">{roleLabel[user.role]} · {user.email}</p>
                    </div>
                    <Link to="/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink-700 hover:bg-[#F8F7FC]" role="menuitem">
                      <Globe2 size={15} /> Customer portal
                    </Link>
                    <button onClick={async () => { await logout(); navigate('/admin/login') }}
                      className="flex w-full items-center gap-2.5 border-t border-[#EAE8F2] px-4 py-2.5 text-left text-[13px] text-ink-700 hover:bg-[#F8F7FC]" role="menuitem">
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>
      </div>
    </div>
  )
}
