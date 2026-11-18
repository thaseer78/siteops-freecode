import { all, one, run, id, now } from './db.mjs'

export function notify(user, { type, title, body, link = null }) {
  run(
    'INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?,?,?,?,?,?)',
    id(), typeof user === 'string' ? user : user.id, type, title, body, link,
  )
}

/* ── Google PageSpeed Insights ──────────────────────────────────────────────
   Real measurements only. Every score comes from the API response; nothing is
   invented or extrapolated. Docs: developers.google.com/speed/docs/insights/v5 */
const AUDIT_CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

export async function runPageSpeed(url, strategy = 'mobile', timeoutMs = 100000) {
  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  api.searchParams.set('url', url)
  api.searchParams.set('strategy', strategy)
  for (const c of AUDIT_CATEGORIES) api.searchParams.append('category', c)
  if (process.env.PAGESPEED_API_KEY) api.searchParams.set('key', process.env.PAGESPEED_API_KEY)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res, json
  try {
    res = await fetch(api, { signal: ctrl.signal })
    json = await res.json().catch(() => null)
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'PageSpeed Insights timed out after 100 seconds. The site may be slow or unreachable.'
      : `Could not reach PageSpeed Insights: ${err.message}`
    throw new Error(msg)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const detail = json?.error?.message || `HTTP ${res.status}`
    throw new Error(`PageSpeed Insights could not audit this URL: ${detail}`)
  }
  return json
}

const pct = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) : null)

/**
 * Turn a raw PSI payload into normalised report data: real category scores,
 * real Lighthouse audit failures, opportunities and measured metrics.
 */
export function normaliseReport(raw, { url, strategy }) {
  if (!raw?.lighthouseResult) {
    throw new Error('PageSpeed Insights returned no Lighthouse result for this URL.')
  }
  const lh = raw.lighthouseResult
  const cats = lh.categories || {}
  const score = (key) => pct(cats[key]?.score)
  const audits = lh.audits || {}

  const findings = []
  for (const [catKey, cat] of Object.entries(cats)) {
    for (const ref of cat.auditRefs || []) {
      const a = audits[ref.id]
      if (!a) continue
      const weight = ref.weight || 0
      const failed = a.score !== null && a.score < 1
      const isOpportunity = a.details?.type === 'opportunity'
      if (!failed && !isOpportunity) continue
      findings.push({
        id: ref.id,
        category: catKey,
        title: a.title || ref.id,
        description: a.description || '',
        displayValue: a.displayValue || '',
        score: a.score,
        weight,
        mode: ref.group || (isOpportunity ? 'opportunity' : 'diagnostic'),
        savingsMs: a.details?.overallSavingsMs ?? null,
        savingsBytes: a.details?.overallSavingsBytes ?? null,
      })
    }
  }
  // Sort by weighted impact, then savings, so the most useful issues come first.
  findings.sort((a, b) => (b.weight * (1 - (b.score ?? 0)) + (b.savingsMs || 0) / 60000) -
                         (a.weight * (1 - (a.score ?? 0)) + (a.savingsMs || 0) / 60000))

  const metricIds = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time',
    'cumulative-layout-shift', 'speed-index', 'interactive']
  const metrics = {}
  for (const mid of metricIds) {
    const a = audits[mid]
    if (a && a.displayValue) metrics[mid] = { label: a.title, value: a.displayValue, score: a.score }
  }

  const scores = {
    performance: score('performance'),
    accessibility: score('accessibility'),
    best_practices: score('best-practices'),
    seo: score('seo'),
  }
  const available = Object.values(scores).filter((v) => typeof v === 'number')
  const overall = available.length ? Math.round(available.reduce((s, v) => s + v, 0) / available.length) : null

  const top = findings.filter((f) => f.weight > 0 || f.savingsMs).slice(0, 8)
  return {
    scores,
    overall,
    findings,
    metrics,
    recommendations: top.map((f) => ({
      title: f.title,
      category: f.category,
      detail: f.description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 320),
      impact: f.savingsMs ? `${Math.round(f.savingsMs / 100) / 10}s potential saving` : f.displayValue || '',
    })),
    lighthouseVersion: lh.lighthouseVersion || null,
    finalUrl: raw.id || url,
    strategy,
    fetchedAt: lh.fetchTime || new Date().toISOString(),
  }
}

export function persistReport(request, user, raw) {
  const norm = normaliseReport(raw, { url: request.url, strategy: request.strategy })
  const reportId = id()
  run(
    `INSERT INTO audit_reports (id, audit_request_id, website_id, user_id, url, strategy,
      performance, seo, accessibility, best_practices, overall, findings, metrics, lighthouse_version, fetched_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    reportId, request.id, request.website_id, request.user_id, request.url, request.strategy,
    norm.scores.performance, norm.scores.seo, norm.scores.accessibility, norm.scores.best_practices,
    norm.overall, JSON.stringify({ findings: norm.findings, recommendations: norm.recommendations }),
    JSON.stringify(norm.metrics), norm.lighthouseVersion, now(),
  )
  run(
    `UPDATE audit_requests SET status = 'completed', completed_at = datetime('now'), error = NULL WHERE id = ?`,
    request.id,
  )
  return one('SELECT * FROM audit_reports WHERE id = ?', reportId)
}

export function pendingAudits(userId) {
  return all(
    `SELECT a.*, w.name AS website_name, w.url FROM audit_requests a
       JOIN websites w ON w.id = a.website_id
      WHERE a.user_id = ? AND a.status IN ('pending','running')
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
