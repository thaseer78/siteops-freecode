import express from 'express'
import { all, one, run, id, audit } from '../db.mjs'
import { requireAuth, isAdmin, limiter } from '../auth.mjs'
import { sendMail, templates, baseUrl } from '../mail.mjs'
import { notify } from '../notify.mjs'
import { runDualAudit, persistReport, sendPush, assertPublicHost, assertPublicDns } from '../audit.mjs'
import { reportFile } from '../pdf.mjs'

export const router = express.Router()
router.use(requireAuth)

const siteLimit = limiter(20, 60_000, (r) => r.user.id)
const auditLimit = limiter(6, 60_000, (r) => r.user.id)
const safe = (v, f) => { try { return JSON.parse(v) || f } catch { return f } }

export function normalizedDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return null }
}

export function normaliseUrl(input) {
  let raw = String(input || '').trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`
  try {
    const u = new URL(raw)
    if (!['http:', 'https:'].includes(u.protocol)) return null
    if (u.username || u.password) return null
    u.hash = ''
    const cleaned = u.toString().replace(/\/$/, '')
    assertPublicHost(cleaned) // throws for localhost / private IPs / bad hostnames
    return cleaned
  } catch {
    return null
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function ownWebsite(userId, websiteId) {
  return one('SELECT * FROM websites WHERE id = ? AND customer_id = ?', websiteId, userId)
}

/** Customer-facing report shape. internal_admin_notes never appears here. */
export function reportShape(r) {
  if (!r) return null
  const mobile = safe(r.mobile_scores, null)
  const desktop = safe(r.desktop_scores, null)
  const legacy = {
    performance: r.performance, accessibility: r.accessibility,
    best_practices: r.best_practices, seo: r.seo,
  }
  const avg = (s) => {
    const vals = Object.values(s || {}).filter((v) => typeof v === 'number')
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }
  return {
    id: r.id,
    audit_request_id: r.audit_request_id,
    website_id: r.website_id,
    url: r.url,
    status: r.status,
    strategy: r.strategy,
    mobile_scores: mobile || legacy,
    desktop_scores: desktop,
    mobile_overall: avg(mobile || legacy),
    desktop_overall: avg(desktop),
    core_metrics: safe(r.core_metrics, {}),
    findings: safe(r.findings, []),
    recommendations: safe(r.recommendations, []),
    executive_summary: r.executive_summary,
    failure_reason: r.failure_reason,
    audited_at: r.audited_at || r.fetched_at,
    fetched_at: r.fetched_at,
    lighthouse_version: r.lighthouse_version,
    // legacy flat fields, still used by older views
    performance: (mobile || legacy).performance ?? null,
    seo: (mobile || legacy).seo ?? null,
    accessibility: (mobile || legacy).accessibility ?? null,
    best_practices: (mobile || legacy).best_practices ?? null,
    overall: r.overall ?? avg(mobile || legacy),
    metrics: safe(r.metrics, {}),
  }
}

/** Customer-facing request shape: admin-only fields stripped. */
export function requestShape(r) {
  if (!r) return null
  const {
    internal_admin_notes, assigned_admin_id, ...rest
  } = r
  return {
    ...rest,
    customer_notes: r.customer_notes ?? r.customer_note ?? null,
    // status vocabulary from the spec; 'in_progress' covers the old 'running'
    status: r.status === 'running' ? 'in_progress' : r.status,
    overall: r.overall ?? null,
  }
}

/* ── overview ──────────────────────────────────────────────────────────── */
router.get(['/dashboard', '/overview'], (req, res) => {
  const uid = req.user.id
  const websites = all(
    `SELECT w.*, 
            (SELECT overall FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_score,
            (SELECT fetched_at FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_at,
            (SELECT status FROM audit_requests a WHERE a.website_id = w.id ORDER BY a.requested_at DESC LIMIT 1) AS latest_request_status
       FROM websites w WHERE w.customer_id = ? AND w.status = 'active' ORDER BY w.created_at DESC`, uid,
  )
  const counts = one(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status IN ('pending','in_progress','running') THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM audit_requests WHERE customer_id = ?`, uid,
  )
  const recentReports = all(
    `SELECT r.id, r.url, r.overall, r.performance, r.seo, r.accessibility, r.best_practices,
            r.mobile_scores, r.desktop_scores, r.fetched_at, r.audited_at, r.audit_request_id,
            w.name AS website_name
       FROM audit_reports r JOIN websites w ON w.id = r.website_id
      WHERE r.customer_id = ? ORDER BY r.fetched_at DESC LIMIT 5`, uid,
  )
  const recent = all(
    `SELECT id, type, title, body, message, link, action_url, read_at, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6`, uid,
  )
  const unread = one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', uid).n
  const scored = websites.filter((w) => w.latest_score != null)
  const health = scored.length ? Math.round(scored.reduce((s, w) => s + w.latest_score, 0) / scored.length) : null

  res.json({
    websites,
    counts: { ...counts, websites: websites.length, reports: one('SELECT COUNT(*) AS n FROM audit_reports WHERE customer_id = ?', uid).n },
    recentReports: recentReports.map((r) => reportShape({ ...r, status: 'completed' })),
    notifications: recent, unread, health,
    latest_average_score: health,
  })
})

/* ── websites ──────────────────────────────────────────────────────────── */
router.get('/websites', (req, res) => {
  const rows = all(
    `SELECT w.*,
            (SELECT overall FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_score,
            (SELECT fetched_at FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_at,
            (SELECT status FROM audit_requests a WHERE a.website_id = w.id ORDER BY a.requested_at DESC LIMIT 1) AS latest_request_status,
            (SELECT COUNT(*) FROM audit_requests a WHERE a.website_id = w.id) AS audit_count
       FROM websites w WHERE w.customer_id = ? AND w.status = 'active' ORDER BY w.created_at DESC`, req.user.id,
  )
  res.json({ websites: rows.map((w) => ({ ...w, display_name: w.display_name || w.name, name: w.display_name || w.name })) })
})

router.post('/websites', siteLimit, (req, res) => {
  const name = String(req.body?.display_name || req.body?.name || '').trim()
  const url = normaliseUrl(req.body?.url)
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Website name must be 2–80 characters.' })
  if (!url) return res.status(400).json({ error: 'Enter a valid public website URL, e.g. https://example.com' })
  const count = one(`SELECT COUNT(*) AS n FROM websites WHERE customer_id = ? AND status = 'active'`, req.user.id).n
  if (count >= 25) return res.status(400).json({ error: 'You have reached the 25 website limit on this plan.' })
  const wid = id()
  run(
    `INSERT INTO websites (id, user_id, customer_id, name, display_name, url, normalized_domain, notes, status)
     VALUES (?,?,?,?,?,?,?,?, 'active')`,
    wid, req.user.id, req.user.id, name, name, url, normalizedDomain(url),
    String(req.body?.notes || '').slice(0, 300) || null,
  )
  audit(req.user, 'WEBSITE_CREATED', 'websites', wid, { url }, req.ip)
  res.status(201).json({ website: one('SELECT * FROM websites WHERE id = ?', wid) })
})

router.patch('/websites/:id', siteLimit, (req, res) => {
  const site = ownWebsite(req.user.id, req.params.id)
  if (!site) return res.status(404).json({ error: 'Website not found.' })
  const name = String(req.body?.display_name ?? req.body?.name ?? site.display_name ?? site.name).trim()
  const url = req.body?.url ? normaliseUrl(req.body.url) : site.url
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Website name must be 2–80 characters.' })
  if (!url) return res.status(400).json({ error: 'Enter a valid public website URL.' })
  run(
    `UPDATE websites SET name = ?, display_name = ?, url = ?, normalized_domain = ?, notes = ?,
       updated_at = datetime('now') WHERE id = ?`,
    name, name, url, normalizedDomain(url), String(req.body?.notes || '').slice(0, 300) || null, site.id,
  )
  audit(req.user, 'WEBSITE_UPDATED', 'websites', site.id, { url }, req.ip)
  res.json({ website: one('SELECT * FROM websites WHERE id = ?', site.id) })
})

router.delete('/websites/:id', (req, res) => {
  const site = ownWebsite(req.user.id, req.params.id)
  if (!site) return res.status(404).json({ error: 'Website not found.' })
  // Archive instead of destroying audit history.
  run(`UPDATE websites SET status = 'archived', archived = 1, updated_at = datetime('now') WHERE id = ?`, site.id)
  audit(req.user, 'WEBSITE_ARCHIVED', 'websites', site.id, { url: site.url }, req.ip)
  res.json({ ok: true })
})

/* ── audit requests ────────────────────────────────────────────────────── */
router.get(['/audit-requests', '/audits'], (req, res) => {
  const rows = all(
    `SELECT a.*, w.name AS website_name, w.display_name, w.url,
            r.id AS report_id, r.overall
       FROM audit_requests a JOIN websites w ON w.id = a.website_id
       LEFT JOIN audit_reports r ON r.audit_request_id = a.id
      WHERE a.customer_id = ? ORDER BY a.requested_at DESC LIMIT 100`, req.user.id,
  )
  res.json({ audits: rows.map(requestShape), requests: rows.map(requestShape) })
})

const queue = new Set()

/** Fire-and-forget audit execution so HTTP requests never hang on PSI. */
export function enqueueAudit(requestId, actor, base) {
  if (queue.has(requestId)) return
  queue.add(requestId)
  setImmediate(async () => {
    try { await executeAudit(requestId, actor, base) }
    catch { /* status + error already persisted */ }
    finally { queue.delete(requestId) }
  })
}

router.post(['/audit-requests', '/websites/:id/audits'], auditLimit, async (req, res) => {
  let site
  if (req.params.id) site = ownWebsite(req.user.id, req.params.id)
  else if (req.body?.website_id) site = ownWebsite(req.user.id, req.body.website_id)
  else if (req.body?.url) {
    // Register a website and request an audit in one step.
    const url = normaliseUrl(req.body.url)
    if (!url) return res.status(400).json({ error: 'Enter a valid public website URL, e.g. https://example.com' })
    const wid = id()
    const name = String(req.body?.display_name || hostOf(url)).slice(0, 80)
    run(`INSERT INTO websites (id, user_id, customer_id, name, display_name, url, normalized_domain, status)
         VALUES (?,?,?,?,?,?,?, 'active')`, wid, req.user.id, req.user.id, name, name, url, normalizedDomain(url))
    audit(req.user, 'WEBSITE_CREATED', 'websites', wid, { url, via: 'audit_request' }, req.ip)
    site = one('SELECT * FROM websites WHERE id = ?', wid)
  }
  if (!site) return res.status(404).json({ error: 'Website not found. Add the website first or send a url.' })
  const active = one(
    `SELECT id FROM audit_requests WHERE website_id = ? AND status IN ('pending','in_progress','running')`, site.id,
  )
  if (active) return res.status(409).json({ error: 'An audit for this website is already in progress.' })

  // Reject internal targets before queueing, so a bad URL fails immediately.
  try { await assertPublicDns(site.url) }
  catch (err) { return res.status(400).json({ error: err.message }) }

  const notes = String(req.body?.customer_notes || req.body?.note || '').slice(0, 1000) || null
  const requestId = id()
  run(
    `INSERT INTO audit_requests (id, website_id, user_id, customer_id, strategy, audit_scope,
       customer_note, customer_notes, status)
     VALUES (?,?,?,?, 'both', 'full_site_health', ?, ?, 'pending')`,
    requestId, site.id, req.user.id, req.user.id, notes, notes,
  )
  audit(req.user, 'AUDIT_REQUESTED', 'audit_requests', requestId, { website: site.url }, req.ip)
  notify(req.user, {
    type: 'audit', title: 'Audit request received',
    body: `We're auditing ${hostOf(site.url)} on mobile and desktop. Results appear under Reports once complete.`,
    link: '/dashboard/requests',
  })
  sendPush(req.user.id, 'Audit request received', `${site.name} is queued for a mobile + desktop audit.`)
  const prefs = safe(req.user.notification_prefs, {})
  if (prefs.email_audits !== false) {
    sendMail({
      to: req.user.email,
      ...templates.auditReceived(req.user.full_name.split(' ')[0], site.name, requestId, baseUrl(req)),
      userId: req.user.id, sentBy: req.user.id,
    })
  }
  enqueueAudit(requestId, req.user, baseUrl(req))
  res.status(202).json({ audit_request_id: requestId, id: requestId, status: 'pending' })
})

export async function executeAudit(requestId, actor, base) {
  const request = one(
    `SELECT a.*, w.url, w.name AS website_name FROM audit_requests a JOIN websites w ON w.id = a.website_id WHERE a.id = ?`,
    requestId,
  )
  if (!request) throw new Error('Audit request not found.')
  run(
    `UPDATE audit_requests SET status = 'in_progress', started_at = datetime('now'), error = NULL WHERE id = ?`,
    requestId,
  )
  try {
    const dual = await runDualAudit(request.url)
    const report = persistReport(request, actor, dual)
    const user = one('SELECT * FROM users WHERE id = ?', request.user_id)
    const prefs = safe(user?.notification_prefs, {})
    const websiteName = request.website_name || hostOf(request.url)
    const summary = `Mobile ${report.mobile_scores ? safe(report.mobile_scores, {}).performance ?? '—' : '—'} · Desktop ${report.desktop_scores ? safe(report.desktop_scores, {}).performance ?? '—' : '—'}`
    notify(user, {
      type: 'report', title: 'Audit complete',
      body: `Your mobile and desktop audit for ${hostOf(request.url)} is ready. ${summary}`,
      link: `/dashboard/reports/${report.id}`,
    })
    sendPush(request.user_id, 'Audit complete', `${hostOf(request.url)} has a new report.`)
    if (prefs.email_audits !== false && user) {
      sendMail({
        to: user.email,
        ...templates.auditCompleted(user.full_name.split(' ')[0], websiteName, base),
        userId: user.id, sentBy: actor?.id || null,
      })
    }
    audit(actor, 'AUDIT_EXECUTED', 'audit_requests', requestId, { report: report.id, overall: report.overall }, actor?.ip)
    return report
  } catch (err) {
    const message = String(err.message).slice(0, 700)
    run(
      `UPDATE audit_requests SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?`,
      message, requestId,
    )
    audit(actor, 'AUDIT_FAILED', 'audit_requests', requestId, { error: message.slice(0, 300) })
    throw err
  }
}

router.post(['/audit-requests/:id/run', '/audits/:id/run'], auditLimit, async (req, res) => {
  const row = one(
    'SELECT * FROM audit_requests WHERE id = ? AND customer_id = ?', req.params.id, req.user.id,
  )
  if (!row) return res.status(404).json({ error: 'Audit request not found.' })
  if (!['pending', 'failed', 'cancelled'].includes(row.status)) {
    return res.status(409).json({ error: `This request is ${requestShape(row).status}.` })
  }
  try {
    const report = await executeAudit(row.id, { ...req.user, ip: req.ip }, baseUrl(req))
    res.json({ report: reportShape(report) })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

router.get(['/audit-requests/:id', '/audits/:id'], (req, res) => {
  const row = one(
    `SELECT a.*, w.name AS website_name, w.display_name, w.url FROM audit_requests a
       JOIN websites w ON w.id = a.website_id
      WHERE a.id = ? AND a.customer_id = ?`, req.params.id, req.user.id,
  )
  if (!row) return res.status(404).json({ error: 'Audit request not found.' })
  const report = one('SELECT * FROM audit_reports WHERE audit_request_id = ?', row.id)
  res.json({ audit: requestShape(row), request: requestShape(row), report: report ? reportShape(report) : null })
})

/* ── reports ───────────────────────────────────────────────────────────── */
router.get('/reports', (req, res) => {
  const rows = all(
    `SELECT r.*, w.name AS website_name, w.id AS website_id
       FROM audit_reports r JOIN websites w ON w.id = r.website_id
      WHERE r.customer_id = ? ORDER BY r.fetched_at DESC LIMIT 100`, req.user.id,
  )
  res.json({ reports: rows.map((r) => ({ ...reportShape(r), website_name: r.website_name })) })
})

router.get('/reports/:id', (req, res) => {
  const report = one('SELECT * FROM audit_reports WHERE id = ? AND customer_id = ?', req.params.id, req.user.id)
  if (!report) return res.status(404).json({ error: 'Report not found.' })
  const history = all(
    `SELECT r.id, r.overall, r.mobile_scores, r.desktop_scores, r.fetched_at, r.audited_at,
            h.mobile_overall_avg, h.desktop_overall_avg
       FROM audit_reports r LEFT JOIN report_history h ON h.report_id = r.id
      WHERE r.website_id = ? AND r.customer_id = ? ORDER BY r.fetched_at ASC LIMIT 30`,
    report.website_id, req.user.id,
  )
  const website = one('SELECT id, name, display_name, url FROM websites WHERE id = ? AND customer_id = ?',
    report.website_id, req.user.id)
  const request = one(
    `SELECT id, requested_at, completed_at, strategy, status, audit_scope FROM audit_requests
      WHERE id = ? AND customer_id = ?`, report.audit_request_id, req.user.id,
  )
  const shaped = reportShape(report)
  res.json({
    report: shaped,
    website: website ? { ...website, name: website.display_name || website.name } : null,
    history: history.map((h) => {
      const s = reportShape({ ...h, status: 'completed' })
      return {
        id: h.id, fetched_at: h.fetched_at, audited_at: h.audited_at,
        mobile_overall_avg: h.mobile_overall_avg, desktop_overall_avg: h.desktop_overall_avg,
        overall: s.overall, performance: s.performance, seo: s.seo,
        accessibility: s.accessibility, best_practices: s.best_practices,
        mobile_scores: s.mobile_scores, desktop_scores: s.desktop_scores,
      }
    }),
    request,
    // Explicitly absent: internal_admin_notes.
  })
})

router.get('/reports/:id/pdf', async (req, res, next) => {
  const report = one('SELECT id FROM audit_reports WHERE id = ? AND customer_id = ?', req.params.id, req.user.id)
  if (!report) return res.status(404).json({ error: 'Report not found.' })
  try {
    const generated = await reportFile(report.id)
    if (!generated) return res.status(404).json({ error: 'Report not found.' })
    const name = (generated.website?.display_name || generated.website?.name || 'site').replace(/[^a-z0-9]+/gi, '-')
    const date = String(generated.report.audited_at || generated.report.fetched_at || '').slice(0, 10)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="SiteOps-${name}-${date}.pdf"`)
    res.send(generated.buf)
  } catch (err) { next(err) }
})

/* ── notifications ─────────────────────────────────────────────────────── */
router.get('/notifications', (req, res) => {
  const rows = all(
    `SELECT id, type, title, body, message, link, action_url, read_at, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, req.user.id,
  )
  const unread = one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id).n
  res.json({
    notifications: rows.map((n) => ({
      ...n, message: n.message || n.body, body: n.body || n.message,
      action_url: n.action_url || n.link, link: n.link || n.action_url, is_read: !!n.read_at || !!n.is_read,
    })),
    unread,
  })
})
router.post('/notifications/read-all', (req, res) => {
  run(`UPDATE notifications SET read_at = datetime('now'), is_read = 1 WHERE user_id = ? AND read_at IS NULL`, req.user.id)
  res.json({ ok: true })
})
router.post('/notifications/:id/read', (req, res) => {
  run(`UPDATE notifications SET read_at = datetime('now'), is_read = 1 WHERE id = ? AND user_id = ?`,
    req.params.id, req.user.id)
  res.json({ ok: true })
})

/* mobile push token registration */
router.post('/push-tokens', (req, res) => {
  const token = String(req.body?.token || '')
  const platform = req.body?.platform === 'ios' ? 'ios' : 'android'
  if (token.length < 8) return res.status(400).json({ error: 'Invalid push token.' })
  run(`INSERT INTO push_tokens (id, user_id, token, platform) VALUES (?,?,?,?)
       ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform`,
    id(), req.user.id, token.slice(0, 300), platform)
  res.json({ ok: true })
})

export { isAdmin }
