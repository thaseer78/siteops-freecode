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

/* Semantic status palette: emerald = healthy, amber = needs attention,
   rose = critical. No fabricated scores — only the tone of a measured value. */
export const scoreTone = (score: number | null | undefined) => {
  if (score == null) return { text: 'text-ink-500', bg: 'bg-ink-900/[.06]', ring: '#A1A1AA', label: 'Not scored' }
  if (score >= 90) return { text: 'text-[#059669]', bg: 'bg-[#ECFDF5]', ring: '#10B981', label: 'Excellent' }
  if (score >= 70) return { text: 'text-[#047857]', bg: 'bg-[#ECFDF5]', ring: '#34D399', label: 'Good' }
  if (score >= 50) return { text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', ring: '#F59E0B', label: 'Needs work' }
  return { text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', ring: '#EF4444', label: 'Poor' }
}

export const statusTone: Record<string, { chip: string; label: string; dot: string }> = {
  pending: { chip: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]', label: 'Pending', dot: 'bg-[#F59E0B]' },
  running: { chip: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]', label: 'Running', dot: 'bg-[#F59E0B] animate-pulse' },
  in_progress: { chip: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]', label: 'In progress', dot: 'bg-[#F59E0B] animate-pulse' },
  completed: { chip: 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]', label: 'Completed', dot: 'bg-[#10B981]' },
  failed: { chip: 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]', label: 'Failed', dot: 'bg-[#EF4444]' },
  cancelled: { chip: 'bg-ink-900/[.06] text-ink-600 border border-ink-900/10', label: 'Cancelled', dot: 'bg-ink-400' },
  sent: { chip: 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]', label: 'Sent', dot: 'bg-[#10B981]' },
  not_configured: { chip: 'bg-ink-900/[.06] text-ink-600 border border-ink-900/10', label: 'Not configured', dot: 'bg-ink-400' },
  queued: { chip: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]', label: 'Queued', dot: 'bg-[#F59E0B]' },
}

export const severityTone: Record<string, string> = {
  Critical: 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]',
  High: 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]',
  Medium: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
}

export const severityDot: Record<string, string> = {
  Critical: '#EF4444',
  High: '#EF4444',
  Medium: '#F59E0B',
  Low: '#10B981',
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
