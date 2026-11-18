import { Link } from 'react-router-dom'

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-ink-900">
        <svg viewBox="0 0 32 32" width="19" height="19" aria-hidden>
          <path d="M7 22c0-5 3.6-7.4 9-7.4s9 2.4 9 7.4" stroke="#34D3A4" strokeWidth="3.1" fill="none" strokeLinecap="round" />
          <circle cx="16" cy="9.4" r="2.4" fill="#34D3A4" />
        </svg>
      </span>
      {!compact && (
        <span className={`font-display text-[17px] font-semibold tracking-[-.02em] ${light ? 'text-white' : 'text-ink-900'}`}>
          SiteOps
        </span>
      )}
    </span>
  )
}

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`grid h-10 w-10 place-items-center rounded-xl bg-ink-900 ${className}`}>
      <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden>
        <path d="M7 22c0-5 3.6-7.4 9-7.4s9 2.4 9 7.4" stroke="#34D3A4" strokeWidth="3.1" fill="none" strokeLinecap="round" />
        <circle cx="16" cy="9.4" r="2.4" fill="#34D3A4" />
      </svg>
    </span>
  )
}

export function FooterLinks() {
  return (
    <footer className="border-t border-ink-900/[.07] bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-500">
            Website operations for Indian businesses. Audit, fix and maintain the sites your business runs on.
          </p>
        </div>
        <div>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-ink-500">Product</p>
          <ul className="space-y-2 text-[13.5px] text-ink-600">
            <li><Link className="hover:text-ink-900" to="/#services">Services</Link></li>
            <li><Link className="hover:text-ink-900" to="/#how">How it works</Link></li>
            <li><Link className="hover:text-ink-900" to="/login">Customer sign in</Link></li>
            <li><Link className="hover:text-ink-900" to="/register">Create account</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-ink-500">Company</p>
          <ul className="space-y-2 text-[13.5px] text-ink-600">
            <li><Link className="hover:text-ink-900" to="/#pricing">Plans</Link></li>
            <li><Link className="hover:text-ink-900" to="/#faq">FAQ</Link></li>
            <li><a className="hover:text-ink-900" href="mailto:support@siteops.in">support@siteops.in</a></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-ink-500">Access</p>
          <ul className="space-y-2 text-[13.5px] text-ink-600">
            <li><Link className="hover:text-ink-900" to="/admin/login">Operations console</Link></li>
          </ul>
          <p className="mt-4 text-[11.5px] leading-relaxed text-ink-500">
            Audits use Google PageSpeed Insights. No security certification is claimed.
          </p>
        </div>
      </div>
      <div className="border-t border-ink-900/[.06] px-5 py-5 text-center text-[12px] text-ink-500">
        © {new Date().getFullYear()} SiteOps · From AI-built to business-ready.
      </div>
    </footer>
  )
}
