import dns from 'node:dns/promises'
import net from 'node:net'
import { all, one, run, id, now } from './db.mjs'

/* ── Google PageSpeed Insights ──────────────────────────────────────────────
   Real measurements only. Every score comes from the API response; nothing is
   invented or extrapolated. Docs: developers.google.com/speed/docs/insights/v5 */
const AUDIT_CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const METRIC_IDS = [
  'first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time',
  'cumulative-layout-shift', 'speed-index',
]
const apiKey = () => process.env.GOOGLE_PAGESPEED_API_KEY || process.env.PAGESPEED_API_KEY || ''

/* ── SSRF protection ───────────────────────────────────────────────────────
   A user supplies the URL, so it is treated as hostile input. We reject local
   names and IP literals, then resolve DNS and reject any private/reserved
   address, which stops hostnames that point at internal infrastructure. */
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa', '.lan', '.intranet']

export function isPrivateAddress(ip) {
  if (!net.isIP(ip)) return true
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a === 192 && b === 0) return true // 192.0.0.0/24 + 192.0.2.0/24 docs
    if (a === 198 && (b === 18 || b === 19)) return true
    if (a >= 224) return true // multicast, reserved, broadcast
    return false
  }
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true // fc00::/7 unique local
  if (lower.startsWith('fe80:')) return true // link local
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7)) // IPv4-mapped
  if (lower.startsWith('ff')) return true // multicast
  return false
}

/** Check the URL's literal host. Throws an Error with a user-safe message. */
export function assertPublicHost(url) {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('Enter a valid website URL, e.g. https://example.com') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http and https URLs can be audited.')
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!host) throw new Error('Enter a valid website URL, e.g. https://example.com')
  if (host === 'localhost' || net.isIP(host)) {
    throw new Error('Private and local network addresses cannot be audited.')
  }
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s)) || !host.includes('.')) {
    throw new Error('This hostname is not a public website.')
  }
  return host
}

/** Resolve DNS and confirm the site does not point at internal infrastructure. */
export async function assertPublicDns(url) {
  const host = assertPublicHost(url)
  let addresses = []
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true })
  } catch (err) {
    throw new Error(`We could not resolve ${host}. Check the domain name and try again.`)
  }
  if (!addresses.length) throw new Error(`We could not resolve ${host}. Check the domain name and try again.`)
  const bad = addresses.find((a) => isPrivateAddress(a.address))
  if (bad) throw new Error('This domain resolves to a private network address and cannot be audited.')
  return { host, addresses }
}

export async function runPageSpeed(url, strategy = 'mobile', timeoutMs = 110000) {
  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  api.searchParams.set('url', url)
  api.searchParams.set('strategy', strategy)
  for (const c of AUDIT_CATEGORIES) api.searchParams.append('category', c)
  if (apiKey()) api.searchParams.set('key', apiKey())

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res, json
  try {
    res = await fetch(api, { signal: ctrl.signal })
    json = await res.json().catch(() => null)
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? `PageSpeed Insights timed out after ${Math.round(timeoutMs / 1000)} seconds on ${strategy}. The site may be slow or unreachable.`
      : `Could not reach PageSpeed Insights: ${err.message}`
    throw new Error(msg)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const detail = json?.error?.message || `HTTP ${res.status}`
    throw new Error(`PageSpeed Insights could not audit this URL (${strategy}): ${detail}`)
  }
  return json
}

const pct = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) : null)

export function severityFor(score) {
  if (typeof score !== 'number') return 'Medium'
  if (score < 0.5) return 'Critical'
  if (score < 0.7) return 'High'
  return 'Medium'
}

/** Trim Lighthouse prose and markdown links for display. */
const plain = (text, max = 400) =>
  String(text || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * Turn one raw PSI payload into normalised measurements: category scores, Core
 * Web Vitals, non-passing audits as findings with severity, and recommendations.
 */
export function normaliseStrategy(raw, { url, strategy }) {
  if (!raw?.lighthouseResult) {
    throw new Error(`PageSpeed Insights returned no Lighthouse result for the ${strategy} run.`)
  }
  const lh = raw.lighthouseResult
  const cats = lh.categories || {}
  const audits = lh.audits || {}
  const score = (key) => pct(cats[key]?.score)

  const findings = []
  for (const [catKey, cat] of Object.entries(cats)) {
    for (const ref of cat.auditRefs || []) {
      const a = audits[ref.id]
      if (!a) continue
      const nonPassing = a.score !== null && a.score !== undefined && a.score < 0.9
      if (!nonPassing) continue
      findings.push({
        id: `${strategy}:${ref.id}`,
        audit_id: ref.id,
        category: catKey,
        strategy,
        severity: severityFor(a.score),
        title: plain(a.title, 160).replace(/\[|\]/g, ''),
        description: plain(a.description, 500),
        display_value: a.displayValue || '',
        score: a.score,
        weight: ref.weight || 0,
        savings_ms: a.details?.overallSavingsMs ?? null,
        savings_bytes: a.details?.overallSavingsBytes ?? null,
      })
    }
  }
  findings.sort((a, b) =>
    (b.weight * (1 - (b.score ?? 0)) + (b.savings_ms || 0) / 60000) -
    (a.weight * (1 - (a.score ?? 0)) + (a.savings_ms || 0) / 60000))

  const metrics = {}
  for (const mid of METRIC_IDS) {
    const a = audits[mid]
    if (!a) continue
    metrics[mid] = {
      label: a.title, value: a.displayValue || '', score: a.score,
      numeric: a.numericValue ?? null, display: a.displayValue || '',
    }
  }

  const scores = {
    performance: score('performance'),
    accessibility: score('accessibility'),
    best_practices: score('best-practices'),
    seo: score('seo'),
  }
  const available = Object.values(scores).filter((v) => typeof v === 'number')
  const overall = available.length ? Math.round(available.reduce((s, v) => s + v, 0) / available.length) : null

  return {
    strategy, scores, overall, metrics, findings,
    lighthouseVersion: lh.lighthouseVersion || null,
    finalUrl: raw.id || lh.finalUrl || url,
    fetchedAt: lh.fetchTime || new Date().toISOString(),
  }
}

function recommendationsFrom(findings) {
  const seen = new Set()
  const out = []
  for (const f of findings) {
    if (seen.has(f.audit_id)) continue
    seen.add(f.audit_id)
    const impact = f.savings_ms ? `${Math.round(f.savings_ms / 100) / 10}s potential saving`
      : f.display_value || (typeof f.score === 'number' ? `Lighthouse score ${Math.round(f.score * 100)}/100` : '')
    out.push({
      priority: f.severity,
      category: f.category,
      strategy: f.strategy,
      title: f.title,
      action_steps: [plain(f.description, 320)].filter(Boolean),
      estimated_impact: impact,
      detail: plain(f.description, 320),
      impact,
    })
    if (out.length >= 10) break
  }
  return out
}

function executiveSummary(websiteName, mobile, desktop) {
  const label = (n) => (n == null ? 'not measured' : n >= 90 ? 'strong' : n >= 70 ? 'needs work' : 'weak')
  const pick = (s) => (s?.overall ?? null)
  const worst = [...(mobile?.findings || []), ...(desktop?.findings || [])]
    .filter((f) => f.severity === 'Critical' || f.severity === 'High')
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))[0]
  const parts = [
    `${websiteName} scored ${pick(mobile) ?? '—'}/100 on mobile and ${pick(desktop) ?? '—'}/100 on desktop, which is ${label(pick(mobile)) === label(pick(desktop)) ? label(pick(mobile)) : `${label(pick(mobile))} on mobile and ${label(pick(desktop))} on desktop`}.`,
  ]
  if (worst) parts.push(`The most pressing issue is "${worst.title}" (${worst.severity.toLowerCase()}, ${worst.strategy}).`)
  parts.push('Scores come from Google Lighthouse via PageSpeed Insights and can vary slightly between runs with network conditions.')
  return parts.join(' ')
}

/** Run both device strategies and return one normalised object for the report. */
export async function runDualAudit(url) {
  await assertPublicDns(url)
  const results = await Promise.allSettled([
    runPageSpeed(url, 'mobile'),
    runPageSpeed(url, 'desktop'),
  ])
  const [mob, desk] = results
  const mobile = mob.status === 'fulfilled' ? normaliseStrategy(mob.value, { url, strategy: 'mobile' }) : null
  const desktop = desk.status === 'fulfilled' ? normaliseStrategy(desk.value, { url, strategy: 'desktop' }) : null
  const errors = [mob, desk].filter((r) => r.status === 'rejected').map((r) => r.reason?.message)
  if (!mobile && !desktop) throw new Error(errors[0] || 'PageSpeed Insights returned no result for this URL.')
  const findings = [...(mobile?.findings || []), ...(desktop?.findings || [])]
  const core_metrics = {}
  for (const mid of METRIC_IDS) {
    core_metrics[mid] = { label: mobile?.metrics[mid]?.label || desktop?.metrics[mid]?.label || mid,
      mobile: mobile?.metrics[mid] || null, desktop: desktop?.metrics[mid] || null }
  }
  return {
    mobile, desktop, findings, core_metrics,
    recommendations: recommendationsFrom(findings),
    partial_error: errors.length ? errors.join(' ') : null,
    finalUrl: mobile?.finalUrl || desktop?.finalUrl || url,
  }
}

export function persistReport(request, actor, dual) {
  const { mobile, desktop } = dual
  const reportId = id()
  const legacyScores = mobile?.scores || desktop?.scores || {}
  const legacyOverall = mobile?.overall ?? desktop?.overall ?? null
  const website = one('SELECT * FROM websites WHERE id = ?', request.website_id)
  const summary = executiveSummary(website?.display_name || website?.name || request.url, mobile, desktop)
  run(
    `INSERT INTO audit_reports (id, audit_request_id, website_id, user_id, customer_id, status, url, strategy,
      mobile_scores, desktop_scores, core_metrics, findings, recommendations, executive_summary,
      performance, seo, accessibility, best_practices, overall, metrics, lighthouse_version,
      audited_at, fetched_at)
     VALUES (?,?,?,?,?,'completed',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
    reportId, request.id, request.website_id, request.user_id, request.customer_id || request.user_id,
    dual.finalUrl || request.url, 'both',
    JSON.stringify(mobile?.scores || null), JSON.stringify(desktop?.scores || null),
    JSON.stringify(dual.core_metrics), JSON.stringify(dual.findings), JSON.stringify(dual.recommendations),
    dual.partial_error ? `${summary} Note: ${dual.partial_error}` : summary,
    legacyScores.performance ?? null, legacyScores.seo ?? null,
    legacyScores.accessibility ?? null, legacyScores.best_practices ?? null, legacyOverall,
    JSON.stringify(mobile?.metrics || {}), mobile?.lighthouseVersion || desktop?.lighthouseVersion || null,
  )
  run(
    `UPDATE audit_requests SET status = 'completed', completed_at = datetime('now'), error = NULL,
       started_at = COALESCE(started_at, datetime('now')) WHERE id = ?`,
    request.id,
  )
  run(
    `INSERT INTO report_history (id, website_id, report_id, customer_id, mobile_overall_avg, desktop_overall_avg)
     VALUES (?,?,?,?,?,?)`,
    id(), request.website_id, reportId, request.customer_id || request.user_id,
    mobile?.overall ?? null, desktop?.overall ?? null,
  )
  return one('SELECT * FROM audit_reports WHERE id = ?', reportId)
}

export function pendingAudits(userId) {
  return all(
    `SELECT a.*, w.name AS website_name, w.url FROM audit_requests a
       JOIN websites w ON w.id = a.website_id
      WHERE a.user_id = ? AND a.status IN ('pending','in_progress')
      ORDER BY a.requested_at DESC LIMIT 20`, userId,
  )
}

export async function sendPush(userId, title, body) {
  const token = process.env.EXPO_ACCESS_TOKEN
  const rows = all('SELECT token FROM push_tokens WHERE user_id = ?', userId)
  if (!token || rows.length === 0) return { skipped: true, reason: token ? 'no_devices' : 'not_configured' }
  const messages = rows.map((r) => ({ to: r.token, title, body, sound: 'default' }))
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(messages),
    })
    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export { now }
