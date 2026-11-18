import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { Logo } from '../Brand'

export function AuthLayout({ children, mode = 'customer', title, subtitle }: {
  children: ReactNode
  mode?: 'customer' | 'admin'
  title: string
  subtitle: string
}) {
  const isAdmin = mode === 'admin'
  const points = isAdmin
    ? ['Database-controlled roles', 'Every action written to the activity log', 'Customers can never self-promote']
    : ['Free first audit for every website', 'Branded PDF reports', 'Android & iOS app with the same account']
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.02fr_1fr]">
      <div className={`relative hidden flex-col justify-between overflow-hidden p-10 lg:flex ${isAdmin ? 'bg-[#0A101C]' : 'bg-ink-900'}`}>
        <div className="grid-noise absolute inset-0 opacity-70" />
        <div className="relative">
          <Link to={isAdmin ? '/admin/login' : '/'} aria-label="SiteOps"><Logo light /></Link>
          {isAdmin && (
            <span className="ml-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 align-middle text-[10.5px] font-semibold uppercase tracking-wider text-amber-200">
              <ShieldCheck size={11} /> Operations
            </span>
          )}
        </div>
        <div className="relative max-w-sm">
          <h2 className="font-display text-[32px] font-semibold leading-[1.12] tracking-[-.03em] text-white">
            {isAdmin ? 'Run website operations without cutting corners.' : 'From AI-built to business-ready.'}
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-white/55">
            {isAdmin
              ? 'Review customer requests, run real PageSpeed audits, deliver branded PDFs and keep a full audit trail of who did what.'
              : 'SiteOps keeps business websites fast, searchable and maintained — with measurements you can trust and fixes ranked by impact.'}
          </p>
          <ul className="mt-7 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[13px] text-white/70">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint-300" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[11.5px] leading-relaxed text-white/35">
          Audits are produced by Google Lighthouse via the PageSpeed Insights API. SiteOps does not claim
          security certification or penetration testing.
        </p>
      </div>

      <div className="flex flex-col bg-white">
        <div className="flex h-16 items-center justify-between px-5 lg:px-8">
          <div className="lg:hidden"><Link to={isAdmin ? '/admin/login' : '/'}><Logo /></Link></div>
          <div className="ml-auto text-[12.5px] text-ink-500">
            {isAdmin ? (
              <Link to="/login" className="font-medium text-ink-700 hover:text-ink-900">Customer sign in →</Link>
            ) : (
              <Link to="/admin/login" className="font-medium text-ink-700 hover:text-ink-900">Operations console →</Link>
            )}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <h1 className="font-display text-[26px] font-semibold tracking-[-.02em] text-ink-900">{title}</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </div>
        <div className="px-5 py-5 text-center text-[11.5px] text-ink-500 lg:px-8">
          © {new Date().getFullYear()} SiteOps · <a href="mailto:support@siteops.in" className="hover:text-ink-800">support@siteops.in</a>
        </div>
      </div>
    </div>
  )
}
