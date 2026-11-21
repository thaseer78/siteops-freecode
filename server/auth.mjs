import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { one, run, id, audit } from './db.mjs'

const SESSION_DAYS = 7
const BCRYPT_ROUNDS = 12 // spec: cost >= 12
export const isProd = process.env.NODE_ENV === 'production'
export const COOKIE = 'siteops_session'

/* ── passwords ─────────────────────────────────────────────────────────── */
/** New passwords are bcrypt (cost 12). Accounts created before the upgrade still
 *  hold scrypt hashes; verifyPassword accepts both and upgradePassword rehashes on
 *  the next successful sign-in, so nobody is locked out. */
export function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS)
}

export function verifyPassword(password, stored) {
  const value = String(stored || '')
  if (!value) return false
  if (value.startsWith('$2')) {
    try { return bcrypt.compareSync(password, value) } catch { return false }
  }
  try {
    const [algo, salt, hash] = value.split('$')
    if (algo !== 'scrypt') return false
    const candidate = crypto.scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

/** Rehash a legacy scrypt value with bcrypt after a verified sign-in. */
export function upgradePassword(userId, password, stored) {
  if (String(stored).startsWith('$2')) return false
  run(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, hashPassword(password), userId)
  return true
}

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Password must be at least 10 characters.'
  if (pw.length > 200) return 'Password must be 200 characters or fewer.'
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must include letters and numbers.'
  return null
}

/* ── sessions ──────────────────────────────────────────────────────────── */
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex')
export const safeJson = (v, fallback) => { try { return JSON.parse(v) ?? fallback } catch { return fallback } }

/** Session token is returned so native clients can send it as a bearer token. */
export function createSession(res, user, req) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5)
  run(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?)',
    id(), user.id, sha(token), expires.toISOString().slice(0, 19),
    req.ip || null, (req.get('user-agent') || '').slice(0, 250),
  )
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', expires,
  })
  run(`DELETE FROM sessions WHERE expires_at < datetime('now')`)
  return token
}
export function destroySession(req, res) {
  const token = req.cookies?.[COOKIE]
  if (token) {
    run(`UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL`, sha(token))
    run('DELETE FROM sessions WHERE token_hash = ?', sha(token))
  }
  res.clearCookie(COOKIE, { path: '/' })
}
export function revokeAllSessions(userId) {
  run('DELETE FROM sessions WHERE user_id = ?', userId)
}
export function userFromRequest(req) {
  const token = req.cookies?.[COOKIE] || bearerToken(req)
  if (!token) return null
  const row = one(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND s.revoked_at IS NULL`, sha(token),
  )
  if (!row || row.status !== 'active') return null
  const { password_hash, ...user } = row
  user.notification_prefs = safeJson(user.notification_prefs, {})
  return user
}
/** Mobile/API clients send `Authorization: Bearer <session token>`. */
export function bearerToken(req) {
  const header = req.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

/* ── one-time tokens (auth_tokens) ─────────────────────────────────────── */
const TOKEN_TYPE = { verify: 'email_verification', reset: 'password_reset' }

export function issueToken(userId, kind, hours) {
  const type = TOKEN_TYPE[kind]
  if (!type) throw new Error(`Unknown token kind: ${kind}`)
  const token = crypto.randomBytes(32).toString('base64url')
  run(`DELETE FROM auth_tokens WHERE user_id = ? AND type = ? AND used_at IS NULL`, userId, type)
  run(
    'INSERT INTO auth_tokens (id, user_id, token_hash, type, expires_at) VALUES (?,?,?,?,?)',
    id(), userId, sha(token), type, new Date(Date.now() + hours * 36e5).toISOString().slice(0, 19),
  )
  return token
}
export function consumeToken(token, kind) {
  if (!token || typeof token !== 'string') return null
  const type = TOKEN_TYPE[kind]
  const row = one(
    `SELECT * FROM auth_tokens WHERE token_hash = ? AND type = ? AND used_at IS NULL
       AND expires_at > datetime('now')`, sha(token), type,
  )
  if (!row) return null
  // Single use, enforced atomically.
  const used = run(`UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL`, row.id)
  if (!used.changes) return null
  return one('SELECT * FROM users WHERE id = ?', row.user_id)
}

/* ── middleware ────────────────────────────────────────────────────────── */
export function requireAuth(req, res, next) {
  const user = userFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Authentication required.' })
  if (!user.email_verified_at) return res.status(403).json({ error: 'Email not verified.', code: 'email_unverified' })
  req.user = user
  next()
}

const RANK = { customer: 0, support: 1, admin: 2, super_admin: 3 }
export function requireRole(minimum) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' })
    if (RANK[req.user.role] === undefined || RANK[req.user.role] < RANK[minimum]) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' })
    }
    next()
  }
}
export const isAdmin = (u) => !!u && (u.role === 'admin' || u.role === 'super_admin')
export const isStaff = (u) => !!u && (RANK[u.role] ?? -1) >= 1

/* ── rate limiting (per process) ───────────────────────────────────────── */
const buckets = new Map()
export function rateLimit(key, limit, windowMs) {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || entry.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }
  entry.count += 1
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k)
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count) }
}
export function limiter(limit, windowMs, keyFn) {
  return (req, res, next) => {
    const key = `${keyFn(req)}:${req.path}`
    const { ok } = rateLimit(key, limit, windowMs)
    if (!ok) return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' })
    next()
  }
}

/* ── admin bootstrap ───────────────────────────────────────────────────── */
export function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@siteops.in').toLowerCase().trim()
  const existing = one('SELECT id FROM users WHERE email = ?', email)
  if (existing) return
  let password = process.env.ADMIN_PASSWORD
  let generated = false
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url') + '!A7'
    generated = true
  }
  const adminId = id()
  const name = (process.env.ADMIN_NAME || 'SiteOps Operator').slice(0, 80)
  run(
    `INSERT INTO users (id, email, password_hash, full_name, role, email_verified_at, company_name)
     VALUES (?,?,?,?,?,datetime('now'),?)`,
    adminId, email, hashPassword(password), name, 'super_admin', 'SiteOps',
  )
  audit({ id: adminId, email, role: 'super_admin' }, 'admin.bootstrap', 'users', adminId, { generated })
  if (generated) {
    const file = path.resolve(process.env.DATA_DIR || 'data', 'admin-credentials.txt')
    fs.writeFileSync(file, `SiteOps initial operator\nemail: ${email}\npassword: ${password}\nCreated: ${new Date().toISOString()}\nDelete this file after signing in and changing the password.\n`, { mode: 0o600 })
    console.log(`[siteops] operator account created → ${file}`)
  } else {
    console.log(`[siteops] operator account created for ${email}`)
  }
}
