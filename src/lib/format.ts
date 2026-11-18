export function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime()
  if (Number.isNaN(d)) return '—'
  const diff = Date.now() - d
  if (diff < 60_000) return 'just now'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

export const scoreTone = (score: number | null | undefined) => {
  if (score == null) return { text: 'text-ink-500', bg: 'bg-ink-900/[.05]', ring: '#8697B0', label: 'Not scored' }
  if (score >= 90) return { text: 'text-mint-700', bg: 'bg-mint-50', ring: '#0E9673', label: 'Excellent' }
  if (score >= 70) return { text: 'text-sky-600', bg: 'bg-sky-50', ring: '#2E55C8', label: 'Good' }
  if (score >= 50) return { text: 'text-amber-700', bg: 'bg-amber-50', ring: '#C2760A', label: 'Needs work' }
  return { text: 'text-red-700', bg: 'bg-red-50', ring: '#C03A2B', label: 'Poor' }
}

export const statusTone: Record<string, { chip: string; label: string; dot: string }> = {
  pending: { chip: 'bg-amber-50 text-amber-800 border border-amber-200/70', label: 'Pending', dot: 'bg-amber-500' },
  running: { chip: 'bg-sky-50 text-sky-700 border border-sky-200/70', label: 'Running', dot: 'bg-sky-500 animate-pulse' },
  completed: { chip: 'bg-mint-50 text-mint-700 border border-mint-200/70', label: 'Completed', dot: 'bg-mint-500' },
  failed: { chip: 'bg-red-50 text-red-700 border border-red-200/70', label: 'Failed', dot: 'bg-red-500' },
  cancelled: { chip: 'bg-ink-900/[.05] text-ink-600 border border-ink-900/10', label: 'Cancelled', dot: 'bg-ink-400' },
  sent: { chip: 'bg-mint-50 text-mint-700 border border-mint-200/70', label: 'Sent', dot: 'bg-mint-500' },
  not_configured: { chip: 'bg-ink-900/[.05] text-ink-600 border border-ink-900/10', label: 'Not configured', dot: 'bg-ink-400' },
}

export function prettyHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'S'

export const categoryLabel: Record<string, string> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best practices',
  seo: 'SEO',
}
