import express from 'express'
import { one, run, id, audit } from '../db.mjs'
import {
  hashPassword, verifyPassword, upgradePassword, passwordProblem, createSession, destroySession,
  issueToken, consumeToken, limiter, safeJson, bearerToken,
} from '../auth.mjs'
import { sendMail, templates, mailConfigured, baseUrl, sandboxNotice } from '../mail.mjs'
import { notify } from '../notify.mjs'

export const router = express.Router()
/* Absolute links must use the origin the user is actually on, otherwise the
   session cookie lands on a different host. APP_URL wins only when explicitly set. */
const appOrigin = (req) => (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')
const emailLimit = limiter(12, 60_000, (r) => r.ip)
const norm = (s) => String(s || '').trim().toLowerCase()
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) && e.length <= 254

export function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    company: u.company,
    company_name: u.company_name || u.company,
    phone: u.phone,
    role: u.role,
    status: u.status,
    email_verified: !!u.email_verified_at,
    email_verified_at: u.email_verified_at,
    notification_prefs: safeJson(u.notification_prefs, {}),
    notification_preferences: safeJson(u.notification_preferences, {}),
    created_at: u.created_at,
  }
}

/** Dev convenience: without a mail provider the link is surfaced so the flow can
 *  be exercised. Never returned in production. */
const devLinkAllowed = () => !mailConfigured() && process.env.NODE_ENV !== 'production'

/* Registration — always creates a customer. Role can never be supplied by a client. */
router.post('/register', emailLimit, (req, res) => {
  const { full_name, email, password } = req.body || {}
  const name = String(full_name || '').trim()
  const mail = norm(email)
  const company = String(req.body?.company_name || req.body?.company || '').slice(0, 120) || null
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Please enter your full name.' })
  if (!validEmail(mail)) return res.status(400).json({ error: 'Enter a valid email address.' })
  const pwErr = passwordProblem(password)
  if (pwErr) return res.status(400).json({ error: pwErr })
  if (one('SELECT id FROM users WHERE email = ?', mail)) {
    return res.status(409).json({ error: 'An account with this email already exists. Try signing in instead.' })
  }
  const userId = id()
  run(
    `INSERT INTO users (id, email, password_hash, full_name, company, company_name, role,
       notification_preferences)
     VALUES (?,?,?,?,?,?, 'customer', '{"email_updates":true,"in_app_alerts":true}')`,
    userId, mail, hashPassword(password), name, company, company,
  )
  const token = issueToken(userId, 'verify', 24)
  const link = `${appOrigin(req)}/verify-email?token=${token}`
  const user = one('SELECT * FROM users WHERE id = ?', userId)
  sendMail({ to: mail, ...templates.verify(name.split(' ')[0], link), userId, sentBy: userId })
  notify(user, {
    type: 'account', title: 'Welcome to SiteOps',
    body: 'Verify your email address, then add your first website to request an audit.',
    link: '/dashboard/websites',
  })
  audit({ id: userId, email: mail, role: 'customer' }, 'USER_REGISTERED', 'users', userId, {}, req.ip)
  res.status(201).json({
    ok: true,
    message: 'Account created. Check your email to verify your address.',
    email: mail,
    email_delivery: mailConfigured() ? 'sent' : 'not_configured',
    dev_verification_url: devLinkAllowed() ? link : undefined,
    sandbox_notice: mailConfigured() ? sandboxNotice().message : null,
  })
})

router.post('/login', emailLimit, (req, res) => {
  const mail = norm(req.body?.email)
  const password = String(req.body?.password || '')
  const user = one('SELECT * FROM users WHERE email = ?', mail)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'This account is suspended. Contact support@siteops.in.' })
  }
  if (!user.email_verified_at) {
    return res.status(403).json({ error: 'Please verify your email address before signing in.', code: 'email_unverified' })
  }
  upgradePassword(user.id, password, user.password_hash)
  const token = createSession(res, user, req)
  audit(user, 'USER_LOGIN', 'users', user.id, {}, req.ip)
  // session_token is for mobile/API clients only; browsers use the httpOnly cookie.
  res.json({ user: publicUser(user), session_token: token })
})

router.post('/admin/login', emailLimit, (req, res) => {
  const mail = norm(req.body?.email)
  const password = String(req.body?.password || '')
  const user = one('SELECT * FROM users WHERE email = ?', mail)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    audit({ id: user.id, email: user.email, role: user.role }, 'ADMIN_LOGIN_DENIED', 'users', user.id,
      { reason: 'insufficient_role', attempted_role: user.role }, req.ip)
    return res.status(403).json({ error: 'This account does not have administrator access.' })
  }
  if (user.status !== 'active') return res.status(403).json({ error: 'This account is suspended.' })
  if (!user.email_verified_at) return res.status(403).json({ error: 'Verify your email before signing in.', code: 'email_unverified' })
  upgradePassword(user.id, password, user.password_hash)
  const token = createSession(res, user, req)
  audit(user, 'ADMIN_LOGIN', 'users', user.id, {}, req.ip)
  res.json({ user: publicUser(user), session_token: token })
})

router.post('/logout', (req, res) => {
  destroySession(req, res)
  res.json({ ok: true })
})

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

router.post('/verify-email', (req, res) => {
  const user = consumeToken(String(req.body?.token || ''), 'verify')
  if (!user) return res.status(400).json({ error: 'This verification link is invalid or has expired. Request a new one.' })
  run(`UPDATE users SET email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, user.id)
  notify(user, { type: 'account', title: 'Email verified', body: 'Your SiteOps account is fully active.', link: '/dashboard' })
  sendMail({ to: user.email, ...templates.welcome(user.full_name.split(' ')[0], baseUrl(req)), userId: user.id })
  audit(user, 'EMAIL_VERIFIED', 'users', user.id, {}, req.ip)
  res.json({ ok: true, message: 'Email verified. You can now sign in.' })
})

router.post('/resend-verification', emailLimit, (req, res) => {
  const mail = norm(req.body?.email)
  const user = one('SELECT * FROM users WHERE email = ?', mail)
  // Same response whether or not the account exists (no account enumeration).
  if (user && !user.email_verified_at) {
    const token = issueToken(user.id, 'verify', 24)
    const link = `${appOrigin(req)}/verify-email?token=${token}`
    sendMail({ to: mail, ...templates.verify(user.full_name.split(' ')[0], link), userId: user.id })
    if (devLinkAllowed()) {
      return res.json({ ok: true, message: 'Verification email re-sent.', dev_verification_url: link })
    }
  }
  res.json({ ok: true, message: 'If an unverified account exists for that address, a new link has been sent.' })
})

router.post('/forgot-password', emailLimit, (req, res) => {
  const mail = norm(req.body?.email)
  if (!validEmail(mail)) return res.status(400).json({ error: 'Enter a valid email address.' })
  const user = one('SELECT * FROM users WHERE email = ?', mail)
  let devLink
  if (user) {
    const token = issueToken(user.id, 'reset', 1)
    const link = `${appOrigin(req)}/reset-password?token=${token}`
    sendMail({ to: mail, ...templates.reset(user.full_name.split(' ')[0], link), userId: user.id })
    audit({ id: user.id, email: mail, role: user.role }, 'PASSWORD_RESET_REQUESTED', 'users', user.id, {}, req.ip)
    if (devLinkAllowed()) devLink = link
  }
  // Identical wording whether or not the account exists.
  res.json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.', dev_reset_url: devLink })
})

router.post('/reset-password', emailLimit, (req, res) => {
  const { token, password } = req.body || {}
  const pwErr = passwordProblem(password)
  if (pwErr) return res.status(400).json({ error: pwErr })
  const user = consumeToken(String(token || ''), 'reset')
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
  run(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, hashPassword(password), user.id)
  run('DELETE FROM sessions WHERE user_id = ?', user.id) // revoke all active sessions
  audit(user, 'PASSWORD_RESET', 'users', user.id, {}, req.ip)
  res.json({ ok: true, message: 'Password updated. Sign in with your new password.' })
})

/* ── authenticated account actions ─────────────────────────────────────── */
router.post('/change-password', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' })
  const { current_password, password } = req.body || {}
  const row = one('SELECT password_hash FROM users WHERE id = ?', req.user.id)
  if (!verifyPassword(String(current_password || ''), row.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' })
  }
  const pwErr = passwordProblem(password)
  if (pwErr) return res.status(400).json({ error: pwErr })
  run(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, hashPassword(password), req.user.id)
  run('DELETE FROM sessions WHERE user_id = ?', req.user.id) // revoke other sessions too
  destroySession(req, res)
  audit(req.user, 'PASSWORD_CHANGED', 'users', req.user.id, {}, req.ip)
  res.json({ ok: true, message: 'Password changed. Please sign in again.', signed_out: true })
})

router.patch(['/profile', '/account'], (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' })
  const name = String(req.body?.full_name || '').trim()
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Please enter your full name.' })
  const company = String(req.body?.company_name ?? req.body?.company ?? '').slice(0, 120) || null
  const phone = String(req.body?.phone ?? '').slice(0, 30) || null
  run(
    `UPDATE users SET full_name = ?, company = ?, company_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`,
    name, company, company, phone, req.user.id,
  )
  audit(req.user, 'PROFILE_UPDATED', 'users', req.user.id, {}, req.ip)
  res.json({ user: publicUser(one('SELECT * FROM users WHERE id = ?', req.user.id)) })
})

router.patch('/preferences', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' })
  const body = req.body || {}
  // Spec-shaped preferences (email_updates / in_app_alerts) and the legacy
  // email_reports / email_audits / push keys both work.
  const spec = safeJson(one('SELECT notification_preferences FROM users WHERE id = ?', req.user.id).notification_preferences, {})
  const legacy = safeJson(one('SELECT notification_prefs FROM users WHERE id = ?', req.user.id).notification_prefs, {})
  for (const k of ['email_updates', 'in_app_alerts']) if (typeof body[k] === 'boolean') spec[k] = body[k]
  for (const k of ['email_reports', 'email_audits', 'push']) if (typeof body[k] === 'boolean') legacy[k] = body[k]
  if (typeof body.email_updates === 'boolean') {
    legacy.email_reports = body.email_updates
    legacy.email_audits = body.email_updates
  }
  run(
    `UPDATE users SET notification_prefs = ?, notification_preferences = ?, updated_at = datetime('now') WHERE id = ?`,
    JSON.stringify(legacy), JSON.stringify(spec), req.user.id,
  )
  res.json({ notification_preferences: spec, notification_prefs: legacy })
})

/* ── sessions (for account settings / mobile device list) ──────────────── */
router.get('/sessions', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' })
  const rows = one('SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', req.user.id)
  res.json({ current: !!rows, note: 'Session tokens are stored hashed and cannot be listed.' })
})
router.post('/sessions/revoke-all', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' })
  run('DELETE FROM sessions WHERE user_id = ?', req.user.id)
  destroySession(req, res)
  audit(req.user, 'SESSIONS_REVOKED', 'users', req.user.id, { token_present: !!bearerToken(req) })
  res.json({ ok: true })
})
