import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_PATH = path.join(DATA_DIR, 'siteops.db')

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','support','admin','super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  email_verified_at TEXT,
  notification_prefs TEXT NOT NULL DEFAULT '{"email_reports":true,"email_audits":true,"push":true}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS email_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('verify','reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);
CREATE TABLE IF NOT EXISTS websites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_websites_user ON websites(user_id);
CREATE TABLE IF NOT EXISTS audit_requests (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  strategy TEXT NOT NULL DEFAULT 'mobile' CHECK (strategy IN ('mobile','desktop')),
  customer_note TEXT,
  error TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_requests_status ON audit_requests(status, requested_at);
CREATE INDEX IF NOT EXISTS idx_audit_requests_user ON audit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_requests_website ON audit_requests(website_id);
CREATE TABLE IF NOT EXISTS audit_reports (
  id TEXT PRIMARY KEY,
  audit_request_id TEXT NOT NULL UNIQUE REFERENCES audit_requests(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  strategy TEXT NOT NULL,
  performance INTEGER,
  seo INTEGER,
  accessibility INTEGER,
  best_practices INTEGER,
  overall INTEGER,
  findings TEXT NOT NULL DEFAULT '[]',
  metrics TEXT NOT NULL DEFAULT '{}',
  lighthouse_version TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_user ON audit_reports(user_id, fetched_at);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  report_id TEXT REFERENCES audit_reports(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed','not_configured')),
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_id TEXT,
  error TEXT,
  sent_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
CREATE TABLE IF NOT EXISTS admin_notes (
  id TEXT PRIMARY KEY,
  audit_request_id TEXT NOT NULL REFERENCES audit_requests(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`
db.exec(SCHEMA)

export const id = () => crypto.randomUUID()
export const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

export function one(sql, ...params) {
  return db.prepare(sql).get(...params)
}
export function all(sql, ...params) {
  return db.prepare(sql).all(...params)
}
export function run(sql, ...params) {
  return db.prepare(sql).run(...params)
}
export function tx(fn) {
  db.exec('BEGIN')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
export function audit(actor, action, entity, entityId, meta = {}) {
  run(
    'INSERT INTO activity_logs (id, actor_id, actor_email, action, entity, entity_id, meta) VALUES (?,?,?,?,?,?,?)',
    id(),
    actor?.id || null,
    actor?.email || 'system',
    action,
    entity || null,
    entityId || null,
    JSON.stringify(meta),
  )
}

export function getSettings() {
  const rows = all('SELECT key, value FROM settings')
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')

const KEY_STORE = path.join(DATA_DIR, 'keys.json')
function loadKey() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  try {
    return JSON.parse(fs.readFileSync(KEY_STORE, 'utf8')).sessionSecret
  } catch {
    const secret = crypto.randomBytes(32).toString('hex')
    fs.writeFileSync(KEY_STORE, JSON.stringify({ sessionSecret: secret }), { mode: 0o600 })
    return secret
  }
}
export const sessionSecret = loadKey()
export { DATA_DIR, DB_PATH }
