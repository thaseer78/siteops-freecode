import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_PATH = path.join(DATA_DIR, 'siteops.db')

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

/* The schema below is the canonical shape for a new database. It is a superset of
   the pre-upgrade tables: every legacy column the application already used is kept,
   alongside the columns the operations spec requires. Existing databases are
   upgraded by migrate() further down, which never drops data. */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company TEXT,
  company_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','support','admin','super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  email_verified_at TEXT,
  notification_prefs TEXT NOT NULL DEFAULT '{"email_reports":true,"email_audits":true,"push":true}',
  notification_preferences TEXT NOT NULL DEFAULT '{"email_updates":true,"in_app_alerts":true}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('email_verification','password_reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS websites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT,
  name TEXT NOT NULL,
  display_name TEXT,
  url TEXT NOT NULL,
  normalized_domain TEXT,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_requests (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed','cancelled')),
  audit_scope TEXT NOT NULL DEFAULT 'full_site_health',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  strategy TEXT NOT NULL DEFAULT 'both',
  customer_note TEXT,
  customer_notes TEXT,
  internal_admin_notes TEXT,
  assigned_admin_id TEXT,
  error TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_reports (
  id TEXT PRIMARY KEY,
  audit_request_id TEXT NOT NULL UNIQUE REFERENCES audit_requests(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','failed')),
  url TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'both',
  mobile_scores TEXT,
  desktop_scores TEXT,
  core_metrics TEXT,
  findings TEXT NOT NULL DEFAULT '[]',
  recommendations TEXT NOT NULL DEFAULT '[]',
  executive_summary TEXT,
  failure_reason TEXT,
  pdf_file_path TEXT,
  audited_at TEXT,
  -- legacy scalar columns: kept so older rows and exports stay readable
  performance INTEGER,
  seo INTEGER,
  accessibility INTEGER,
  best_practices INTEGER,
  overall INTEGER,
  metrics TEXT,
  lighthouse_version TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_history (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  report_id TEXT NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
  customer_id TEXT,
  mobile_overall_avg INTEGER,
  desktop_overall_avg INTEGER,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  link TEXT,
  action_url TEXT,
  read_at TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id TEXT PRIMARY KEY,
  report_id TEXT REFERENCES audit_reports(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'report',
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed')),
  provider_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  triggered_by_admin_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_email TEXT,
  actor_user_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  entity_type TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  metadata TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

/* ── additive migration for databases created before the upgrade ────────── */
const columnsOf = (table) => {
  try { return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)) }
  catch { return new Set() }
}
const addColumn = (table, name, ddl) => {
  const cols = columnsOf(table)
  if (cols.size === 0 || cols.has(name)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`)
  return true
}
const tableExists = (t) => !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(t)

/** audit_requests and audit_reports need new CHECK constraints, which SQLite can
 *  only change by rebuilding the table. Rows are copied, never discarded. */
function rebuildAuditRequests() {
  const sql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='audit_requests'`).get()?.sql || ''
  if (sql.includes("'in_progress'")) return
  db.exec('PRAGMA foreign_keys = OFF')
  db.exec('BEGIN')
  try {
    db.exec(`
      CREATE TABLE audit_requests_new (
        id TEXT PRIMARY KEY,
        website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed','cancelled')),
        audit_scope TEXT NOT NULL DEFAULT 'full_site_health',
        priority TEXT NOT NULL DEFAULT 'normal',
        strategy TEXT NOT NULL DEFAULT 'both',
        customer_note TEXT, customer_notes TEXT, internal_admin_notes TEXT, assigned_admin_id TEXT,
        error TEXT, requested_at TEXT, started_at TEXT, completed_at TEXT, updated_at TEXT
      )`)
    const target = columnsOf('audit_requests_new')
    const source = columnsOf('audit_requests')
    const shared = [...target].filter((c) => source.has(c))
    db.exec(`INSERT INTO audit_requests_new (${shared.join(',')}) SELECT ${shared.join(',')} FROM audit_requests`)
    db.exec(`UPDATE audit_requests_new SET status = 'in_progress' WHERE status = 'running'`)
    db.exec(`UPDATE audit_requests_new SET customer_id = user_id WHERE customer_id IS NULL`)
    db.exec(`UPDATE audit_requests_new SET customer_notes = customer_note WHERE customer_notes IS NULL`)
    db.exec('DROP TABLE audit_requests')
    db.exec('ALTER TABLE audit_requests_new RENAME TO audit_requests')
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_requests_status ON audit_requests(status, requested_at);
             CREATE INDEX IF NOT EXISTS idx_audit_requests_user ON audit_requests(user_id);
             CREATE INDEX IF NOT EXISTS idx_audit_requests_customer ON audit_requests(customer_id);
             CREATE INDEX IF NOT EXISTS idx_audit_requests_website ON audit_requests(website_id);`)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }
}

function rebuildAuditReports() {
  const sql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='audit_reports'`).get()?.sql || ''
  if (sql.includes('mobile_scores')) return
  db.exec('PRAGMA foreign_keys = OFF')
  db.exec('BEGIN')
  try {
    db.exec(`
      CREATE TABLE audit_reports_new (
        id TEXT PRIMARY KEY,
        audit_request_id TEXT NOT NULL UNIQUE REFERENCES audit_requests(id) ON DELETE CASCADE,
        website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_id TEXT,
        status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','failed')),
        url TEXT NOT NULL,
        strategy TEXT NOT NULL DEFAULT 'both',
        mobile_scores TEXT, desktop_scores TEXT, core_metrics TEXT,
        findings TEXT NOT NULL DEFAULT '[]', recommendations TEXT NOT NULL DEFAULT '[]',
        executive_summary TEXT, failure_reason TEXT, pdf_file_path TEXT, audited_at TEXT,
        performance INTEGER, seo INTEGER, accessibility INTEGER, best_practices INTEGER,
        overall INTEGER, metrics TEXT, lighthouse_version TEXT, fetched_at TEXT
      )`)
    const target = columnsOf('audit_reports_new')
    const source = columnsOf('audit_reports')
    const shared = [...target].filter((c) => source.has(c))
    db.exec(`INSERT INTO audit_reports_new (${shared.join(',')}) SELECT ${shared.join(',')} FROM audit_reports`)
    db.exec(`UPDATE audit_reports_new SET customer_id = user_id WHERE customer_id IS NULL`)
    db.exec(`UPDATE audit_reports_new SET audited_at = fetched_at WHERE audited_at IS NULL`)
    db.exec('DROP TABLE audit_reports')
    db.exec('ALTER TABLE audit_reports_new RENAME TO audit_reports')
    db.exec(`CREATE INDEX IF NOT EXISTS idx_reports_user ON audit_reports(user_id, fetched_at);
             CREATE INDEX IF NOT EXISTS idx_reports_website ON audit_reports(website_id);
             CREATE INDEX IF NOT EXISTS idx_reports_customer ON audit_reports(customer_id);`)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }
}

function migrate() {
  // columns added after the first release
  addColumn('users', 'company_name', 'TEXT')
  addColumn('users', 'notification_preferences', `TEXT NOT NULL DEFAULT '{"email_updates":true,"in_app_alerts":true}'`)
  addColumn('sessions', 'revoked_at', 'TEXT')
  addColumn('websites', 'customer_id', 'TEXT')
  addColumn('websites', 'display_name', 'TEXT')
  addColumn('websites', 'normalized_domain', 'TEXT')
  addColumn('websites', 'status', `TEXT NOT NULL DEFAULT 'active'`)

  rebuildAuditRequests()
  rebuildAuditReports()

  // Tables created before the upgrade never had these; the API writes them.
  addColumn('audit_requests', 'updated_at', 'TEXT')
  addColumn('audit_reports', 'updated_at', 'TEXT')
  db.exec(`UPDATE audit_requests SET updated_at = COALESCE(completed_at, started_at, requested_at, datetime('now')) WHERE updated_at IS NULL`)
  db.exec(`UPDATE audit_reports SET updated_at = COALESCE(fetched_at, datetime('now')) WHERE updated_at IS NULL`)

  addColumn('activity_logs', 'actor_user_id', 'TEXT')
  addColumn('activity_logs', 'actor_role', 'TEXT')
  addColumn('activity_logs', 'entity_type', 'TEXT')
  addColumn('activity_logs', 'metadata', `TEXT NOT NULL DEFAULT '{}'`)
  addColumn('activity_logs', 'ip_address', 'TEXT')
  addColumn('notifications', 'message', `TEXT NOT NULL DEFAULT ''`)
  addColumn('notifications', 'action_url', 'TEXT')
  addColumn('notifications', 'is_read', 'INTEGER NOT NULL DEFAULT 0')

  // backfill the spec-shaped columns from their legacy equivalents
  db.exec(`UPDATE users SET company_name = company WHERE company_name IS NULL AND company IS NOT NULL`)
  db.exec(`UPDATE users SET notification_preferences = CASE
             WHEN notification_prefs LIKE '%"email_reports":false%' OR notification_prefs LIKE '%"email_audits":false%'
             THEN '{"email_updates":false,"in_app_alerts":true}' ELSE '{"email_updates":true,"in_app_alerts":true}' END
           WHERE notification_preferences IS NULL`)
  db.exec(`UPDATE websites SET customer_id = user_id WHERE customer_id IS NULL`)
  db.exec(`UPDATE websites SET display_name = name WHERE display_name IS NULL`)
  db.exec(`UPDATE websites SET status = CASE WHEN archived = 1 THEN 'archived' ELSE 'active' END WHERE status IS NULL`)
  for (const w of db.prepare('SELECT id, url FROM websites WHERE normalized_domain IS NULL').all()) {
    try {
      const host = new URL(/^https?:\/\//i.test(w.url) ? w.url : `https://${w.url}`).hostname
      db.prepare('UPDATE websites SET normalized_domain = ? WHERE id = ?').run(host.replace(/^www\./, '').toLowerCase(), w.id)
    } catch { /* leave null for unparseable legacy rows */ }
  }
  db.exec(`UPDATE audit_requests SET customer_id = user_id WHERE customer_id IS NULL`)
  db.exec(`UPDATE audit_requests SET customer_notes = customer_note WHERE customer_notes IS NULL AND customer_note IS NOT NULL`)
  db.exec(`UPDATE report_history SET customer_id = (SELECT user_id FROM websites w WHERE w.id = report_history.website_id) WHERE customer_id IS NULL`)
  db.exec(`UPDATE notifications SET message = body WHERE message = '' OR message IS NULL`)
  db.exec(`UPDATE notifications SET action_url = link WHERE action_url IS NULL`)
  db.exec(`UPDATE notifications SET is_read = 1 WHERE read_at IS NOT NULL`)
  db.exec(`UPDATE activity_logs SET actor_user_id = actor_id WHERE actor_user_id IS NULL`)
  db.exec(`UPDATE activity_logs SET entity_type = entity WHERE entity_type IS NULL`)
  db.exec(`UPDATE activity_logs SET metadata = meta WHERE metadata = '{}' AND meta != '{}'`)
}
migrate()

/* Indexes are created after migration so they can reference new columns. */
db.exec(`
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_websites_user ON websites(user_id);
CREATE INDEX IF NOT EXISTS idx_websites_customer ON websites(customer_id);
CREATE INDEX IF NOT EXISTS idx_websites_domain ON websites(normalized_domain);
CREATE INDEX IF NOT EXISTS idx_audit_requests_status ON audit_requests(status, requested_at);
CREATE INDEX IF NOT EXISTS idx_audit_requests_user ON audit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_requests_customer ON audit_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_requests_website ON audit_requests(website_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON audit_reports(user_id, fetched_at);
CREATE INDEX IF NOT EXISTS idx_reports_website ON audit_reports(website_id);
CREATE INDEX IF NOT EXISTS idx_reports_customer ON audit_reports(customer_id);
CREATE INDEX IF NOT EXISTS idx_report_history_website ON report_history(website_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_email_delivery_status ON email_delivery_logs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_delivery_report ON email_delivery_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_customer ON email_delivery_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
`)

/* legacy one-time tokens are superseded by auth_tokens; carry over unexpired ones */
try {
  const pending = db.prepare(`SELECT * FROM email_tokens WHERE used_at IS NULL AND expires_at > datetime('now')`).all()
  for (const t of pending) {
    const exists = db.prepare('SELECT 1 FROM auth_tokens WHERE token_hash = ?').get(t.token_hash)
    if (exists) continue
    db.prepare(`INSERT INTO auth_tokens (id, user_id, token_hash, type, expires_at, used_at, created_at)
                VALUES (?,?,?,?,?,?,?)`).run(
      t.id, t.user_id, t.token_hash,
      t.kind === 'verify' ? 'email_verification' : 'password_reset',
      t.expires_at, t.used_at, t.created_at,
    )
  }
} catch (err) {
  console.warn('[db] token carry-over skipped:', err.message)
}

/* existing delivery logs become rows in the new delivery table */
try {
  const legacy = db.prepare('SELECT * FROM email_logs').all()
  for (const e of legacy) {
    const exists = db.prepare('SELECT 1 FROM email_delivery_logs WHERE id = ?').get(e.id)
    if (exists) continue
    db.prepare(`INSERT INTO email_delivery_logs
      (id, report_id, customer_id, recipient_email, sender_email, subject, kind, status,
       provider_message_id, error_message, retry_count, triggered_by_admin_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      e.id, e.report_id, e.user_id, e.to_email,
      process.env.MAIL_FROM || 'SiteOps <onboarding@resend.dev>', e.subject, e.kind,
      e.status === 'sent' ? 'sent' : 'failed',
      e.provider_id, e.error, 0, e.sent_by, e.created_at, e.created_at,
    )
  }
} catch (err) {
  console.warn('[db] delivery log copy skipped:', err.message)
}

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
/** Record an administrative/system action. Writes both the legacy and the
 *  spec-shaped columns so either query shape works. */
export function audit(actor, action, entity, entityId, meta = {}, ipAddress = null) {
  run(
    `INSERT INTO activity_logs
       (id, actor_id, actor_email, actor_user_id, actor_role, action, entity, entity_id,
        entity_type, meta, metadata, ip_address)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id(),
    actor?.id || null,
    actor?.email || 'system',
    actor?.id || null,
    actor?.role || 'system',
    action,
    entity || null,
    entityId || null,
    entity || null,
    JSON.stringify(meta),
    JSON.stringify(meta),
    ipAddress,
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
export { DB_PATH, tableExists }
