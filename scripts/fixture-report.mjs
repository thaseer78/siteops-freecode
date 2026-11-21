/* Builds a throwaway database with one realistic dual-strategy report, purely to
   exercise the report pages and the PDF generator. It writes to DATA_DIR, which
   must be a temporary directory — never the live data folder.

   The payload below is a Lighthouse-shaped fixture, so the PDF/report rendering can
   be verified while Google's shared PageSpeed quota is exhausted. Nothing here is
   written to the real database. */
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = process.env.DATA_DIR
if (!DATA_DIR || !DATA_DIR.startsWith('/tmp/')) {
  console.error('Refusing to run: set DATA_DIR to a /tmp/ path.')
  process.exit(1)
}
fs.rmSync(DATA_DIR, { recursive: true, force: true })
fs.mkdirSync(DATA_DIR, { recursive: true })

const { one, run, id } = await import('../server/db.mjs')
const { normaliseStrategy, persistReport } = await import('../server/audit.mjs')
const { hashPassword } = await import('../server/auth.mjs')

const audit = (id) => ({
  'first-contentful-paint': { title: 'First Contentful Paint', displayValue: id ? '1.4 s' : '0.9 s', score: id ? 0.86 : 0.98, numericValue: id ? 1400 : 900 },
  'largest-contentful-paint': { title: 'Largest Contentful Paint', displayValue: id ? '4.8 s' : '2.1 s', score: id ? 0.32 : 0.82, numericValue: id ? 4800 : 2100 },
  'total-blocking-time': { title: 'Total Blocking Time', displayValue: id ? '820 ms' : '180 ms', score: id ? 0.28 : 0.88, numericValue: id ? 820 : 180 },
  'cumulative-layout-shift': { title: 'Cumulative Layout Shift', displayValue: id ? '0.24' : '0.04', score: id ? 0.45 : 0.97, numericValue: id ? 0.24 : 0.04 },
  'speed-index': { title: 'Speed Index', displayValue: id ? '5.1 s' : '2.4 s', score: id ? 0.51 : 0.87, numericValue: id ? 5100 : 2400 },
  'unused-javascript': {
    title: 'Reduce unused JavaScript', score: id ? 0.4 : 0.75,
    description: 'Reduce unused JavaScript and defer loading scripts until they are required. [Learn more](https://web.dev/unused-javascript/).',
    displayValue: 'Estimated 412 KiB', details: { type: 'opportunity', overallSavingsMs: 2100, overallSavingsBytes: 421888 },
  },
  'render-blocking-resources': {
    title: 'Eliminate render-blocking resources', score: id ? 0.6 : 0.85,
    description: 'Resources are blocking the first paint of your page.', displayValue: 'Potential savings of 640 ms',
    details: { type: 'opportunity', overallSavingsMs: 640 },
  },
  'image-alt': {
    title: 'Image elements do not have [alt] attributes', score: 0.0,
    description: 'Informative elements should aim for short, descriptive alternate text.',
    details: { type: 'table' },
  },
  'meta-description': {
    title: 'Document does not have a meta description', score: 0.0,
    description: 'Meta descriptions may be included in search results.',
    details: { type: 'table' },
  },
})

const lh = (strategy) => ({
  id: 'https://kavericrafts.example/',
  lighthouseResult: {
    lighthouseVersion: '12.2.1',
    fetchTime: new Date().toISOString(),
    finalUrl: 'https://kavericrafts.example/',
    categories: {
      performance: { score: strategy === 'mobile' ? 0.42 : 0.71, auditRefs: [{ id: 'largest-contentful-paint', weight: 25 }, { id: 'total-blocking-time', weight: 30 }, { id: 'unused-javascript', weight: 0 }] },
      accessibility: { score: strategy === 'mobile' ? 0.68 : 0.82, auditRefs: [{ id: 'image-alt', weight: 10 }] },
      'best-practices': { score: strategy === 'mobile' ? 0.79 : 0.92, auditRefs: [{ id: 'render-blocking-resources', weight: 0 }] },
      seo: { score: strategy === 'mobile' ? 0.83 : 0.83, auditRefs: [{ id: 'meta-description', weight: 5 }] },
    },
    audits: audit(strategy === 'mobile'),
  },
})

const dual = {
  mobile: normaliseStrategy(lh('mobile'), { url: 'https://kavericrafts.example/', strategy: 'mobile' }),
  desktop: normaliseStrategy(lh('desktop'), { url: 'https://kavericrafts.example/', strategy: 'desktop' }),
}
dual.findings = [...dual.mobile.findings, ...dual.desktop.findings]
dual.recommendations = dual.mobile.findings.slice(0, 5).map((f) => ({
  priority: f.severity, category: f.category, strategy: f.strategy, title: f.title,
  action_steps: [f.description], estimated_impact: f.savings_ms ? `${f.savings_ms / 1000}s potential saving` : f.display_value,
  detail: f.description, impact: f.display_value,
}))
dual.core_metrics = {}
for (const k of ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index']) {
  dual.core_metrics[k] = { label: dual.mobile.metrics[k]?.label || k, mobile: dual.mobile.metrics[k], desktop: dual.desktop.metrics[k] }
}
dual.finalUrl = 'https://kavericrafts.example/'
dual.partial_error = null

const userId = id()
run(`INSERT INTO users (id, email, password_hash, full_name, company, company_name, role, email_verified_at, notification_preferences)
     VALUES (?,?,?,?,?,?, 'customer', datetime('now'), '{"email_updates":true,"in_app_alerts":true}')`,
  userId, 'fixture@siteops.test', hashPassword('FixturePass1234'), 'Asha Rao', 'Kaveri Crafts', 'Kaveri Crafts')

const siteId = id()
run(`INSERT INTO websites (id, user_id, customer_id, name, display_name, url, normalized_domain, status)
     VALUES (?,?,?,?,?,?,?, 'active')`,
  siteId, userId, userId, 'Kaveri Crafts store', 'Kaveri Crafts store', 'https://kavericrafts.example', 'kavericrafts.example')

const requestId = id()
run(`INSERT INTO audit_requests (id, website_id, user_id, customer_id, status, strategy, audit_scope, customer_notes)
     VALUES (?,?,?,?, 'pending', 'both', 'full_site_health', ?)`,
  requestId, siteId, userId, userId, 'We sell handmade textiles; mobile traffic is most of our sales.')

const request = one('SELECT a.*, w.url FROM audit_requests a JOIN websites w ON w.id = a.website_id WHERE a.id = ?', requestId)
const report = persistReport(request, { id: userId, email: 'fixture@siteops.test' }, dual)

// an email attempt that failed, so the delivery log + retry button are visible
run(`INSERT INTO email_delivery_logs (id, report_id, customer_id, recipient_email, sender_email, subject, kind, status,
      error_message, retry_count, triggered_by_admin_id)
     VALUES (?,?,?,?,?,?,?, 'failed', ?, 0, ?)`,
  id(), report.id, userId, 'fixture@siteops.test', 'SiteOps <onboarding@resend.dev>',
  'Your SiteOps report — Kaveri Crafts store', 'report',
  'Resend sandbox restriction: only the account owner address can receive mail until a domain is verified.', userId)

run(`INSERT INTO notifications (id, user_id, type, title, body, message, link, action_url)
     VALUES (?,?,?,?,?,?,?,?)`, id(), userId, 'report', 'Audit complete',
  'Your mobile and desktop audit for kavericrafts.example is ready.', 'Your mobile and desktop audit for kavericrafts.example is ready.',
  `/dashboard/reports/${report.id}`, `/dashboard/reports/${report.id}`)

const { generatePdfFile } = await import('../server/pdf.mjs')
const pdf = await generatePdfFile(report.id)
fs.writeFileSync('/tmp/fixture-report.pdf', pdf.buf)
console.log(JSON.stringify({
  reportId: report.id, customer: 'fixture@siteops.test', password: 'FixturePass1234',
  pdfBytes: pdf.buf.length, pdfFile: pdf.file,
}))
