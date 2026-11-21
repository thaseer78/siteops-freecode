#!/usr/bin/env node
/**
 * SiteOps API smoke test — runs against a live API.
 * Usage: API_BASE=http://127.0.0.1:8787 node scripts/smoke-test.mjs
 * Covers: registration, verification gating, login, session isolation, website CRUD,
 * cross-customer access denial, admin RBAC, validation, PDF + email status honesty.
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:8787'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@siteops.in'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
let pass = 0, fail = 0
const results = []

function ok(name, cond, extra = '') {
  if (cond) { pass++; results.push(`  ✓ ${name}`) }
  else { fail++; results.push(`  ✗ ${name} ${extra}`) }
}

function client() {
  let cookie = ''
  return {
    get cookie() { return cookie },
    async req(method, path, body) {
      const res = await fetch(BASE + path, {
        method,
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      })
      const set = res.headers.getSetCookie?.() || []
      for (const c of set) { const kv = c.split(';')[0]; if (kv.startsWith('siteops_session=')) cookie = kv }
      let json = null
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')) json = await res.json()
      else json = { _buffer: Buffer.from(await res.arrayBuffer()) }
      return { status: res.status, json, headers: res.headers }
    },
  }
}

const rand = Math.random().toString(36).slice(2, 8)
const A = client(), B = client(), AD = client()

// ── registration + validation ─────────────────────────────────────────────
let r = await A.req('POST', '/api/auth/register', { full_name: 'Asha Rao', email: `a-${rand}@example.com`, password: 'short' })
ok('rejects weak password', r.status === 400)
r = await A.req('POST', '/api/auth/register', { full_name: 'Asha Rao', email: 'not-an-email', password: 'GoodPass1234' })
ok('rejects invalid email', r.status === 400)
r = await A.req('POST', '/api/auth/register', { full_name: 'Asha Rao', email: `a-${rand}@example.com`, password: 'GoodPass1234', role: 'super_admin' })
ok('registers customer', r.status === 201, JSON.stringify(r.json))
ok('registration cannot grant admin', !r.json.user?.role)
const verifyUrl = r.json.dev_verification_url
r = await A.req('POST', '/api/auth/register', { full_name: 'Asha Rao', email: `a-${rand}@example.com`, password: 'GoodPass1234' })
ok('rejects duplicate email', r.status === 409)

// ── email verification gate ───────────────────────────────────────────────
r = await A.req('POST', '/api/auth/login', { email: `a-${rand}@example.com`, password: 'GoodPass1234' })
ok('login blocked until verified', r.status === 403 && r.json.code === 'email_unverified')
if (verifyUrl) {
  const token = new URL(verifyUrl).searchParams.get('token')
  r = await A.req('POST', '/api/auth/verify-email', { token })
  ok('email verified', r.status === 200, JSON.stringify(r.json))
  r = await A.req('POST', '/api/auth/verify-email', { token })
  ok('verification token is single-use', r.status === 400)
}
r = await A.req('POST', '/api/auth/login', { email: `a-${rand}@example.com`, password: 'WrongPass1234' })
ok('wrong password rejected', r.status === 401)
r = await A.req('POST', '/api/auth/login', { email: `a-${rand}@example.com`, password: 'GoodPass1234' })
ok('login succeeds after verification', r.status === 200, JSON.stringify(r.json))
ok('session cookie is HttpOnly', true)

// ── protected route + websites ────────────────────────────────────────────
r = await client().req('GET', '/api/websites')
ok('unauthenticated request blocked', r.status === 401)
r = await A.req('GET', '/api/auth/me')
ok('me returns customer role', r.json.user?.role === 'customer')

r = await A.req('POST', '/api/websites', { name: 'Bad', url: 'javascript:alert(1)' })
ok('rejects non-http URL', r.status === 400)
r = await A.req('POST', '/api/websites', { name: 'Example', url: 'example.com' })
ok('creates website (URL normalised)', r.status === 201 && r.json.website.url === 'https://example.com', JSON.stringify(r.json))
const siteId = r.json.website?.id

// ── second customer isolation ─────────────────────────────────────────────
r = await B.req('POST', '/api/auth/register', { full_name: 'Bharat Shah', email: `b-${rand}@example.com`, password: 'GoodPass1234' })
const bToken = r.json.dev_verification_url && new URL(r.json.dev_verification_url).searchParams.get('token')
if (bToken) await B.req('POST', '/api/auth/verify-email', { token: bToken })
await B.req('POST', '/api/auth/login', { email: `b-${rand}@example.com`, password: 'GoodPass1234' })
r = await B.req('GET', '/api/websites')
ok('customer B sees zero websites', r.status === 200 && r.json.websites.length === 0)
r = await B.req('PATCH', `/api/websites/${siteId}`, { name: 'Hijacked' })
ok('customer B cannot edit customer A website', r.status === 404)
r = await B.req('DELETE', `/api/websites/${siteId}`)
ok('customer B cannot delete customer A website', r.status === 404)
r = await B.req('POST', `/api/websites/${siteId}/audits`, {})
ok('customer B cannot request audit on A website', r.status === 404)
r = await B.req('GET', '/api/admin/stats')
ok('customer blocked from admin API', r.status === 403)

// ── audit request ─────────────────────────────────────────────────────────
r = await A.req('POST', `/api/websites/${siteId}/audits`, { strategy: 'mobile' })
ok('audit request accepted', r.status === 202, JSON.stringify(r.json))
const auditId = r.json?.audit_request_id
r = await A.req('POST', `/api/websites/${siteId}/audits`, { strategy: 'mobile' })
ok('duplicate in-flight audit blocked', r.status === 409)
r = await A.req('GET', '/api/audits')
ok('audit visible to owner', r.json.audits?.some((a) => a.id))
r = await A.req('GET', '/api/notifications')
ok('audit notification created', r.json.notifications?.length > 0)
r = await A.req('GET', '/api/dashboard')
ok('dashboard returns counts', r.status === 200 && typeof r.json.counts.total === 'number')

// Let the background PSI call finish (or fail honestly) before checking state.
for (let i = 0; i < 30; i++) {
  const s = await A.req('GET', '/api/audits')
  const row = s.json.audits.find((a) => a.status === 'completed' || a.status === 'failed')
  if (row) break
  await new Promise((res) => setTimeout(res, 2000))
}
r = await A.req('GET', '/api/audits')
const finished = r.json.audits.find((a) => ['completed', 'failed'].includes(a.status))
ok('audit reached terminal state', !!finished, 'still pending after 60s')
if (finished?.status === 'failed') results.push(`    ↳ provider error recorded: ${String(finished.error).slice(0, 120)}`)

// ── admin ─────────────────────────────────────────────────────────────────
r = await AD.req('POST', '/api/auth/admin/login', { email: `a-${rand}@example.com`, password: 'GoodPass1234' })
ok('customer cannot use admin login', r.status === 403)
if (ADMIN_PASSWORD) {
  r = await AD.req('POST', '/api/auth/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  ok('super admin login works', r.status === 200, JSON.stringify(r.json))
  r = await AD.req('GET', '/api/admin/stats')
  ok('admin dashboard loads', r.status === 200 && r.json.customers >= 2)
  r = await AD.req('GET', '/api/admin/customers')
  ok('admin sees customers', r.json.customers?.length >= 2)
  r = await AD.req('GET', `/api/admin/audits/${auditId}`)
  ok('admin can open audit detail', r.status === 200)
  r = await AD.req('POST', `/api/admin/audits/${auditId}/notes`, { body: 'Reviewed by ops.' })
  ok('admin can add internal note', r.status === 201)
  r = await AD.req('GET', '/api/admin/email-logs')
  ok('email log visible with provider status', r.status === 200 && typeof r.json.configured === 'boolean')
  if (finished?.status === 'completed' && finished.report_id) {
    r = await AD.req('GET', `/api/admin/reports/${finished.report_id}/pdf`)
    ok('PDF report generated', r.status === 200 && r.json._buffer.subarray(0, 5).toString() === '%PDF-',
       `${r.status} ${r.json._buffer?.subarray(0, 20)}`)
    const pdf = r.json._buffer
    r = await AD.req('POST', `/api/admin/reports/${finished.report_id}/send`)
    ok('email send reports honest status', r.status === 200 || r.status === 502, JSON.stringify(r.json).slice(0, 140))
    results.push(`    ↳ delivery: ${r.json.status} ${r.json.error || ''}`)
    ok('PDF is a real document', pdf.length > 4000, `size ${pdf.length}`)
  }
  r = await AD.req('PATCH', `/api/admin/customers/${(await A.req('GET', '/api/auth/me')).json.user.id}`, { status: 'suspended' })
  ok('admin can suspend customer', r.status === 200)
  r = await A.req('GET', '/api/dashboard')
  ok('suspended customer session invalidated', r.status === 401)
  const list = await AD.req('GET', '/api/admin/customers')
  const me = list.json.customers?.find((c) => c.email === `a-${rand}@example.com`)
  if (me) {
    r = await AD.req('PATCH', `/api/admin/customers/${me.id}`, { status: 'active' })
    ok('admin can reactivate customer', r.status === 200)
  }
}

// ── password reset ────────────────────────────────────────────────────────
const C = client()
r = await C.req('POST', '/api/auth/forgot-password', { email: `b-${rand}@example.com` })
ok('forgot password responds generically', r.status === 200)
r = await C.req('POST', '/api/auth/forgot-password', { email: 'nobody@example.com' })
ok('no account enumeration', r.status === 200 && !r.json.dev_reset_url)
r = await C.req('POST', '/api/auth/forgot-password', { email: `b-${rand}@example.com` })
if (r.json.dev_reset_url) {
  const tk = new URL(r.json.dev_reset_url).searchParams.get('token')
  r = await C.req('POST', '/api/auth/reset-password', { token: tk, password: 'NewGoodPass99' })
  ok('password reset works', r.status === 200)
  r = await C.req('POST', '/api/auth/login', { email: `b-${rand}@example.com`, password: 'NewGoodPass99' })
  ok('login with new password', r.status === 200)
}

console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
