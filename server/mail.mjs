import { run, one, id } from './db.mjs'

const API = 'https://api.resend.com/emails'
export const mailConfigured = () => !!process.env.RESEND_API_KEY

/** Public base URL for links inside emails: explicit APP_URL, else the request origin. */
export const baseUrl = (req) =>
  (process.env.APP_URL || (req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:3000')).replace(/\/$/, '')

export const senderEmail = () => process.env.RESEND_FROM_EMAIL || process.env.MAIL_FROM || 'SiteOps <onboarding@resend.dev>'

const SANDBOX_SENDER = /onboarding@resend\.dev/i
const isSandbox = () => SANDBOX_SENDER.test(senderEmail())

/** Resend's shared sandbox sender can only deliver to the account owner's address. */
export const sandboxNotice = () =>
  isSandbox()
    ? {
        sandbox: true,
        sender: senderEmail(),
        message:
          'Emails are being sent from Resend\'s sandbox address (onboarding@resend.dev). Until a custom domain is verified in Resend, delivery is restricted to the Resend account owner\'s email address. Verify a domain and set RESEND_FROM_EMAIL to send to any customer.',
      }
    : { sandbox: false, sender: senderEmail(), message: null }

/**
 * Send a transactional email and always record the attempt.
 * Delivery status is queued | sent | failed. `not_configured` is kept in the
 * legacy email_logs table for backward compatibility and reported as failed here.
 */
export async function sendMail({
  to, subject, html, text, attachments = [], kind, userId = null, reportId = null, sentBy = null,
}) {
  const startedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const legacyBase = { user_id: userId, report_id: reportId, to_email: to, kind, subject, sent_by: sentBy }
  const from = senderEmail()

  const logDelivery = (status, extra = {}) => {
    const logId = extra.id || id()
    run(
      `INSERT INTO email_delivery_logs
        (id, report_id, customer_id, recipient_email, sender_email, subject, kind, status,
         provider_message_id, error_message, retry_count, triggered_by_admin_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      logId, reportId, userId, to, from, subject, kind || 'transactional', status,
      extra.providerId || null, extra.error || null, extra.retryCount || 0, sentBy, startedAt, startedAt,
    )
    return logId
  }
  const logLegacy = (status, extra = {}) => {
    run(
      `INSERT INTO email_logs (id, user_id, report_id, to_email, kind, subject, status, provider_id, error, sent_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      extra.id, userId, reportId, to, kind, subject, status, extra.providerId || null, extra.error || null, sentBy,
    )
  }

  if (!mailConfigured()) {
    const logId = id()
    logDelivery('failed', { id: logId, error: 'RESEND_API_KEY is not set' })
    logLegacy('not_configured', { id: logId, error: 'RESEND_API_KEY is not set' })
    return { ok: false, status: 'failed', error: 'Email delivery is not configured on this deployment.', logId }
  }

  const body = {
    from,
    to: [to], subject, html, text,
    ...(attachments.length ? { attachments } : {}),
  }
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = json?.message || json?.error?.message || `Resend returned HTTP ${res.status}`
      const logId = id()
      logDelivery('failed', { id: logId, error: err })
      logLegacy('failed', { id: logId, error: err })
      return { ok: false, status: 'failed', error: err, logId, sandbox: isSandbox() }
    }
    const logId = id()
    logDelivery('sent', { id: logId, providerId: json?.id })
    logLegacy('sent', { id: logId, providerId: json?.id })
    return { ok: true, status: 'sent', logId, providerId: json?.id }
  } catch (err) {
    const logId = id()
    const message = String(err.message).slice(0, 400)
    logDelivery('failed', { id: logId, error: message })
    logLegacy('failed', { id: logId, error: message })
    return { ok: false, status: 'failed', error: message, logId }
  }
}

/** Bump the retry counter of an existing delivery attempt and re-send. */
export async function retryDelivery(log, payload) {
  run(
    `UPDATE email_delivery_logs SET retry_count = retry_count + 1, updated_at = datetime('now') WHERE id = ?`,
    log.id,
  )
  return sendMail({ ...payload, retryCount: (log.retry_count || 0) + 1 })
}

/* ── Branded email layout ─────────────────────────────────────────────── */
export function layout({ heading, intro, body = '', cta, ctaUrl, footerNote }) {
  return `<!doctype html><html><body style="margin:0;background:#F2F5FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0B1220">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F5FA;padding:32px 12px">
   <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E3E8F0">
     <tr><td style="background:#0B1220;padding:22px 28px">
       <span style="color:#34D3A4;font-size:11px;letter-spacing:2.5px;font-weight:700">SITEOPS</span>
       <div style="color:#8FA3C0;font-size:11px;margin-top:4px">From AI-built to business-ready.</div>
     </td></tr>
     <tr><td style="padding:30px 28px 8px">
       <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0B1220">${heading}</h1>
       <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#44597A">${intro}</p>
       ${body}
       ${cta ? `<p style="margin:22px 0 6px"><a href="${ctaUrl}" style="background:#0E9673;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-size:14px;font-weight:600;display:inline-block">${cta}</a></p>
       <p style="font-size:12px;color:#8697B0;margin:10px 0 0;word-break:break-all">${ctaUrl}</p>` : ''}
     </td></tr>
     <tr><td style="padding:22px 28px 28px">
       <p style="margin:0;font-size:11.5px;color:#8697B0;line-height:1.6;border-top:1px solid #E3E8F0;padding-top:14px">
         ${footerNote || 'You are receiving this because you have a SiteOps account.'}<br>SiteOps · India · support@siteops.in
       </p>
     </td></tr>
    </table>
   </td></tr>
  </table></body></html>`
}

export const templates = {
  verify: (name, link) => ({
    subject: 'Verify your SiteOps email address',
    html: layout({
      heading: 'Confirm your email address',
      intro: `Hi ${name}, welcome to SiteOps. Confirm your email to activate your account and start registering websites.`,
      cta: 'Verify email', ctaUrl: link,
      footerNote: 'This link expires in 24 hours. If you did not create a SiteOps account, ignore this email.',
    }),
    kind: 'verify',
  }),
  reset: (name, link) => ({
    subject: 'Reset your SiteOps password',
    html: layout({
      heading: 'Choose a new password',
      intro: `Hi ${name}, we received a request to reset your SiteOps password. This link is valid for one hour.`,
      cta: 'Reset password', ctaUrl: link,
      footerNote: 'If you did not request this, your password has not changed.',
    }),
    kind: 'reset',
  }),
  welcome: (name, base = baseUrl()) => ({
    subject: 'Your SiteOps account is ready',
    html: layout({
      heading: `You're all set, ${name}`,
      intro: 'Your email is verified. Add your first website to request a PageSpeed audit and receive a branded health report.',
      cta: 'Open dashboard', ctaUrl: `${base}/dashboard`,
    }),
    kind: 'welcome',
  }),
  auditReceived: (name, website, requestId, base = baseUrl()) => ({
    subject: `Audit request received — ${website}`,
    html: layout({
      heading: 'Your audit request is in the queue',
      intro: `Hi ${name}, we've received your audit request for <strong>${website}</strong>. Our team runs each audit then reviews and delivers the report. You'll get an email the moment it is ready.`,
      body: `<p style="font-size:12px;color:#8697B0;margin:0">Request reference: ${requestId.slice(0, 8).toUpperCase()}</p>`,
      cta: 'View request', ctaUrl: `${base}/dashboard/requests`,
    }),
    kind: 'audit_received',
  }),
  auditCompleted: (name, website, base = baseUrl()) => ({
    subject: `Audit completed — ${website}`,
    html: layout({
      heading: 'Your website audit is complete',
      intro: `Hi ${name}, the audit for <strong>${website}</strong> has finished. Open SiteOps to review mobile and desktop scores, findings and priorities.`,
      cta: 'View report', ctaUrl: `${base}/dashboard/reports`,
    }),
    kind: 'audit_completed',
  }),
}
