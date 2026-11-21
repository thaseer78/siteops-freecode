import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { one } from './db.mjs'

const INK = '#0B1220', MUTED = '#5A6B85', MINT = '#0E9673', LINE = '#E3E8F0', SOFT = '#F5F7FB'
const scoreColor = (n) =>
  n == null ? MUTED : n >= 90 ? '#0E9673' : n >= 70 ? '#2E55C8' : n >= 50 ? '#C2760A' : '#C03A2B'
const label = (k) => String(k || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const clean = (s = '') => String(s).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()
const safe = (v, fallback) => {
  try { const p = typeof v === 'string' ? JSON.parse(v) : v; return p || fallback } catch { return fallback }
}

const CATS = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best_practices', 'Best Practices'],
  ['seo', 'SEO'],
]

/** Resolve mobile/desktop score objects, falling back to legacy scalar columns. */
function scoresFor(report) {
  const legacy = {
    performance: report.performance, accessibility: report.accessibility,
    best_practices: report.best_practices, seo: report.seo,
  }
  const mobile = safe(report.mobile_scores, null) || legacy
  const desktop = safe(report.desktop_scores, null) || null
  const avg = (s) => {
    const vals = Object.values(s || {}).filter((v) => typeof v === 'number')
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }
  return { mobile, desktop, mobileAvg: avg(mobile), desktopAvg: avg(desktop) }
}

export function buildReportPdf(report, req, website, user) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 54, left: 54, right: 54, bottom: 64 }, bufferPages: true })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const W = doc.page.width - 108
  const findings = safe(report.findings, [])
  const recs = safe(report.recommendations, [])
  const core = safe(report.core_metrics, null)
  const legacyMetrics = safe(report.metrics, {})
  const { mobile, desktop, mobileAvg, desktopAvg } = scoresFor(report)
  const overall = report.overall ?? (mobileAvg != null && desktopAvg != null ? Math.round((mobileAvg + desktopAvg) / 2) : mobileAvg ?? desktopAvg)

  // Header band
  doc.rect(0, 0, doc.page.width, 132).fill(INK)
  doc.fillColor('#34D3A4').font('Helvetica-Bold').fontSize(9).text('SITEOPS', 54, 44, { characterSpacing: 2 })
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('Website Health Report', 54, 62)
  doc.fillColor('#9DB0CC').font('Helvetica').fontSize(9.5)
    .text(`${clean(website?.display_name || website?.name || report.url)}  ·  ${report.url}`, 54, 94, { width: W - 120 })
  doc.fillColor('#9DB0CC').fontSize(9).text('Mobile + Desktop', doc.page.width - 150, 94, { width: 96, align: 'right' })
  doc.y = 168

  // Overall panel with both strategies
  const top = doc.y
  doc.roundedRect(54, top, W, 104, 10).fill(SOFT)
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('OVERALL HEALTH', 74, top + 18, { characterSpacing: 1 })
  doc.fillColor(scoreColor(overall)).font('Helvetica-Bold').fontSize(34).text(overall == null ? '—' : `${overall}`, 72, top + 32)
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('/ 100 combined', 74, top + 72)

  const headline = [['Mobile', mobileAvg], ['Desktop', desktopAvg]]
  headline.forEach(([name, val], i) => {
    const x = 190 + i * 108
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(name, x, top + 22, { width: 96 })
    doc.fillColor(scoreColor(val)).font('Helvetica-Bold').fontSize(21).text(val == null ? '—' : String(val), x, top + 36)
  })
  CATS.forEach(([key, name], i) => {
    const x = 390 + (i % 2) * 88, y = top + 22 + Math.floor(i / 2) * 34
    doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(name, x, y, { width: 84 })
    const m = mobile?.[key], d = desktop?.[key]
    doc.fillColor(scoreColor(m)).font('Helvetica-Bold').fontSize(10)
      .text(`${m ?? '—'} / ${d ?? '—'}`, x, y + 9, { width: 84 })
  })
  doc.y = top + 126

  doc.fillColor(MUTED).fontSize(8).font('Helvetica')
    .text(`Measured ${new Date((report.audited_at || report.fetched_at || '').replace(' ', 'T') + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST  ·  Lighthouse ${report.lighthouse_version || 'n/a'}  ·  Request ${req?.id?.slice(0, 8) || '—'}`,
      54, doc.y, { width: W })

  if (report.executive_summary) {
    section(doc, 'Executive summary')
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(clean(report.executive_summary), { width: W, lineGap: 2.5 })
  }

  // Category breakdown, mobile vs desktop
  section(doc, 'Category breakdown (mobile / desktop)')
  CATS.forEach(([key, name]) => {
    ;[['Mobile', mobile?.[key], 0], ['Desktop', desktop?.[key], 1]].forEach(([strategy, val, idx]) => {
      const y = doc.y + 2
      doc.fillColor(INK).font('Helvetica').fontSize(9).text(`${name}${idx ? '  ·  desktop' : ''}`, 54, y, { width: 150 })
      const barX = 200, barW = W - 160
      doc.roundedRect(barX, y + 1, barW, 8, 4).fill(LINE)
      if (val != null) doc.roundedRect(barX, y + 1, Math.max(4, (barW * val) / 100), 8, 4).fill(scoreColor(val))
      doc.fillColor(MUTED).fontSize(8.5).text(val == null ? 'not measured' : `${val}/100`, doc.page.width - 108 - 46, y, { width: 46, align: 'right' })
      doc.y = y + 18
    })
  })

  // Core Web Vitals
  const metricRows = []
  if (core && typeof core === 'object') {
    for (const [key, m] of Object.entries(core)) {
      metricRows.push([m?.label || label(key), m?.mobile?.display || m?.mobile?.value || '—', m?.desktop?.display || m?.desktop?.value || '—'])
    }
  } else {
    for (const [key, m] of Object.entries(legacyMetrics)) metricRows.push([m?.label || label(key), m?.value || '—', '—'])
  }
  if (metricRows.length) {
    section(doc, 'Core Web Vitals')
    metricRows.forEach(([name, mob, desk]) => {
      const y = doc.y
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(clean(name), 54, y, { width: W / 2 })
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(clean(mob), 54 + W / 2 - 40, y, { width: 80, align: 'right' })
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(clean(desk), 54 + W - 80, y, { width: 80, align: 'right' })
      doc.y = y + 16
    })
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text('Values are mobile and desktop respectively.', 54, doc.y + 2, { width: W })
  }

  // Priority fixes
  section(doc, 'Priority fixes')
  if (!recs.length) {
    doc.fillColor(MUTED).fontSize(9).text('No failed audits were reported by Lighthouse for this run.').moveDown(1)
  }
  recs.forEach((r, i) => {
    ensureSpace(doc, 66)
    const y = doc.y
    doc.circle(60, y + 7, 8).fill(INK)
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8).text(String(i + 1), 56, y + 3.5, { width: 8, align: 'center' })
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(clean(r.title).replace(/\[|\]/g, ''), 76, y, { width: W - 40 })
    const tag = [r.priority, r.strategy, r.estimated_impact || r.impact].filter(Boolean).join('  ·  ')
    if (tag) doc.fillColor(MINT).font('Helvetica-Bold').fontSize(7.5).text(clean(tag), 76, doc.y + 1, { width: W - 40 })
    const steps = Array.isArray(r.action_steps) ? r.action_steps.join(' ') : r.detail
    if (steps) doc.fillColor(MUTED).font('Helvetica').fontSize(8.4).text(clean(steps), 76, doc.y + 2, { width: W - 40, lineGap: 1.5 })
    doc.y += 8
  })

  // All findings
  if (findings.length) {
    section(doc, 'Detailed findings')
    doc.fillColor(MUTED).fontSize(8).text(`${findings.length} Lighthouse audits scored below 90. Sorted by estimated impact.`, { width: W }).moveDown(6)
    findings.slice(0, 40).forEach((f) => {
      ensureSpace(doc, 40)
      const y = doc.y
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.8).text(clean(f.title).replace(/\[|\]/g, ''), 54, y, { width: W - 150 })
      const tag = `${String(f.severity || '').toUpperCase()}  ·  ${label(f.category).toUpperCase()}${f.strategy ? `  ·  ${String(f.strategy).toUpperCase()}` : ''}`
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text(tag, doc.page.width - 190, y + 1, { width: 136, align: 'right' })
      const meta = [f.display_value || f.displayValue, f.savings_ms ? `${(f.savings_ms / 1000).toFixed(1)}s opportunity` : '', f.description ? clean(f.description).slice(0, 150) : ''].filter(Boolean).join('  ·  ')
      if (meta) doc.fillColor(MUTED).font('Helvetica').fontSize(7.6).text(meta, 54, doc.y + 1, { width: W, lineGap: 1 })
      doc.moveTo(54, doc.y + 6).lineTo(doc.page.width - 54, doc.y + 6).strokeColor(LINE).stroke()
      doc.y += 12
    })
  }

  // Scope honesty
  section(doc, 'What this report covers')
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.4).text(
    'Scores and findings are produced by Google Lighthouse via the PageSpeed Insights API, run once for mobile and once for desktop. ' +
    'They describe a single measurement moment and can vary with network conditions, third-party scripts and server load. ' +
    'This report does not include penetration testing, uptime monitoring or vulnerability scanning; SiteOps does not claim security certification. ' +
    'Scores are not a guarantee of search ranking or business outcome.',
    { width: W, lineGap: 2 },
  )

  // Footer on every page. Bottom margin is temporarily removed so writing the
  // footer cannot overflow and spawn blank pages.
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    const y = doc.page.height - 44
    const margin = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc.moveTo(54, y - 8).lineTo(doc.page.width - 54, y - 8).strokeColor(LINE).stroke()
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
      .text(`SiteOps · From AI-built to business-ready · ${user?.email || ''}`, 54, y, { width: W - 80, lineBreak: false })
      .text(`Page ${i + 1} of ${range.count}`, doc.page.width - 108, y, { width: 54, align: 'right', lineBreak: false })
    doc.page.margins.bottom = margin
  }
  doc.end()
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

function section(doc, title) {
  ensureSpace(doc, 44)
  doc.moveDown(1.1)
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(title, 54, doc.y, { width: doc.page.width - 108 })
  doc.moveDown(0.45)
}
function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - 70) doc.addPage()
}

const REPORT_DIR = path.resolve(process.env.DATA_DIR || 'data', 'reports')

/** Generate a PDF and keep a copy outside the public web root. */
export async function generatePdfFile(reportId) {
  const bundle = reportBundle(reportId)
  if (!bundle) return null
  const req = one('SELECT * FROM audit_requests WHERE id = ?', bundle.audit_request_id)
  const website = one('SELECT * FROM websites WHERE id = ?', bundle.website_id)
  const user = one('SELECT id, email, full_name FROM users WHERE id = ?', bundle.user_id)
  const buf = await buildReportPdf(bundle, req, website, user)
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const file = path.join(REPORT_DIR, `${bundle.id}.pdf`)
  fs.writeFileSync(file, buf, { mode: 0o600 })
  return { buf, file, report: bundle, website, user, request: req }
}

/** Read a stored PDF, generating it on first use. */
export async function reportFile(reportId) {
  const generated = await generatePdfFile(reportId)
  if (!generated) return null
  return generated
}

/** Report row joined with the website and customer, never with admin notes. */
export function reportBundle(reportId) {
  return one(
    `SELECT r.*, w.name AS website_name, w.display_name AS website_display_name, w.url AS website_url,
            u.email AS user_email, u.full_name AS user_name, u.company AS company_name
       FROM audit_reports r
       JOIN audit_requests a ON a.id = r.audit_request_id
       JOIN websites w ON w.id = r.website_id
       JOIN users u ON u.id = r.user_id
      WHERE r.id = ?`, reportId,
  )
}
