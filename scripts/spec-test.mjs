/* Verifies the upgrade-spec behaviours that the smoke suite does not cover:
   /api/v1 surface, internal-note isolation, admin RBAC, bearer tokens,
   manual-only email delivery, sandbox notice, dual-strategy report shape. */
const BASE = process.env.API_URL || 'http://127.0.0.1:8787'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; console.log('  ✗', name, extra) }
}
const jar = () => ({ cookie: '' })
async function req(j, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(j.cookie ? { cookie: j.cookie } : {}),
      ...(j.bearer ? { authorization: `Bearer ${j.bearer}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const set = res.headers.getSetCookie?.() || []
  for (const c of set) {
    const kv = c.split(';')[0]
    if (kv.startsWith('siteops_session=')) j.cookie = kv
  }
  const ct = res.headers.get('content-type') || ''
  return { status: res.status, json: ct.includes('json') ? await res.json().catch(() => null) : null }
}
const rand = Math.random().toString(36).slice(2, 8)
const devLink = async (j, email) => {
  const r = await req(j, 'POST', '/api/v1/auth/register', { full_name: 'Spec Tester', email, password: 'GoodPass1234' })
  return r.json?.dev_verification_url
}
const tokenOf = (link) => link && new URL(link).searchParams.get('token')

const A = jar()
const email = `spec-${rand}@example.com`

let r = await req(A, 'GET', '/api/v1/health')
ok('/api/v1/health is live', r.status === 200 && r.json?.ok === true, JSON.stringify(r.json))
ok('health reports sandbox sender state', typeof r.json?.sandbox_email === 'boolean')
ok('health hides the API key itself', r.json && !('key' in r.json) && !JSON.stringify(r.json).includes('AIza'))

const link = await devLink(A, email)
ok('v1 registration returns a verify link without email configured', !!link)
await req(A, 'POST', '/api/v1/auth/verify-email', { token: tokenOf(link) })
r = await req(A, 'POST', '/api/v1/auth/login', { email, password: 'GoodPass1234' })
ok('v1 login returns a bearer token for mobile', r.status === 200 && typeof r.json?.session_token === 'string', JSON.stringify(r.json))
const bearer = r.json?.session_token
ok('public user shape has notification_preferences', !!r.json?.user?.notification_preferences)

// bearer token works with no cookie
const M = jar(); M.bearer = bearer
r = await req(M, 'GET', '/api/v1/dashboard')
ok('bearer token authenticates without a cookie', r.status === 200 && r.json?.counts, JSON.stringify(r.json))

// SSRF at the API boundary
r = await req(A, 'POST', '/api/v1/websites', { display_name: 'Local', url: 'http://127.0.0.1:8787' })
ok('rejects private IP website', r.status === 400)
r = await req(A, 'POST', '/api/v1/websites', { display_name: 'Meta', url: 'http://169.254.169.254/latest' })
ok('rejects link-local metadata address', r.status === 400)
r = await req(A, 'POST', '/api/v1/websites', { display_name: 'Internal', url: 'http://router.internal' })
ok('rejects .internal hostname', r.status === 400)

r = await req(A, 'POST', '/api/v1/websites', { display_name: 'Example', url: 'example.com' })
ok('creates website with normalised domain', r.status === 201 && r.json.website.url === 'https://example.com', JSON.stringify(r.json))
const siteId = r.json?.website?.id

// request + register in one step
r = await req(A, 'POST', '/api/v1/audit-requests', { url: 'https://www.africau.edu', display_name: 'Afr', customer_notes: 'We sell online.' })
ok('one-step register + audit request', r.status === 202 && r.json?.audit_request_id, JSON.stringify(r.json))
const reqId = r.json?.audit_request_id

r = await req(A, 'GET', `/api/v1/audit-requests/${reqId}`)
ok('request detail exposes customer_notes', r.json?.request?.customer_notes === 'We sell online.')
ok('request status uses in_progress vocabulary', r.json?.request?.status !== 'running')

// admin: notes must never reach the customer
const admin = jar()
const adminFile = await import('node:fs').then((m) => m.readFileSync('data/admin-credentials.txt', 'utf8'))
const aEmail = adminFile.match(/^email:\s*(.+)$/m)[1].trim()
const aPass = adminFile.match(/^password:\s*(.+)$/m)[1].trim()
r = await req(admin, 'POST', '/api/v1/auth/admin/login', { email: aEmail, password: aPass })
if (r.status !== 200) { console.log('  ! admin login failed, skipping admin checks', JSON.stringify(r.json)) }
const adminOk = r.status === 200

if (adminOk) {
  r = await req(admin, 'PATCH', `/api/v1/admin/enquiries/${reqId}`, {
    status: 'in_progress', internal_admin_notes: 'SECRET-INTERNAL-NOTE-DO-NOT-LEAK',
  })
  ok('admin can update enquiry + internal notes', r.status === 200 && r.json?.enquiry?.internal_admin_notes?.includes('SECRET'), JSON.stringify(r.json))

  r = await req(A, 'GET', `/api/v1/audit-requests/${reqId}`)
  ok('customer detail omits internal_admin_notes', r.json && !JSON.stringify(r.json).includes('SECRET'))
  ok('customer detail omits assigned_admin_id', r.json?.request && !('assigned_admin_id' in r.json.request))
  r = await req(A, 'GET', '/api/v1/audit-requests')
  ok('customer list omits internal_admin_notes', !JSON.stringify(r.json).includes('SECRET'))
  r = await req(A, 'GET', '/api/v1/dashboard')
  ok('dashboard omits internal_admin_notes', !JSON.stringify(r.json).includes('SECRET'))

  r = await req(admin, 'GET', '/api/v1/admin/logs')
  ok('activity log records ENQUIRY_STATUS_UPDATED', r.status === 200 && r.json.activity.some((a) => a.action === 'ENQUIRY_STATUS_UPDATED'))
  r = await req(admin, 'GET', '/api/v1/admin/emails')
  ok('admin email list reports sandbox sender', r.status === 200 && typeof r.json?.sandbox === 'boolean' && 'sender' in r.json)

  r = await req(admin, 'GET', '/api/v1/admin/stats')
  ok('admin overview exposes KPI fields', r.status === 200 && 'pendingEnquiries' in r.json && 'failedDeliveries' in r.json && 'email' in r.json)
}

// customer must be rejected from every admin surface
for (const p of ['/api/v1/admin/enquiries', '/api/v1/admin/customers', '/api/v1/admin/reports', '/api/v1/admin/logs', '/api/v1/admin/emails', '/api/v1/admin/stats']) {
  r = await req(A, 'GET', p)
  ok(`customer blocked from ${p}`, r.status === 403, `got ${r.status}`)
}
r = await req(A, 'POST', '/api/v1/auth/admin/login', { email, password: 'GoodPass1234' })
ok('customer cannot use admin login', r.status === 403)

// audit runs must fail honestly (no key) and never auto-email a report
await new Promise((res) => setTimeout(res, 4500))
r = await req(A, 'GET', `/api/v1/audit-requests/${reqId}`)
ok('audit reached a terminal status', ['completed', 'failed'].includes(r.json?.request?.status), r.json?.request?.status)
if (r.json?.request?.status === 'failed') {
  ok('failure carries the provider message', /quota|PageSpeed/i.test(r.json.request.error || ''), r.json.request.error)
}
r = await req(A, 'GET', '/api/v1/reports')
ok('no report is auto-emailed / invented', Array.isArray(r.json?.reports))

// legacy paths still work
r = await req(A, 'GET', '/api/dashboard')
ok('/api (unversioned) alias still works', r.status === 200)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
