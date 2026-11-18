import express from 'express'
import { one, run, id, audit } from '../db.mjs'
import {
  hashPassword, verifyPassword, passwordProblem, createSession, destroySession,
  issueToken, consumeToken, limiter,
} from '../auth.mjs'
import { sendMail, templates, mailConfigured, baseUrl } from '../mail.mjs'
import { notify } from '../notify.mjs'

export const router = express.Router()
/* Absolute links must use the origin the user is actually on, otherwise the
   session cookie lands on a different host. APP_URL wins only when explicitly set. */
const appOrigin = (req) => (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')
const emailLimit = limiter(12, 60_000, (r) => r.ip)
const norm = (s) => String(s || '').trim().toLowerCase()
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) && e.length <= 254

function publicUser(u) {
  return {
    id: u.id, email: u.email, full_name: u.full_name, company: u.company, phone: u.phone,
    role: u.role, status: u.status, email_verified: !!u.email_verified_at,
    notification_prefs: typeof u.notification_prefs === 'string' ? JSON.parse(u.notification_prefs) : u.notification_prefs,
    created_at: u.created_at,
  }
}

/* Registration — always creates a customer. Role can never be supplied by a client. */
router.post('/register', emailLimit, (req, res) => {
  const { full_name, email, password, company } = req.body || {}
  const name = String(full_name || '').trim()
  const mail = norm(email)
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Please enter your full name.' })
  if (!validEmail(mail)) return res.status(400).json({ error: 'Enter a valid email address.' })
  const pwErr = passwordProblem(password)
  if (pwErr) return res.status(400).json({ error: pwErr })
  if (one('SELECT id FROM users WHERE email = ?', mail)) {
    return res.status(409).json({ error: 'An account with this email already exists. Try signing in instead.' })
  }
  const userId = id()
  run(
    `INSERT INTO users (id, email, password_hash, full_name, company, role) VALUES (?,?,?,?,?, 'customer')`,
    userId, mail, hashPassword(password), name, String(company || '').slice(0, 120) || null,
  )
  const token = issueToken(userId, 'verify', 24)
  const link = `${appOrigin(req)}/verify-email?token=${token}`
  const user = one('SELECT * FROM users WHERE id = ?', userId)
  sendMail({ to: mail, ...templates.verify(name.split(' ')[0], link), userId, sentBy: userId })
  notify(user, {
    type: 'account', title: 'Welcome to SiteOps',
    body: 'Verify your email address, then add your first website to request an audit.', link: '/app/websites',
  })
  audit({ id: userId, email: mail }, 'user.register', 'users', userId)
  // Dev convenience only: without a mail provider the verification link is returned
  // so the flow is testable. Never returned in production.
  const devLink = !mailConfigured() && process.env.NODE_ENV !== 'production' ? link : undefined
  res.status(201).json({
    ok: true,
    message: 'Account created. Check your email to verify your address.',
    email: mail,
    email_delivery: mailConfigured() ? 'sent' : 'not_configured',
    dev_verification_url: devLink,
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
  createSession(res, user, req)
  audit(user, 'user.login', 'users', user.id)
  res.json({ user: publicUser(user) })
})

router.post('/admin/login', emailLimit, (req, res) => {
  const mail = norm(req.body?.email)
  const password = String(req.body?.password || '')
  const user = one('SELECT * FROM users WHERE email = ?', mail)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  if (!['support', 'admin', 'super_admin'].includes(user.role)) {
    audit(user, 'admin.login_denied', 'users', user.id)
    return res.status(403).json({ error: 'This account does not have administrator access.' })
  }
  if (user.status !== 'active') return res.status(403).json({ error: 'This account is suspended.' })
  if (!user.email_verified_at) return res.status(403).json({ error: 'Verify your email before signing in.', code: 'email_unverified' })
  createSession(res, user, req)
  audit(user, 'admin.login', 'users', user.id)
  res.json({ user: publicUser(user) })
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
  notify(user, { type: 'account', title: 'Email verified', body: 'Your SiteOps account is fully active.', link: '/app' })
  sendMail({ to: user.email, ...templates.welcome(user.full_name.split(' ')[0], baseUrl(req)), userId: user.id })
  audit(user, 'user.email_verified', 'users', user.id)
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
    if (!mailConfigured() && process.env.NODE_ENV !== 'production') {
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
    audit({ id: user.id, email: mail }, 'user.password_reset_requested', 'users', user.id)
    if (!mailConfigured() && process.env.NODE_ENV !== 'production') devLink = link
  }
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
  audit(user, 'user.password_reset', 'users', user.id)
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
  audit(req.user, 'user.password_changed', 'users', req.user.id)
  res.json({ ok: true, message: 'Password changed. Please sign in again.', signed_out: true })
})

router.patch('/profile', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' })
  const name = String(req.body?.full_name || '').trim()
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Please enter your full name.' })
  run(
    `UPDATE users SET full_name = ?, company = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`,
    name, String(req.body?.company || '').slice(0, 120) || null,
    String(req.body?.phone || '').slice(0, 30) || null, req.user.id,
  )
  audit(req.user, 'user.profile_updated', 'users', req.user.id)
  res.json({ user: publicUser(one('SELECT * FROM users WHERE id = ?', req.user.id)) })
})

router.patch('/preferences', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' })
  const current = one('SELECT notification_prefs FROM users WHERE id = ?', req.user.id)
  const prefs = { ...JSON.parse(current.notification_prefs) }
  for (const k of ['email_reports', 'email_audits', 'push']) {
    if (typeof req.body?.[k] === 'boolean') prefs[k] = req.body[k]
  }
  run(`UPDATE users SET notification_prefs = ?, updated_at = datetime('now') WHERE id = ?`, JSON.stringify(prefs), req.user.id)
  res.json({ notification_prefs: prefs })
})
