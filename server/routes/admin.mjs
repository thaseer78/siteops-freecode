import express from 'express'
import { all, one, run, id, audit } from '../db.mjs'
import { requireAuth, requireRole, isStaff, isAdmin, limiter } from '../auth.mjs'
import { sendMail, layout, baseUrl } from '../mail.mjs'
import { reportBundle, buildReportPdf } from '../pdf.mjs'
import { notify } from '../notify.mjs'
import { enqueueAudit } from './customer.mjs'

export const router = express.Router()
router.use(requireAuth, requireRole('support'))

const sendLimit = limiter(10, 60_000, (r) => r.user.id)
const safe = (v, f) => { try { return JSON.parse(v) || f } catch { return f } }

router.get('/stats', (req, res) => {
  const c = one(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer'`).n
  const w = one(`SELECT COUNT(*) AS n FROM websites WHERE archived = 0`).n
  const a = one(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status IN ('pending','running') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed FROM audit_requests`)
  const reports = one('SELECT COUNT(*) AS n FROM audit_reports').n
  const unreadMailFailures = one(`SELECT COUNT(*) AS n FROM email_logs WHERE status != 'sent'`).n
  const customers = all(`SELECT id, full_name, email, company, created_at, email_verified_at FROM users WHERE role = 'customer' ORDER BY created_at DESC LIMIT 6`)
  const audits = all(`SELECT a.id, a.status, a.strategy, a.requested_at, w.name AS website_name, w.url, u.full_name AS customer, u.email
                        FROM audit_requests a JOIN websites w ON w.id = a.website_id JOIN users u ON u.id = a.user_id
                       ORDER BY a.requested_at DESC LIMIT 8`)
  const scores = all(`SELECT overall FROM audit_reports WHERE overall IS NOT NULL ORDER BY fetched_at DESC LIMIT 50`)
  const avgScore = scores.length ? Math.round(scores.reduce((s, r) => s + r.overall, 0) / scores.length) : null
  res.json({ customers: c, websites: w, audits: a, reports, avgScore, unreadMailFailures, recentCustomers: customers, recentAudits: audits })
})

router.get('/customers', (req, res) => {
  const q = String(req.query.q || '').trim()
  const like = `%${q}%`
  const rows = all(
    `SELECT u.id, u.full_name, u.email, u.company, u.phone, u.status, u.role, u.created_at, u.email_verified_at,
            (SELECT COUNT(*) FROM websites w WHERE w.user_id = u.id) AS websites,
            (SELECT COUNT(*) FROM audit_requests a WHERE a.user_id = u.id) AS audits,
            (SELECT MAX(r.fetched_at) FROM audit_reports r WHERE r.user_id = u.id) AS last_report
       FROM users u
      WHERE u.role = 'customer' AND (? = '' OR u.email LIKE ? OR u.full_name LIKE ? OR u.company LIKE ?)
      ORDER BY u.created_at DESC LIMIT 200`, q, like, like, like,
  )
  res.json({ customers: rows })
})

router.get('/customers/:id', (req, res) => {
  const user = one('SELECT id, full_name, email, company, phone, status, role, created_at, email_verified_at FROM users WHERE id = ?', req.params.id)
  if (!user) return res.status(404).json({ error: 'Customer not found.' })
  const websites = all(
    `SELECT w.*, (SELECT overall FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_score
       FROM websites w WHERE w.user_id = ? ORDER BY w.created_at DESC`, user.id)
  const audits = all(
    `SELECT a.id, a.status, a.strategy, a.requested_at, a.completed_at, a.error, w.name AS website_name, w.url,
            r.id AS report_id, r.overall
       FROM audit_requests a JOIN websites w ON w.id = a.website_id
       LEFT JOIN audit_reports r ON r.audit_request_id = a.id
      WHERE a.user_id = ? ORDER BY a.requested_at DESC LIMIT 50`, user.id)
  const emails = all('SELECT * FROM email_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 25', user.id)
  const activity = all('SELECT * FROM activity_logs WHERE actor_id = ? ORDER BY created_at DESC LIMIT 25', user.id)
  res.json({ customer: user, websites, audits, emails, activity })
})

router.patch('/customers/:id', requireRole('admin'), (req, res) => {
  const user = one('SELECT * FROM users WHERE id = ?', req.params.id)
  if (!user) return res.status(404).json({ error: 'Customer not found.' })
  if (user.role !== 'customer' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super admin can modify staff accounts.' })
  }
  const status = req.body?.status
  if (status && !['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status.' })
  if (status) {
    run(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`, status, user.id)
    if (status === 'suspended') run('DELETE FROM sessions WHERE user_id = ?', user.id)
    audit(req.user, `customer.${status}`, 'users', user.id)
  }
  res.json({ customer: one('SELECT id, email, status FROM users WHERE id = ?', user.id) })
})

router.patch('/staff/:id/role', requireRole('super_admin'), (req, res) => {
  const role = req.body?.role
  if (!['customer', 'support', 'admin', 'super_admin'].includes(role)) return res.status(400).json({ error: 'Invalid role.' })
  const target = one('SELECT * FROM users WHERE id = ?', req.params.id)
  if (!target) return res.status(404).json({ error: 'User not found.' })
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role.' })
  run(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`, role, target.id)
  audit(req.user, 'staff.role_changed', 'users', target.id, { from: target.role, to: role })
  res.json({ ok: true, role })
})

/* ── audits ────────────────────────────────────────────────────────────── */
router.get('/audits', (req, res) => {
  const { status, q } = req.query
  const like = `%${String(q || '').trim()}%`
  const rows = all(
    `SELECT a.*, w.name AS website_name, w.url, u.full_name AS customer, u.email,
            r.id AS report_id, r.overall
       FROM audit_requests a JOIN websites w ON w.id = a.website_id JOIN users u ON u.id = a.user_id
       LEFT JOIN audit_reports r ON r.audit_request_id = a.id
      WHERE (? = '' OR a.status = ?) AND (? = '' OR w.url LIKE ? OR u.email LIKE ? OR w.name LIKE ?)
      ORDER BY CASE a.status WHEN 'pending' THEN 0 WHEN 'running' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END,
               a.requested_at DESC LIMIT 200`,
    String(status || ''), String(status || ''), String(q || ''), like, like, like,
  )
  res.json({ audits: rows })
})

router.get('/audits/:id', (req, res) => {
  const row = one(
    `SELECT a.*, w.name AS website_name, w.url, u.full_name AS customer, u.email, u.id AS customer_id
       FROM audit_requests a JOIN websites w ON w.id = a.website_id JOIN users u ON u.id = a.user_id WHERE a.id = ?`, req.params.id)
  if (!row) return res.status(404).json({ error: 'Audit request not found.' })
  const report = one('SELECT * FROM audit_reports WHERE audit_request_id = ?', row.id)
  const notes = all(`SELECT n.*, u.full_name AS author FROM admin_notes n LEFT JOIN users u ON u.id = n.author_id
                      WHERE n.audit_request_id = ? ORDER BY n.created_at DESC`, row.id)
  const emails = all('SELECT * FROM email_logs WHERE report_id = ? OR (user_id = ? AND kind LIKE ?) ORDER BY created_at DESC',
    report?.id || 'none', row.customer_id, `%${row.id.slice(0, 8)}%`)
  res.json({
    audit: row,
    report: report ? { ...report, findings: safe(report.findings, {}).findings || [], metrics: safe(report.metrics, {}) } : null,
    notes, emails,
  })
})

router.post('/audits/:id/run', requireRole('admin'), (req, res) => {
  const row = one('SELECT * FROM audit_requests WHERE id = ?', req.params.id)
  if (!row) return res.status(404).json({ error: 'Audit request not found.' })
  if (row.status === 'running') return res.status(409).json({ error: 'This audit is already running.' })
  run(`UPDATE audit_requests SET status = 'pending', error = NULL WHERE id = ?`, row.id)
  enqueueAudit(row.id, req.user, baseUrl(req))
  audit(req.user, 'audit.queued_by_admin', 'audit_requests', row.id)
  res.status(202).json({ ok: true, status: 'pending' })
})

router.patch('/audits/:id/status', requireRole('admin'), (req, res) => {
  const status = req.body?.status
  if (!['pending', 'cancelled', 'failed'].includes(status)) return res.status(400).json({ error: 'Status can be set to pending, cancelled or failed here.' })
  const row = one('SELECT * FROM audit_requests WHERE id = ?', req.params.id)
  if (!row) return res.status(404).json({ error: 'Audit request not found.' })
  run('UPDATE audit_requests SET status = ? WHERE id = ?', status, row.id)
  audit(req.user, 'audit.status_changed', 'audit_requests', row.id, { to: status })
  res.json({ ok: true })
})

router.post('/audits/:id/notes', (req, res) => {
  const body = String(req.body?.body || '').trim()
  if (body.length < 2 || body.length > 2000) return res.status(400).json({ error: 'Note must be 2–2000 characters.' })
  const row = one('SELECT id FROM audit_requests WHERE id = ?', req.params.id)
  if (!row) return res.status(404).json({ error: 'Audit request not found.' })
  run('INSERT INTO admin_notes (id, audit_request_id, author_id, body) VALUES (?,?,?,?)', id(), row.id, req.user.id, body)
  res.status(201).json({ ok: true })
})

/* ── report PDF + delivery ─────────────────────────────────────────────── */
async function pdfFor(reportId) {
  const report = reportBundle(reportId)
  if (!report) return null
  const req = one('SELECT * FROM audit_requests WHERE id = ?', report.audit_request_id)
  const website = one('SELECT * FROM websites WHERE id = ?', report.website_id)
  const user = one('SELECT * FROM users WHERE id = ?', report.user_id)
  const buf = await buildReportPdf(report, req, website, user)
  return { buf, report, website, user }
}

router.get('/reports/:id/pdf', async (req, res) => {
  const bundle = await pdfFor(req.params.id)
  if (!bundle) return res.status(404).json({ error: 'Report not found.' })
  const fname = `SiteOps-${bundle.website.name.replace(/[^a-z0-9]+/gi, '-')}-${bundle.report.fetched_at.slice(0, 10)}.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
  res.send(bundle.buf)
})

router.post('/reports/:id/send', requireRole('admin'), sendLimit, async (req, res) => {
  const bundle = await pdfFor(req.params.id)
  if (!bundle) return res.status(404).json({ error: 'Report not found.' })
  const { report, website, user } = bundle
  const subject = `Your SiteOps report — ${website.name} (${report.overall ?? '—'}/100)`
  const html = layout({
    heading: 'Your website health report is attached',
    intro: `Hi ${user.full_name.split(' ')[0]}, here is the completed SiteOps audit for <strong>${website.name}</strong> (${report.url}).`,
    body: `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 4px">
      ${[['Overall', report.overall], ['Performance', report.performance], ['Accessibility', report.accessibility],
         ['Best practices', report.best_practices], ['SEO', report.seo]].map(([k, v]) =>
        `<tr><td style="padding:7px 0;border-bottom:1px solid #E3E8F0;font-size:13px;color:#44597A">${k}</td>
             <td style="padding:7px 0;border-bottom:1px solid #E3E8F0;font-size:13px;font-weight:700;text-align:right;color:#0B1220">${v ?? '—'}/100</td></tr>`).join('')}
    </table>
    <p style="font-size:12.5px;color:#8697B0;margin:14px 0 0">The full PDF is attached. Findings are Lighthouse measurements for a single run; network conditions can change scores.</p>`,
    cta: 'Open the report', ctaUrl: `${baseUrl(req)}/app/reports/${report.id}`,
    footerNote: 'You are receiving this report because you requested an audit in SiteOps.',
  })
  const result = await sendMail({
    to: user.email, subject, html, kind: 'report',
    attachments: [{ filename: `SiteOps-Report-${website.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`, content: bundle.buf.toString('base64') }],
    userId: user.id, reportId: report.id, sentBy: req.user.id,
  })
  if (result.ok) {
    notify(user, { type: 'report', title: 'Report emailed to you', body: `Your SiteOps report for ${website.name} was sent to ${user.email}.`, link: `/app/reports/${report.id}` })
    audit(req.user, 'report.emailed', 'audit_reports', report.id, { to: user.email })
  } else {
    audit(req.user, 'report.email_failed', 'audit_reports', report.id, { error: result.error })
  }
  res.status(result.ok ? 200 : 502).json({
    ...result,
    message: result.ok ? `Report sent to ${user.email}.`
      : result.status === 'not_configured' ? 'Email is not configured. Set RESEND_API_KEY and MAIL_FROM, then retry.'
        : `Email failed: ${result.error}`,
  })
})

router.post('/email-logs/:id/retry', requireRole('admin'), sendLimit, async (req, res) => {
  const log = one('SELECT * FROM email_logs WHERE id = ?', req.params.id)
  if (!log) return res.status(404).json({ error: 'Email log not found.' })
  if (log.status === 'sent') return res.status(409).json({ error: 'This email was already delivered.' })
  if (log.report_id) {
    // Re-enter the delivery route logic for the associated report.
    const bundle = await pdfFor(log.report_id)
    if (!bundle) return res.status(404).json({ error: 'Report no longer exists.' })
    const { report, website, user } = bundle
    const result = await sendMail({
      to: user.email, subject: log.subject, kind: log.kind,
      html: layout({
        heading: 'Your website health report is attached',
        intro: `Hi ${user.full_name.split(' ')[0]}, here is the completed SiteOps audit for <strong>${website.name}</strong>.`,
        cta: 'Open the report', ctaUrl: `${baseUrl(req)}/app/reports/${report.id}`,
      }),
      attachments: [{ filename: 'SiteOps-Report.pdf', content: bundle.buf.toString('base64') }],
      userId: user.id, reportId: report.id, sentBy: req.user.id,
    })
    audit(req.user, 'email.retried', 'email_logs', log.id, { ok: result.ok })
    return res.status(result.ok ? 200 : 502).json(result)
  }
  res.status(400).json({ error: 'Only report emails can be retried from this view.' })
})

router.get('/email-logs', (req, res) => {
  const rows = all(
    `SELECT e.*, u.full_name AS customer, r.url AS report_url FROM email_logs e
       LEFT JOIN users u ON u.id = e.user_id LEFT JOIN audit_reports r ON r.id = e.report_id
      ORDER BY e.created_at DESC LIMIT 200`)
  res.json({ emails: rows, configured: !!process.env.RESEND_API_KEY })
})

router.get('/activity', (req, res) => {
  const rows = all('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200')
  res.json({ activity: rows.map((r) => ({ ...r, meta: safe(r.meta, {}) })) })
})

router.get('/staff', requireRole('admin'), (req, res) => {
  res.json({ staff: all(`SELECT id, full_name, email, role, status, created_at FROM users WHERE role != 'customer' ORDER BY role DESC`) })
})

export { isStaff, isAdmin }
