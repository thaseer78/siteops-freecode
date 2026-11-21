import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Logo } from '../Brand'
import { useAuth } from '../../lib/auth'
import { useScrolledPast } from './motion'

const LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

/**
 * Landing navbar.
 *
 * Desktop (md+): brand left, section links inline, account actions right.
 * Mobile: brand left, `Start free` still visible, everything else moves into a
 * right-hand drawer. The drawer traps Tab, closes on Escape or scrim click,
 * and returns focus to the trigger — `aria-expanded` / `aria-controls` are wired
 * to the same ids the drawer uses.
 */
export default function LandingNav() {
  const { user } = useAuth()
  const location = useLocation()
  const scrolled = useScrolledPast(40)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  // Route changes (e.g. tapping "Sign in") must not leave the drawer open.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  // Escape to close, and keep Tab inside the drawer while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    // Focus the first control so keyboard users land inside the drawer.
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('a[href], button')?.focus()
    }, 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open, close])

  // Lock background scrolling while the drawer is open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const dashboardHref = user ? (user.role === 'customer' ? '/dashboard' : '/admin') : null

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b bg-obsidian/85 border-white/[.06] transition-colors duration-300 ${
          scrolled ? 'nav-scrolled' : ''
        }`}
      >
        <div className="shell flex h-16 items-center gap-6 lg:h-[72px]">
          <Link to="/" aria-label="SiteOps home" className="shrink-0">
            <Logo light />
          </Link>

          <nav aria-label="Sections" className="ml-4 hidden items-center gap-7 lg:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-md py-2 text-[14px] font-medium text-[#C4C2CE] transition-colors hover:text-white focus-visible:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {dashboardHref ? (
              <Link
                to={dashboardHref}
                className="pill-cta bg-primary-600 px-4 text-[14px] text-white hover:bg-primary-700 focus-visible:outline-none"
              >
                Open dashboard <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden rounded-full px-3 py-2 text-[14px] font-medium text-[#C4C2CE] transition-colors hover:text-white sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="pill-cta bg-primary-600 px-4 text-[14px] text-white shadow-glow transition-colors hover:bg-primary-700 sm:px-5"
                >
                  Start free <ArrowRight size={15} />
                </Link>
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-expanded={open}
                  aria-controls="landing-mobile-drawer"
                  aria-label="Open menu"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white transition-colors hover:border-white/35 hover:bg-white/[.06] lg:hidden"
                >
                  <Menu size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Drawer — rendered only when open, so it never adds layout or tab stops. */}
      {open && (
        <div className="fixed inset-0 z-[55] lg:hidden" role="presentation">
          <div
            className="drawer-scrim absolute inset-0 bg-black/65"
            data-open={open}
            onClick={close}
            aria-hidden="true"
          />
          <div
            id="landing-mobile-drawer"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            data-open={open}
            className="drawer-panel absolute inset-y-0 right-0 flex w-[86%] max-w-[340px] flex-col border-l border-white/10 bg-[#120E1D] px-5 pb-6 pt-4 shadow-[-30px_0_60px_-40px_rgba(0,0,0,.9)]"
          >
            <div className="flex items-center justify-between">
              <Logo light />
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white transition-colors hover:border-white/35 hover:bg-white/[.06]"
              >
                <X size={18} />
              </button>
            </div>

            <nav aria-label="Sections" className="mt-8 flex flex-col">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-3.5 text-[16px] font-medium text-[#D6D4DE] transition-colors hover:bg-white/[.05] hover:text-white"
                >
                  {l.label}
                </a>
              ))}
            </nav>

            <div className="mt-6 border-t border-white/10 pt-5">
              {dashboardHref ? (
                <Link
                  to={dashboardHref}
                  className="pill-cta w-full bg-primary-600 text-[15px] text-white hover:bg-primary-700"
                  onClick={() => setOpen(false)}
                >
                  Open dashboard <ArrowRight size={15} />
                </Link>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="pill-cta w-full border border-white/20 text-[15px] text-white hover:bg-white/[.06]"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setOpen(false)}
                    className="pill-cta w-full bg-primary-600 text-[15px] text-white hover:bg-primary-700"
                  >
                    Start free <ArrowRight size={15} />
                  </Link>
                </div>
              )}
            </div>

            <p className="mt-auto pt-6 text-[12.5px] leading-relaxed text-[#A9A6B8]">
              Audits use Google PageSpeed Insights. No security certification is claimed.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
