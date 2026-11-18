import express from 'express'
import { all, one, run, id, audit } from '../db.mjs'
import { requireAuth, isAdmin, limiter } from '../auth.mjs'
import { sendMail, templates, baseUrl } from '../mail.mjs'
import { notify } from '../notify.mjs'
import { runPageSpeed, persistReport, sendPush } from '../audit.mjs'

export const router = express.Router()
router.use(requireAuth)

const siteLimit = limiter(20, 60_000, (r) => r.user.id)
const auditLimit = limiter(6, 60_000, (r) => r.user.id)

export function normaliseUrl(input) {
  let raw = String(input || '').trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`
  try {
    const u = new URL(raw)
    if (!['http:', 'https:'].includes(u.protocol)) return null
    if (!u.hostname.includes('.') || u.hostname.length > 253) return null
    if (u.hostname === 'localhost' || /^(127\.|10\.|192\.168\.|0\.)/.test(u.hostname)) return null
    return u.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function ownWebsite(userId, websiteId) {
  return one('SELECT * FROM websites WHERE id = ? AND user_id = ?', websiteId, userId)
}

function reportShape(r) {
  const parsed = safe(r.findings, {})
  return {
    ...r, findings: parsed.findings || [], recommendations: parsed.recommendations || [],
    metrics: safe(r.metrics, {}),
  }
}
const safe = (v, f) => { try { return JSON.parse(v) || f } catch { return f } }

/* ── dashboard ─────────────────────────────────────────────────────────── */
router.get('/dashboard', (req, res) => {
  const uid = req.user.id
  const websites = all(
    `SELECT w.*, (SELECT overall FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_score,
            (SELECT fetched_at FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_at,
            (SELECT status FROM audit_requests a WHERE a.website_id = w.id ORDER BY a.requested_at DESC LIMIT 1) AS latest_request_status
       FROM websites w WHERE w.user_id = ? AND w.archived = 0 ORDER BY w.created_at DESC`, uid,
  )
  const counts = one(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status IN ('pending','running') THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM audit_requests WHERE user_id = ?`, uid,
  )
  const recentReports = all(
    `SELECT r.id, r.url, r.overall, r.performance, r.seo, r.accessibility, r.best_practices, r.fetched_at,
            w.name AS website_name, r.audit_request_id
       FROM audit_reports r JOIN websites w ON w.id = r.website_id
      WHERE r.user_id = ? ORDER BY r.fetched_at DESC LIMIT 5`, uid,
  )
  const activity = all(
    `SELECT id, type, title, body, link, read_at, created_at FROM notifications
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 6`, uid,
  )
  const unread = one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', uid).n
  const scored = websites.filter((w) => w.latest_score != null)
  const health = scored.length ? Math.round(scored.reduce((s, w) => s + w.latest_score, 0) / scored.length) : null
  res.json({
    websites, counts: { ...counts, websites: websites.length }, recentReports,
    notifications: activity, unread, health,
  })
})

/* ── websites ──────────────────────────────────────────────────────────── */
router.get('/websites', (req, res) => {
  const rows = all(
    `SELECT w.*, (SELECT overall FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_score,
            (SELECT fetched_at FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_at,
            (SELECT status FROM audit_requests a WHERE a.website_id = w.id ORDER BY a.requested_at DESC LIMIT 1) AS latest_request_status,
            (SELECT COUNT(*) FROM audit_requests a WHERE a.website_id = w.id) AS audit_count
       FROM websites w WHERE w.user_id = ? AND w.archived = 0 ORDER BY w.created_at DESC`, req.user.id,
  )
  res.json({ websites: rows })
})

router.post('/websites', siteLimit, (req, res) => {
  const name = String(req.body?.name || '').trim()
  const url = normaliseUrl(req.body?.url)
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Website name must be 2–80 characters.' })
  if (!url) return res.status(400).json({ error: 'Enter a valid public website URL, e.g. https://example.com' })
  const count = one('SELECT COUNT(*) AS n FROM websites WHERE user_id = ? AND archived = 0', req.user.id).n
  if (count >= 25) return res.status(400).json({ error: 'You have reached the 25 website limit on this plan.' })
  const wid = id()
  run('INSERT INTO websites (id, user_id, name, url, notes) VALUES (?,?,?,?,?)',
    wid, req.user.id, name, url, String(req.body?.notes || '').slice(0, 300) || null)
  audit(req.user, 'website.created', 'websites', wid, { url })
  res.status(201).json({ website: one('SELECT * FROM websites WHERE id = ?', wid) })
})

router.patch('/websites/:id', siteLimit, (req, res) => {
  const site = ownWebsite(req.user.id, req.params.id)
  if (!site) return res.status(404).json({ error: 'Website not found.' })
  const name = String(req.body?.name ?? site.name).trim()
  const url = req.body?.url ? normaliseUrl(req.body.url) : site.url
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Website name must be 2–80 characters.' })
  if (!url) return res.status(400).json({ error: 'Enter a valid public website URL.' })
  run(`UPDATE websites SET name = ?, url = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
    name, url, String(req.body?.notes || '').slice(0, 300) || null, site.id)
  audit(req.user, 'website.updated', 'websites', site.id, { url })
  res.json({ website: one('SELECT * FROM websites WHERE id = ?', site.id) })
})

router.delete('/websites/:id', (req, res) => {
  const site = ownWebsite(req.user.id, req.params.id)
  if (!site) return res.status(404).json({ error: 'Website not found.' })
  run('DELETE FROM websites WHERE id = ?', site.id)
  audit(req.user, 'website.deleted', 'websites', site.id, { url: site.url })
  res.json({ ok: true })
})

/* ── audits ────────────────────────────────────────────────────────────── */
router.get('/audits', (req, res) => {
  const rows = all(
    `SELECT a.*, w.name AS website_name, w.url,
            r.id AS report_id, r.overall
       FROM audit_requests a JOIN websites w ON w.id = a.website_id
       LEFT JOIN audit_reports r ON r.audit_request_id = a.id
      WHERE a.user_id = ? ORDER BY a.requested_at DESC LIMIT 100`, req.user.id,
  )
  res.json({ audits: rows })
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

router.post('/websites/:id/audits', auditLimit, (req, res) => {
  const site = ownWebsite(req.user.id, req.params.id)
  if (!site) return res.status(404).json({ error: 'Website not found.' })
  const active = one(`SELECT id FROM audit_requests WHERE website_id = ? AND status IN ('pending','running')`, site.id)
  if (active) return res.status(409).json({ error: 'An audit for this website is already in progress.' })
  const strategy = req.body?.strategy === 'desktop' ? 'desktop' : 'mobile'
  const requestId = id()
  run(`INSERT INTO audit_requests (id, website_id, user_id, strategy, customer_note, status) VALUES (?,?,?,?,?, 'pending')`,
    requestId, site.id, req.user.id, strategy, String(req.body?.note || '').slice(0, 400) || null)
  audit(req.user, 'audit.requested', 'audit_requests', requestId, { website: site.url })
  notify(req.user, { type: 'audit', title: 'Audit request received', body: `We're auditing ${hostOf(site.url)}. Results appear under Reports once complete.`, link: '/app/audits' })
  sendPush(req.user.id, 'Audit request received', `${site.name} is queued for a ${strategy} audit.`)
  const prefs = safe(req.user.notification_prefs, {})
  if (prefs.email_audits !== false) {
    sendMail({ to: req.user.email, ...templates.auditReceived(req.user.full_name.split(' ')[0], site.name, requestId, baseUrl(req)), userId: req.user.id, sentBy: req.user.id })
  }
  enqueueAudit(requestId, req.user, baseUrl(req))
  res.status(202).json({ audit_request_id: requestId, status: 'pending' })
})

export async function executeAudit(requestId, actor, base) {
  const request = one(
    `SELECT a.*, w.url FROM audit_requests a JOIN websites w ON w.id = a.website_id WHERE a.id = ?`, requestId)
  if (!request) throw new Error('Audit request not found.')
  run(`UPDATE audit_requests SET status = 'running', started_at = datetime('now'), error = NULL WHERE id = ?`, requestId)
  try {
    const raw = await runPageSpeed(request.url, request.strategy)
    const report = persistReport(request, actor, raw)
    const user = one('SELECT * FROM users WHERE id = ?', request.user_id)
    const prefs = safe(user.notification_prefs, {})
    const w = one('SELECT name FROM websites WHERE id = ?', request.website_id)
    const websiteName = w?.name || hostOf(request.url)
    notify(user, { type: 'report', title: 'Audit complete', body: `Your ${request.strategy} audit for ${hostOf(request.url)} scored ${report.overall ?? '—'}/100.`, link: `/app/reports/${report.id}` })
    sendPush(request.user_id, 'Audit complete', `${hostOf(request.url)} scored ${report.overall ?? '—'}/100.`)
    if (prefs.email_audits !== false) {
      sendMail({ to: user.email, ...templates.auditCompleted(user.full_name.split(' ')[0], websiteName, base), userId: user.id, sentBy: actor?.id || null })
    }
    audit(actor, 'audit.completed', 'audit_requests', requestId, { report: report.id, overall: report.overall })
    return report
  } catch (err) {
    run(`UPDATE audit_requests SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?`,
      String(err.message).slice(0, 500), requestId)
    audit(actor, 'audit.failed', 'audit_requests', requestId, { error: String(err.message).slice(0, 300) })
    throw err
  }
}

router.post('/audits/:id/run', auditLimit, async (req, res) => {
  const row = one('SELECT * FROM audit_requests WHERE id = ? AND user_id = ?', req.params.id, req.user.id)
  if (!row) return res.status(404).json({ error: 'Audit request not found.' })
  if (!['pending', 'failed'].includes(row.status)) return res.status(409).json({ error: `This request is ${row.status}.` })
  try {
    const report = await executeAudit(row.id, req.user, baseUrl(req))
    res.json({ report: reportShape(report) })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

router.get('/audits/:id', (req, res) => {
  const row = one(
    `SELECT a.*, w.name AS website_name, w.url FROM audit_requests a JOIN websites w ON w.id = a.website_id
      WHERE a.id = ? AND a.user_id = ?`, req.params.id, req.user.id)
  if (!row) return res.status(404).json({ error: 'Audit request not found.' })
  const report = one('SELECT * FROM audit_reports WHERE audit_request_id = ?', row.id)
  res.json({ audit: row, report: report ? reportShape(report) : null })
})

/* ── reports ───────────────────────────────────────────────────────────── */
router.get('/reports', (req, res) => {
  const rows = all(
    `SELECT r.id, r.url, r.strategy, r.overall, r.performance, r.seo, r.accessibility, r.best_practices,
            r.fetched_at, r.audit_request_id, w.name AS website_name, w.id AS website_id
       FROM audit_reports r JOIN websites w ON w.id = r.website_id
      WHERE r.user_id = ? ORDER BY r.fetched_at DESC LIMIT 100`, req.user.id)
  res.json({ reports: rows })
})

router.get('/reports/:id', (req, res) => {
  const report = one('SELECT * FROM audit_reports WHERE id = ? AND user_id = ?', req.params.id, req.user.id)
  if (!report) return res.status(404).json({ error: 'Report not found.' })
  const history = all(
    `SELECT id, overall, performance, seo, accessibility, best_practices, fetched_at FROM audit_reports
      WHERE website_id = ? AND user_id = ? ORDER BY fetched_at ASC LIMIT 30`, report.website_id, req.user.id)
  const website = one('SELECT id, name, url FROM websites WHERE id = ?', report.website_id)
  const request = one('SELECT id, requested_at, completed_at, strategy FROM audit_requests WHERE id = ?', report.audit_request_id)
  res.json({ report: reportShape(report), website, history, request })
})

/* ── notifications ─────────────────────────────────────────────────────── */
router.get('/notifications', (req, res) => {
  const rows = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', req.user.id)
  const unread = one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user.id).n
  res.json({ notifications: rows, unread })
})
router.post('/notifications/read-all', (req, res) => {
  run(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`, req.user.id)
  res.json({ ok: true })
})
router.post('/notifications/:id/read', (req, res) => {
  run(`UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?`, req.params.id, req.user.id)
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
