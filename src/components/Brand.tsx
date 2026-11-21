import { Link } from 'react-router-dom'
import { footerColumns } from './landing/data'

/* Rounded-square violet badge + wordmark. `light` keeps the wordmark white. */
export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-primary-600 shadow-[0_6px_18px_-6px_rgba(124,58,237,.9)]">
        <svg viewBox="0 0 32 32" width="19" height="19" aria-hidden>
          <path d="M7 22c0-5 3.6-7.4 9-7.4s9 2.4 9 7.4" stroke="#FFFFFF" strokeWidth="3.1" fill="none" strokeLinecap="round" />
          <circle cx="16" cy="9.4" r="2.4" fill="#FFFFFF" />
        </svg>
      </span>
      {!compact && (
        <span className={`font-display text-[17px] font-bold tracking-[-.025em] ${light ? 'text-white' : 'text-ink-900'}`}>
          SiteOps
        </span>
      )}
    </span>
  )
}

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`grid h-10 w-10 place-items-center rounded-xl bg-primary-600 ${className}`}>
      <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden>
        <path d="M7 22c0-5 3.6-7.4 9-7.4s9 2.4 9 7.4" stroke="#FFFFFF" strokeWidth="3.1" fill="none" strokeLinecap="round" />
        <circle cx="16" cy="9.4" r="2.4" fill="#FFFFFF" />
      </svg>
    </span>
  )
}

/* Real icons, not letter placeholders. Single-colour paths so they inherit
   `currentColor` and stay legible on obsidian. */
const SOCIALS = [
  {
    label: 'SiteOps on LinkedIn',
    href: 'https://www.linkedin.com/', // TODO: real company profile URL
    path: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C21.4 8.65 22 11 22 14.1V21h-4v-6.1c0-1.46-.03-3.33-2.03-3.33-2.03 0-2.34 1.59-2.34 3.23V21h-4V9Z',
  },
  {
    label: 'SiteOps on X',
    href: 'https://x.com/', // TODO: real profile URL
    path: 'M17.3 3h3.1l-6.8 7.8L21.7 21h-6.2l-4.9-6.3L4.9 21H1.8l7.3-8.3L2.1 3h6.4l4.4 5.8L17.3 3Zm-1.1 16h1.7L7.9 4.8H6.1L16.2 19Z',
  },
  {
    label: 'SiteOps on Instagram',
    href: 'https://www.instagram.com/', // TODO: real profile URL
    path: 'M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.23 1 .5 1.5.95.45.45.72.9.95 1.5.17.4.36 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2-.23.6-.5 1-.95 1.5-.45.45-.9.72-1.5.95-.4.17-1 .36-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42a4 4 0 0 1-1.5-.95 4 4 0 0 1-.95-1.5c-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.23-.6.5-1 .95-1.5.45-.45.9-.72 1.5-.95.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 5.1a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.75a3.05 3.05 0 1 1 0-6.1 3.05 3.05 0 0 1 0 6.1Zm6-7.95a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z',
  },
]

/**
 * Desktop footer: brand block plus Product / Company / Legal columns and a
 * support column, then company details with GSTIN and address placeholders.
 * The operator console is deliberately not linked from the public site.
 */
export function FooterLinks() {
  return (
    <footer className="border-t border-white/[.08] bg-[#0A0712]">
      <div className="shell py-14 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-5">
            <Logo light />
            <p className="mt-4 max-w-[38ch] text-[14px] leading-relaxed text-[#B9B5C6]">
              Website operations for Indian businesses. Audit, fix and maintain the sites your business runs
              on.
            </p>
            <p className="mt-4 max-w-[40ch] text-[14px] leading-relaxed text-[#948FA6]">
              <span className="font-semibold text-[#C4B5FD]">TODO</span> legal entity name ·{' '}
              <span className="font-semibold text-[#C4B5FD]">TODO</span> GSTIN
              <br />
              <span className="font-semibold text-[#C4B5FD]">TODO</span> registered address
            </p>
            <div className="mt-5 flex gap-2.5">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-[#C4C2CE] transition-colors hover:border-primary-400/70 hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((col) => (
            <nav key={col.heading} aria-label={col.heading} className="lg:col-span-2">
              <p className="text-[12.5px] font-semibold uppercase tracking-[.1em] text-[#A9A6B8]">{col.heading}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.href} className="inline-flex min-h-[28px] items-center py-1 text-[14px] text-[#C4C2CE] transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="lg:col-span-1">
            <p className="text-[12.5px] font-semibold uppercase tracking-[.1em] text-[#A9A6B8]">Support</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href="mailto:support@siteops.in"
                  className="inline-flex min-h-[28px] items-center break-all py-1 text-[14px] text-[#C4C2CE] transition-colors hover:text-white"
                >
                  support@siteops.in
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/[.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-[#A9A6B8]">
            © {new Date().getFullYear()} SiteOps · From AI-built to business-ready.
          </p>
          <p className="max-w-[52ch] text-[14px] leading-relaxed text-[#948FA6]">
            Audits use Google PageSpeed Insights. No security certification is claimed.
          </p>
        </div>
      </div>
    </footer>
  )
}
