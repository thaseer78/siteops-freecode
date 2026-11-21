import express from 'express'
import { all, one, run, id, audit } from '../db.mjs'
import { requireAuth, requireRole, isStaff, isAdmin, limiter, safeJson } from '../auth.mjs'
import { sendMail, layout, baseUrl, sandboxNotice, senderEmail, mailConfigured } from '../mail.mjs'
import { reportFile, reportBundle } from '../pdf.mjs'
import { notify } from '../notify.mjs'
import { enqueueAudit, reportShape, requestShape } from './customer.mjs'

export const router = express.Router()
router.use(requireAuth, requireRole('admin'))

const sendLimit = limiter(10, 60_000, (r) => r.user.id)
const validEnquiryStatus = ['pending', 'in_progress', 'completed', 'failed', 'cancelled']

const toStatus = (s) => (s === 'running' ? 'in_progress' : s)

/* ── overview ──────────────────────────────────────────────────────────── */
router.get(['/stats', '/overview'], (req, res) => {
  const customers = one(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer'`).n
  const pendingEnquiries = one(`SELECT COUNT(*) AS n FROM audit_requests WHERE status IN ('pending','in_progress','running')`).n
  const completed = one(`SELECT COUNT(*) AS n FROM audit_requests WHERE status = 'completed'`).n
  const failedDeliveries = one(
    `SELECT COUNT(*) AS n FROM email_delivery_logs WHERE status = 'failed' AND kind = 'report'`,
  ).n
  const reports = one('SELECT COUNT(*) AS n FROM audit_reports').n
  const scores = all(`SELECT overall FROM audit_reports WHERE overall IS NOT NULL ORDER BY fetched_at DESC LIMIT 50`)
  const recentEnquiries = all(
    `SELECT a.id, a.status, a.strategy, a.requested_at, a.customer_notes, w.name AS website_name, w.url,
            u.full_name AS customer, u.email
       FROM audit_requests a JOIN websites w ON w.id = a.website_id JOIN users u ON u.id = a.user_id
      ORDER BY a.requested_at DESC LIMIT 8`,
  ).map(requestShape)
  const recentActivity = all(
    `SELECT id, actor_email, actor_role, action, entity_type, entity_id, created_at
       FROM activity_logs ORDER BY created_at DESC LIMIT 10`,
  )
  res.json({
    customers,
    pendingEnquiries,
    completedAudits: completed,
    failedDeliveries,
    reports,
    avgScore: scores.length ? Math.round(scores.reduce((s, r) => s + r.overall, 0) / scores.length) : null,
    recentCustomers: all(
      `SELECT id, full_name, email, company, created_at, email_verified_at FROM users
        WHERE role = 'customer' ORDER BY created_at DESC LIMIT 6`,
    ),
    recentEnquiries,
    recentAudits: recentEnquiries,
    recentActivity,
    email: { configured: mailConfigured(), ...sandboxNotice() },
    // legacy keys the existing dashboard reads
    audits: { total: completed, pending: pendingEnquiries, completed, failed: one(`SELECT COUNT(*) AS n FROM audit_requests WHERE status = 'failed'`).n },
    unreadMailFailures: failedDeliveries,
  })
})

/* ── customers ─────────────────────────────────────────────────────────── */
router.get('/customers', (req, res) => {
  const q = String(req.query.q || '').trim()
  const like = `%${q}%`
  const rows = all(
    `SELECT u.id, u.full_name, u.email, u.company, u.phone, u.status, u.role, u.created_at,
            u.email_verified_at,
            (SELECT COUNT(*) FROM websites w WHERE w.customer_id = u.id) AS websites,
            (SELECT COUNT(*) FROM audit_requests a WHERE a.customer_id = u.id) AS audits,
            (SELECT MAX(r.fetched_at) FROM audit_reports r WHERE r.customer_id = u.id) AS last_report
       FROM users u
      WHERE u.role = 'customer'
        AND (? = '' OR u.email LIKE ? OR u.full_name LIKE ? OR u.company LIKE ? OR u.company_name LIKE ?)
      ORDER BY u.created_at DESC LIMIT 200`,
    q, like, like, like, like,
  )
  res.json({ customers: rows })
})

router.get('/customers/:id', (req, res) => {
  const user = one(
    `SELECT id, full_name, email, company, company_name, phone, status, role, created_at, email_verified_at
       FROM users WHERE id = ?`, req.params.id,
  )
  if (!user) return res.status(404).json({ error: 'Customer not found.' })
  const websites = all(
    `SELECT w.*, (SELECT overall FROM audit_reports r WHERE r.website_id = w.id ORDER BY r.fetched_at DESC LIMIT 1) AS latest_score
       FROM websites w WHERE w.customer_id = ? ORDER BY w.created_at DESC`, user.id,
  )
  const audits = all(
    `SELECT a.*, w.name AS website_name, w.url, r.id AS report_id, r.overall
       FROM audit_requests a JOIN websites w ON w.id = a.website_id
       LEFT JOIN audit_reports r ON r.audit_request_id = a.id
      WHERE a.customer_id = ? ORDER BY a.requested_at DESC LIMIT 50`, user.id,
  ).map((a) => ({ ...a, status: toStatus(a.status) }))
  const reports = all(
    `SELECT r.id, r.url, r.overall, r.mobile_scores, r.desktop_scores, r.audited_at, r.fetched_at, w.name AS website_name
       FROM audit_reports r JOIN websites w ON w.id = r.website_id
      WHERE r.customer_id = ? ORDER BY r.fetched_at DESC LIMIT 25`, user.id,
  )
  const emails = all('SELECT * FROM email_delivery_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT 25', user.id)
  const activity = all('SELECT * FROM activity_logs WHERE actor_user_id = ? ORDER BY created_at DESC LIMIT 25', user.id)
  res.json({ customer: user, websites, audits, reports, emails, activity })
})

router.patch('/customers/:id', (req, res) => {
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
    audit(req.user, `CUSTOMER_${status.toUpperCase()}`, 'users', user.id, {}, req.ip)
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
  audit(req.user, 'STAFF_ROLE_CHANGED', 'users', target.id, { from: target.role, to: role }, req.ip)
  res.json({ ok: true, role })
})

/* ── audit enquiries ───────────────────────────────────────────────────── */
function enquiryRows(req) {
  const status = String(req.query.status || '')
  const q = String(req.query.q || '').trim()
  const like = `%${q}%`
  const mapped = toStatus(status)
  return all(
    `SELECT a.*, w.name AS website_name, w.display_name, w.url, w.normalized_domain,
            u.full_name AS customer, u.email, u.company,
            r.id AS report_id, r.overall,
            (SELECT full_name FROM users WHERE id = a.assigned_admin_id) AS assigned_admin
       FROM audit_requests a
       JOIN websites w ON w.id = a.website_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN audit_reports r ON r.audit_request_id = a.id
      WHERE (? = '' OR a.status = ?)
        AND (? = '' OR w.url LIKE ? OR w.name LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)
      ORDER BY CASE a.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'running' THEN 1
                WHEN 'failed' THEN 2 ELSE 3 END, a.requested_at DESC
      LIMIT 200`,
    mapped, mapped, q, like, like, like, like,
  ).map((r) => ({ ...r, status: toStatus(r.status) }))
}

router.get(['/enquiries', '/audits'], (req, res) => {
  const rows = enquiryRows(req)
  res.json({ enquiries: rows, audits: rows })
})

function enquiryDetail(enquiryId) {
  const row = one(
    `SELECT a.*, w.name AS website_name, w.display_name, w.url, w.normalized_domain,
            u.full_name AS customer, u.email, u.id AS customer_id, u.company, u.phone
       FROM audit_requests a JOIN websites w ON w.id = a.website_id JOIN users u ON u.id = a.user_id
      WHERE a.id = ?`, enquiryId,
  )
  if (!row) return null
  const report = one('SELECT * FROM audit_reports WHERE audit_request_id = ?', row.id)
  const notes = all(
    `SELECT n.*, u.full_name AS author FROM admin_notes n LEFT JOIN users u ON u.id = n.author_id
      WHERE n.audit_request_id = ? ORDER BY n.created_at DESC`, row.id,
  )
  const emails = all(
    'SELECT * FROM email_delivery_logs WHERE report_id = ? ORDER BY created_at DESC', report?.id || 'none',
  )
  return {
    audit: { ...row, status: toStatus(row.status) },
    enquiry: { ...row, status: toStatus(row.status) },
    report: report ? { ...reportShape(report), website_name: row.website_name, customer: row.customer, email: row.email } : null,
    raw_report: report || null,
    notes,
    emails,
    email: { configured: mailConfigured(), ...sandboxNotice() },
  }
}

router.get(['/enquiries/:id', '/audits/:id'], (req, res) => {
  const detail = enquiryDetail(req.params.id)
  if (!detail) return res.status(404).json({ error: 'Audit enquiry not found.' })
  res.json(detail)
})

router.patch(['/enquiries/:id', '/audits/:id/status'], (req, res) => {
  const row = one('SELECT * FROM audit_requests WHERE id = ?', req.params.id)
  if (!row) return res.status(404).json({ error: 'Audit enquiry not found.' })
  const patch = {}
  if (req.body?.status !== undefined) {
    const status = toStatus(req.body.status)
    if (!validEnquiryStatus.includes(status)) return res.status(400).json({ error: 'Invalid status.' })
    if (status === 'in_progress' && !['pending', 'in_progress'].includes(toStatus(row.status))) {
      return res.status(409).json({ error: 'Only a pending enquiry can be moved to in progress.' })
    }
    patch.status = row.status === 'running' && status === 'in_progress' ? 'running' : status
  }
  if (req.body?.internal_admin_notes !== undefined) {
    patch.internal_admin_notes = String(req.body.internal_admin_notes).slice(0, 5000) || null
  }
  if (req.body?.assigned_admin_id !== undefined) {
    const assignee = req.body.assigned_admin_id ? one('SELECT id FROM users WHERE id = ?', req.body.assigned_admin_id) : null
    if (req.body.assigned_admin_id && !assignee) return res.status(400).json({ error: 'Assigned admin not found.' })
    patch.assigned_admin_id = assignee?.id || null
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' })
  const sets = Object.keys(patch).map((k) => `${k} = ?`).join(', ')
  run(`UPDATE audit_requests SET ${sets}, updated_at = datetime('now') WHERE id = ?`, ...Object.values(patch), row.id)
  if (patch.status === 'completed') {
    run(`UPDATE audit_requests SET completed_at = COALESCE(completed_at, datetime('now')) WHERE id = ?`, row.id)
  }
  audit(req.user, patch.status ? 'ENQUIRY_STATUS_UPDATED' : 'ENQUIRY_UPDATED', 'audit_requests', row.id,
    { ...patch, previous_status: toStatus(row.status) }, req.ip)
  res.json(enquiryDetail(row.id))
})

router.post('/enquiries/:id/notes', (req, res) => {
  const body = String(req.body?.body || '').trim()
  if (body.length < 2 || body.length > 2000) return res.status(400).json({ error: 'Note must be 2–2000 characters.' })
  const row = one('SELECT id FROM audit_requests WHERE id = ?', req.params.id)
  if (!row) return res.status(404).json({ error: 'Audit enquiry not found.' })
  run('INSERT INTO admin_notes (id, audit_request_id, author_id, body) VALUES (?,?,?,?)', id(), row.id, req.user.id, body)
  audit(req.user, 'ADMIN_NOTE_ADDED', 'audit_requests', row.id)
  res.status(201).json({ ok: true })
})

/** Queue an audit run. Works for both /enquiries and /audits paths. */
async function queueRun(req, res) {
  const row = one('SELECT * FROM audit_requests WHERE id = ?', req.params.id)
  if (!row) return res.status(404).json({ error: 'Audit enquiry not found.' })
  const status = toStatus(row.status)
  if (status === 'in_progress') return res.status(409).json({ error: 'This audit is already running.' })
  run(
    `UPDATE audit_requests SET status = 'pending', error = NULL, internal_admin_notes = COALESCE(internal_admin_notes, NULL)
       WHERE id = ?`, row.id,
  )
  if (req.body?.assigned_admin_id !== undefined || !row.assigned_admin_id) {
    run('UPDATE audit_requests SET assigned_admin_id = COALESCE(?, assigned_admin_id) WHERE id = ?', req.user.id, row.id)
  }
  audit(req.user, 'AUDIT_QUEUED_BY_ADMIN', 'audit_requests', row.id, {}, req.ip)
  enqueueAudit(row.id, { ...req.user, ip: req.ip }, baseUrl(req))
  res.status(202).json({ ok: true, status: 'pending', id: row.id })
}
router.post(['/enquiries/:id/run', '/audits/:id/run'], requireRole('admin'), sendLimit, queueRun)

/* keep the older admin surface working */
router.get('/audits', (req, res) => {
  const rows = enquiryRows(req)
  res.json({ audits: rows })
})

/* ── reports ───────────────────────────────────────────────────────────── */
router.get('/reports', (req, res) => {
  const rows = all(
    `SELECT r.*, w.name AS website_name, u.full_name AS customer, u.email AS customer_email
       FROM audit_reports r JOIN websites w ON w.id = r.website_id JOIN users u ON u.id = r.user_id
      ORDER BY r.fetched_at DESC LIMIT 200`,
  )
  res.json({
    reports: rows.map((r) => ({
      ...reportShape(r), website_name: r.website_name, customer: r.customer, customer_email: r.customer_email,
    })),
  })
})

router.get('/reports/:id', (req, res) => {
  const report = one('SELECT * FROM audit_reports WHERE id = ?', req.params.id)
  if (!report) return res.status(404).json({ error: 'Report not found.' })
  const detail = enquiryDetail(report.audit_request_id)
  if (!detail) return res.status(404).json({ error: 'Report not found.' })
  res.json({ ...detail, report: { ...detail.report, website_name: detail.audit.website_name } })
})

async function pdfBundle(reportId) {
  const exists = one('SELECT id FROM audit_reports WHERE id = ?', reportId)
  if (!exists) return null
  return reportFile(reportId)
}

router.get('/reports/:id/pdf', async (req, res, next) => {
  try {
    const bundle = await pdfBundle(req.params.id)
    if (!bundle) return res.status(404).json({ error: 'Report not found.' })
    const name = (bundle.website?.display_name || bundle.website?.name || 'site').replace(/[^a-z0-9]+/gi, '-')
    const date = String(bundle.report.audited_at || bundle.report.fetched_at || '').slice(0, 10)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="SiteOps-${name}-${date}.pdf"`)
    res.send(bundle.buf)
  } catch (err) { next(err) }
})

/** Regenerate the branded PDF and record where the file was stored. */
router.post('/reports/:id/pdf', requireRole('admin'), async (req, res, next) => {
  try {
    const bundle = await pdfBundle(req.params.id)
    if (!bundle) return res.status(404).json({ error: 'Report not found.' })
    run(`UPDATE audit_reports SET pdf_file_path = ?, updated_at = datetime('now') WHERE id = ?`,
      bundle.file, req.params.id)
    audit(req.user, 'REPORT_PDF_GENERATED', 'audit_reports', req.params.id, {}, req.ip)
    res.json({ ok: true, bytes: bundle.buf.length, generated_at: new Date().toISOString() })
  } catch (err) { next(err) }
})

/* ── manual report email ───────────────────────────────────────────────── */
function reportEmail(report, website, user, base) {
  const m = safeJson(report.mobile_scores, {})
  const d = safeJson(report.desktop_scores, {})
  const rowsHtml = [['Mobile', m], ['Desktop', d]].flatMap(([label, s]) =>
    s && Object.keys(s).length
      ? [[`${label} performance`, s.performance], [`${label} accessibility`, s.accessibility],
         [`${label} best practices`, s.best_practices], [`${label} SEO`, s.seo]]
      : []).map(([k, v]) =>
      `<tr><td style="padding:6px 0;border-bottom:1px solid #E3E8F0;font-size:13px;color:#44597A">${k}</td>
           <td style="padding:6px 0;border-bottom:1px solid #E3E8F0;font-size:13px;font-weight:700;text-align:right;color:#0B1220">${v ?? '—'}/100</td></tr>`).join('')
  return {
    subject: `Your SiteOps report — ${website.display_name || website.name} (${report.overall ?? '—'}/100)`,
    html: layout({
      heading: 'Your website health report is attached',
      intro: `Hi ${user.full_name.split(' ')[0]}, here is the completed SiteOps audit for <strong>${website.display_name || website.name}</strong> (${report.url}).`,
      body: `${rowsHtml ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 4px">${rowsHtml}</table>` : ''}
        <p style="font-size:12.5px;color:#8697B0;margin:14px 0 0">The full branded PDF is attached. Findings are Lighthouse measurements for a single run on each device; network conditions can change scores.</p>`,
      cta: 'Open the report', ctaUrl: `${base}/dashboard/reports/${report.id}`,
      footerNote: 'You are receiving this report because you requested an audit in SiteOps.',
    }),
  }
}

/** Locked recipient: always the email stored on the customer record. */
function recipientFor(reportId) {
  const report = reportBundle(reportId)
  if (!report) return null
  const website = one('SELECT * FROM websites WHERE id = ?', report.website_id)
  const user = one('SELECT * FROM users WHERE id = ?', report.user_id)
  if (!user) return null
  return { report, website, user, recipient: user.email }
}

router.post('/reports/:id/send', requireRole('admin'), sendLimit, async (req, res, next) => {
  try {
    const bundle = await pdfBundle(req.params.id)
    if (!bundle) return res.status(404).json({ error: 'Report not found.' })
    const locked = recipientFor(req.params.id)
    // The request body's email is ignored by design: the recipient comes from the DB.
    const { report, website, user } = locked
    const mail = reportEmail(report, website, user, baseUrl(req))
    const result = await sendMail({
      to: user.email, subject: mail.subject, html: mail.html, kind: 'report',
      attachments: [{ filename: `SiteOps-Report-${(website.display_name || website.name).replace(/[^a-z0-9]+/gi, '-')}.pdf`,
        content: bundle.buf.toString('base64') }],
      userId: user.id, reportId: report.id, sentBy: req.user.id,
    })
    if (result.ok) {
      notify(user, {
        type: 'report', title: 'Report emailed to you',
        body: `Your SiteOps report for ${website.display_name || website.name} was sent to ${user.email}.`,
        link: `/dashboard/reports/${report.id}`,
      })
      audit(req.user, 'REPORT_EMAIL_SENT', 'audit_reports', report.id, { recipient: user.email, log: result.logId }, req.ip)
    } else {
      audit(req.user, 'REPORT_EMAIL_FAILED', 'audit_reports', report.id,
        { recipient: user.email, error: result.error }, req.ip)
    }
    res.status(result.ok ? 200 : 502).json({
      ...result,
      recipient: user.email,
      sandbox_notice: sandboxNotice().message,
      message: result.ok ? `Report sent to ${user.email}.`
        : result.status === 'failed' && !mailConfigured()
          ? 'Email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL, then retry.'
          : `Email failed: ${result.error}`,
    })
  } catch (err) { next(err) }
})

router.post('/email-logs/:id/retry', requireRole('admin'), sendLimit, async (req, res, next) => {
  try {
    const log = one('SELECT * FROM email_delivery_logs WHERE id = ?', req.params.id)
      || one('SELECT * FROM email_logs WHERE id = ?', req.params.id)
    if (!log) return res.status(404).json({ error: 'Delivery log not found.' })
    if (log.status === 'sent') return res.status(409).json({ error: 'This email was already delivered.' })
    const reportId = log.report_id
    if (!reportId) return res.status(400).json({ error: 'Only report emails can be retried from this view.' })
    const bundle = await pdfBundle(reportId)
    if (!bundle) return res.status(404).json({ error: 'Report no longer exists.' })
    const locked = recipientFor(reportId)
    if (!locked) return res.status(404).json({ error: 'Customer record no longer exists.' })
    const mail = reportEmail(locked.report, locked.website, locked.user, baseUrl(req))
    run(`UPDATE email_delivery_logs SET retry_count = retry_count + 1, updated_at = datetime('now') WHERE id = ?`,
      log.id)
    const result = await sendMail({
      to: locked.user.email, subject: mail.subject, html: mail.html, kind: 'report',
      attachments: [{ filename: 'SiteOps-Report.pdf', content: bundle.buf.toString('base64') }],
      userId: locked.user.id, reportId, sentBy: req.user.id,
    })
    if (!mailConfigured()) {
      run(`UPDATE email_delivery_logs SET retry_count = retry_count - 1 WHERE id = ?`, log.id)
      return res.status(502).json({ ...result, error: 'Email delivery is not configured on this deployment.' })
    }
    audit(req.user, 'EMAIL_RETRIED', 'email_delivery_logs', log.id,
      { ok: result.ok, retry_count: (log.retry_count || 0) + 1 }, req.ip)
    res.status(result.ok ? 200 : 502).json({ ...result, recipient: locked.user.email })
  } catch (err) { next(err) }
})

router.get(['/emails', '/email-logs', '/logs/emails'], (req, res) => {
  const status = String(req.query.status || '')
  const rows = all(
    `SELECT e.*, u.full_name AS customer, r.url AS report_url
       FROM email_delivery_logs e
       LEFT JOIN users u ON u.id = e.customer_id
       LEFT JOIN audit_reports r ON r.id = e.report_id
      WHERE (? = '' OR e.status = ?)
      ORDER BY e.created_at DESC LIMIT 200`, status, status,
  )
  res.json({
    emails: rows.map((r) => ({
      ...r, to_email: r.recipient_email, user_id: r.customer_id, provider_id: r.provider_message_id,
      error: r.error_message, sent_by: r.triggered_by_admin_id,
    })),
    configured: mailConfigured(),
    ...sandboxNotice(),
  })
})

/* ── activity logs ─────────────────────────────────────────────────────── */
router.get(['/logs', '/activity'], (req, res) => {
  const q = String(req.query.q || '').trim()
  const action = String(req.query.action || '').trim()
  const like = `%${q}%`
  const rows = all(
    `SELECT id, actor_id, actor_email, actor_role, action, entity_type, entity_id,
            metadata, ip_address, created_at
       FROM activity_logs
      WHERE (? = '' OR action LIKE ?) AND (? = '' OR actor_email LIKE ? OR action LIKE ? OR entity_type LIKE ?)
      ORDER BY created_at DESC LIMIT 300`,
    action, `%${action}%`, q, like, like, like,
  )
  res.json({
    activity: rows.map((r) => ({ ...r, meta: safeJson(r.metadata, {}), entity: r.entity_type })),
    actions: all('SELECT DISTINCT action FROM activity_logs ORDER BY action').map((r) => r.action),
  })
})

router.get('/staff', requireRole('super_admin'), (req, res) => {
  res.json({
    staff: all(
      `SELECT id, full_name, email, role, status, created_at FROM users
        WHERE role != 'customer' ORDER BY role DESC`,
    ),
  })
})

export { isStaff, isAdmin }
