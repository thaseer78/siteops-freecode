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
    <div data-theme="dark" className="relative grid min-h-screen bg-obsidian lg:grid-cols-[1.02fr_1fr]">
      {/* ambient violet glow behind the whole screen */}
      <div className="pointer-events-none absolute inset-0 plum-glow opacity-90" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-primary-600/20 blur-[130px]" />

      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[.06] p-10 lg:flex">
        <div className="relative">
          <Link to={isAdmin ? '/admin/login' : '/'} aria-label="SiteOps"><Logo light /></Link>
          {isAdmin && (
            <span className="ml-3 inline-flex items-center gap-1.5 rounded-full border border-primary-400/25 bg-primary-400/10 px-2.5 py-1 align-middle text-[10px] font-semibold uppercase tracking-[.08em] text-primary-300">
              <ShieldCheck size={11} /> Operations
            </span>
          )}
        </div>
        <div className="relative max-w-sm">
          <h2 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-.03em] text-white">
            {isAdmin ? 'Run website operations without cutting corners.' : 'From AI-built to business-ready.'}
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-[#A1A1AA]">
            {isAdmin
              ? 'Review customer requests, run real PageSpeed audits, deliver branded PDFs and keep a full audit trail of who did what.'
              : 'SiteOps keeps business websites fast, searchable and maintained — with measurements you can trust and fixes ranked by impact.'}
          </p>
          <ul className="mt-7 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[13px] text-[#D4D4D8]">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary-300" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[11.5px] leading-relaxed text-white/30">
          Audits are produced by Google Lighthouse via the PageSpeed Insights API. SiteOps does not claim
          security certification or penetration testing.
        </p>
      </div>

      <div className="relative flex flex-col">
        <div className="flex h-16 items-center justify-between px-5 lg:hidden">
          <Link to={isAdmin ? '/admin/login' : '/'} aria-label="SiteOps"><Logo light /></Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="rounded-2xl border border-white/[.08] bg-[#16151E]/90 p-6 shadow-[0_40px_90px_-40px_rgba(0,0,0,.95)] backdrop-blur sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <span className="hidden lg:block"><Logo light /></span>
                <span className="ml-auto text-[12px] text-[#A1A1AA]">
                  {isAdmin ? (
                    <Link to="/login" className="font-medium text-[#C084FC] transition hover:text-white">Customer sign in →</Link>
                  ) : (
                    <Link to="/admin/login" className="font-medium text-[#C084FC] transition hover:text-white">Operations console →</Link>
                  )}
                </span>
              </div>
              <h1 className="font-display text-[26px] font-bold tracking-[-.025em] text-white">{title}</h1>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#A1A1AA]">{subtitle}</p>
              <div className="mt-7">{children}</div>
            </div>
          </div>
        </div>
        <div className="px-5 py-5 text-center text-[11.5px] text-white/30 lg:px-8">
          © {new Date().getFullYear()} SiteOps · <a href="mailto:support@siteops.in" className="transition hover:text-white/60">support@siteops.in</a>
        </div>
      </div>
    </div>
  )
}
