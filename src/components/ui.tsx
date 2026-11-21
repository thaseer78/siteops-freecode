import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, ArrowRight, CheckCircle2, Info, Loader2, X, Inbox,
} from 'lucide-react'
import { scoreTone } from '../lib/format'

/* ── Toasts ─────────────────────────────────────────────────────────────── */
type Toast = { id: number; kind: 'success' | 'error' | 'info'; title: string; body?: string }
const ToastCtx = createContext<{ push: (t: Omit<Toast, 'id'>) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const counter = useRef(0)
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++counter.current
    setItems((s) => [...s, { ...t, id }])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 5200)
  }, [])
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div key={t.id}
            className="pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-lift">
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary-600" size={18} />
              : t.kind === 'error' ? <AlertCircle className="mt-0.5 shrink-0 text-red-600" size={18} />
                : <Info className="mt-0.5 shrink-0 text-primary-600" size={18} />}
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink-900">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-500">{t.body}</p>}
            </div>
            <button aria-label="Dismiss" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}
              className="rounded-md p-1 text-ink-500 hover:bg-ink-900/5"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

/* ── Buttons & primitives ───────────────────────────────────────────────── */
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden />
}

export function PageHeader({ title, subtitle, actions, eyebrow }: {
  title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-2 inline-flex rounded-full border border-line bg-primary-50 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[.08em] text-primary-700">{eyebrow}</p>}
        <h1 className="text-[26px] font-bold leading-tight tracking-[-.025em] text-ink-900 sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, hint, icon, accent }: {
  label: string; value: ReactNode; hint?: string; icon?: ReactNode; accent?: 'mint' | 'sky' | 'amber' | 'ink'
}) {
  const tint = {
    mint: 'bg-[#ECFDF5] text-[#059669]',
    sky: 'bg-[#F3E8FF] text-[#7C3AED]',
    amber: 'bg-[#FFFBEB] text-[#D97706]',
    ink: 'bg-[#F3E8FF] text-[#7C3AED]',
  }[accent || 'ink']
  return (
    <div className="card card-pad transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10.5px] font-semibold uppercase tracking-[.09em] text-ink-500">{label}</p>
        {icon && <span className={`grid h-9 w-9 place-items-center rounded-xl ${tint}`}>{icon}</span>}
      </div>
      <p className={`mt-3 font-display text-[30px] font-bold leading-none tracking-[-.02em] tabular-nums ${accent === 'mint' ? 'text-[#10B981]' : 'text-ink-900'}`}>{value}</p>
      {hint && <p className="mt-2 text-[12px] text-ink-500">{hint}</p>}
    </div>
  )
}

export function ScoreRing({ score, size = 96, stroke = 8, label }: { score: number | null; size?: number; stroke?: number; label?: string }) {
  const tone = scoreTone(score)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score))
  return (
    <div className="inline-flex flex-col items-center" aria-label={`${label || 'Score'}: ${score ?? 'not scored'}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone.ring} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
            style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.2,.7,.3,1)' }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display font-semibold text-ink-900" style={{ fontSize: size * 0.3 }}>{score ?? '—'}</span>
        </div>
      </div>
      {label && <span className="mt-1.5 text-[11.5px] font-medium text-ink-500">{label}</span>}
    </div>
  )
}

export function ScorePill({ score, label }: { score: number | null; label: string }) {
  const tone = scoreTone(score)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[13px] font-bold tabular-nums ${tone.bg} ${tone.text}`}>
        {score ?? '—'}
      </span>
      <span className="text-[12.5px] font-medium leading-tight text-ink-700">{label}</span>
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'mint' | 'amber' | 'red' | 'sky' }) {
  const map = {
    neutral: 'bg-ink-900/[.06] text-ink-600',
    mint: 'bg-[#ECFDF5] text-[#059669]',
    amber: 'bg-[#FFFBEB] text-[#D97706]',
    red: 'bg-[#FEF2F2] text-[#DC2626]',
    sky: 'bg-[#F3E8FF] text-[#7C3AED]',
  }
  return <span className={`chip ${map[tone]}`}>{children}</span>
}

export function Modal({ open, onClose, title, description, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; description?: string
  children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`animate-rise w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} rounded-t-2xl border border-line bg-surface shadow-lift sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[16.5px] font-semibold text-ink-900">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-ink-500">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-900/[.06] hover:text-ink-900"><X size={17} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 scrollbar-thin">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: {
  icon?: ReactNode; title: string; body: string; action?: { label: string; to?: string; onClick?: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3.5 grid h-12 w-12 place-items-center rounded-2xl bg-[#F3E8FF] text-[#7C3AED]">
        {icon || <Inbox size={22} />}
      </div>
      <h3 className="text-[15.5px] font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-500">{body}</p>
      {action && (action.to ? (
        <Link to={action.to} className="btn-primary mt-4">{action.label} <ArrowRight size={15} /></Link>
      ) : (
        <button className="btn-primary mt-4" onClick={action.onClick}>{action.label}</button>
      ))}
    </div>
  )
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="skeleton h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-2.5 w-1/2" />
          </div>
          <div className="skeleton h-6 w-16" />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#FEF2F2] text-[#DC2626]"><AlertCircle size={20} /></div>
      <p className="text-[14px] font-semibold text-ink-900">We couldn’t load this</p>
      <p className="mt-1 max-w-md text-[13px] text-ink-500">{message}</p>
      {onRetry && <button className="btn-ghost mt-4" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] text-[#DC2626]">
      <AlertCircle size={15} className="mt-0.5 shrink-0" /> <span>{message}</span>
    </div>
  )
}

export function Field({ label, hint, error, children, htmlFor }: {
  label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[12px] text-ink-500">{hint}</p>}
      {error && <p className="mt-1.5 text-[12px] text-red-600">{error}</p>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: Array<{ id: T; label: string; count?: number }>; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 scrollbar-thin" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
            value === t.id ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-500 hover:bg-ink-900/[.05] hover:text-ink-900'}`}>
          {t.label}{t.count != null && <span className={`ml-1.5 text-[11.5px] tabular-nums ${value === t.id ? 'text-white/70' : 'text-ink-500'}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, tone = '#7C3AED' }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900/[.08]">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: tone }} />
    </div>
  )
}
