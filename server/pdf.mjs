import PDFDocument from 'pdfkit'
import { one, all } from './db.mjs'

const INK = '#0B1220', MUTED = '#5A6B85', MINT = '#0E9673', LINE = '#E3E8F0', SOFT = '#F5F7FB'
const scoreColor = (n) =>
  n == null ? MUTED : n >= 90 ? '#0E9673' : n >= 70 ? '#2E55C8' : n >= 50 ? '#C2760A' : '#C03A2B'
const label = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const clean = (s = '') => String(s).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()

export function buildReportPdf(report, req, website, user) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 54, left: 54, right: 54, bottom: 64 }, bufferPages: true })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const W = doc.page.width - 108
  const data = safe(report.findings, {})
  const findings = data.findings || []
  const recs = data.recommendations || []
  const metrics = safe(report.metrics, {})

  // Header band
  doc.rect(0, 0, doc.page.width, 132).fill(INK)
  doc.fillColor('#34D3A4').font('Helvetica-Bold').fontSize(9).text('SITEOPS', 54, 44, { characterSpacing: 2 })
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('Website Health Report', 54, 62)
  doc.fillColor('#9DB0CC').font('Helvetica').fontSize(9.5)
    .text(`${clean(website?.name || report.url)}  ·  ${report.url}`, 54, 94, { width: W - 120 })
  doc.fillColor('#9DB0CC').fontSize(9).text(report.strategy === 'desktop' ? 'Desktop' : 'Mobile',
    doc.page.width - 150, 94, { width: 96, align: 'right' })
  doc.y = 168

  // Overall score panel
  const top = doc.y
  doc.roundedRect(54, top, W, 96, 10).fill(SOFT)
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('OVERALL HEALTH', 74, top + 20, { characterSpacing: 1 })
  doc.fillColor(scoreColor(report.overall)).font('Helvetica-Bold').fontSize(34)
    .text(report.overall == null ? '—' : `${report.overall}`, 72, top + 34)
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('/ 100 average of four categories', 74, top + 74)
  const cats = [
    ['Performance', report.performance], ['Accessibility', report.accessibility],
    ['Best Practices', report.best_practices], ['SEO', report.seo],
  ]
  cats.forEach(([name, val], i) => {
    const x = 250 + i * 82
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(name, x, top + 24, { width: 76 })
    doc.fillColor(scoreColor(val)).font('Helvetica-Bold').fontSize(21).text(val == null ? '—' : String(val), x, top + 38)
  })
  doc.y = top + 120

  doc.fillColor(MUTED).fontSize(8).font('Helvetica')
    .text(`Measured ${new Date(report.fetched_at + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST  ·  Lighthouse ${report.lighthouse_version || 'n/a'}  ·  Request ${req?.id?.slice(0, 8) || '—'}`,
      54, doc.y, { width: W })

  // Category breakdown
  section(doc, 'Category breakdown')
  cats.forEach(([name, val]) => {
    const y = doc.y + 2
    doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(name, 54, y, { width: 140 })
    const barX = 200, barW = W - 160
    doc.roundedRect(barX, y + 1, barW, 8, 4).fill(LINE)
    if (val != null) doc.roundedRect(barX, y + 1, Math.max(4, (barW * val) / 100), 8, 4).fill(scoreColor(val))
    doc.fillColor(MUTED).fontSize(8.5).text(val == null ? 'not measured' : `${val}/100`, doc.page.width - 108 - 46, y, { width: 46, align: 'right' })
    doc.y = y + 20
  })

  if (Object.keys(metrics).length) {
    section(doc, 'Measured field metrics')
    const keys = Object.keys(metrics)
    keys.forEach((k, i) => {
      const col = i % 2, row = Math.floor(i / 2)
      const x = 54 + col * (W / 2), y = doc.y + row * 30
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(clean(metrics[k].label), x, y, { width: W / 2 - 12 })
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(clean(metrics[k].value), x, y + 11, { width: W / 2 - 12 })
    })
    doc.y += Math.ceil(keys.length / 2) * 30 + 6
  }

  // Priorities
  section(doc, 'Priority fixes')
  if (recs.length === 0) {
    doc.fillColor(MUTED).fontSize(9).text('No failed audits were reported by Lighthouse for this run.').moveDown(1)
  }
  recs.forEach((r, i) => {
    ensureSpace(doc, 58)
    const y = doc.y
    doc.circle(60, y + 7, 8).fill('#0B1220')
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8).text(String(i + 1), 56, y + 3.5, { width: 8, align: 'center' })
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(clean(r.title), 76, y, { width: W - 30 })
    if (r.impact) doc.fillColor(MINT).font('Helvetica-Bold').fontSize(7.5).text(clean(r.impact), 76, doc.y + 1, { width: W - 30 })
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.4).text(clean(r.detail), 76, doc.y + 2, { width: W - 30, lineGap: 1.5 })
    doc.y += 8
  })

  // All findings
  if (findings.length) {
    section(doc, 'Detailed findings')
    doc.fillColor(MUTED).fontSize(8).text(`${findings.length} Lighthouse audits flagged. Sorted by estimated impact.`, { width: W }).moveDown(6)
    findings.slice(0, 28).forEach((f) => {
      ensureSpace(doc, 34)
      const y = doc.y
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.8).text(clean(f.title), 54, y, { width: W - 120 })
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text(label(f.category).toUpperCase(), doc.page.width - 150, y + 1, { width: 96, align: 'right' })
      const meta = [f.displayValue, f.savingsMs ? `${(f.savingsMs / 1000).toFixed(1)}s opportunity` : ''].filter(Boolean).join('  ·  ')
      if (meta) doc.fillColor(MINT).font('Helvetica').fontSize(7.6).text(clean(meta), 54, doc.y + 1, { width: W })
      doc.moveTo(54, doc.y + 6).lineTo(doc.page.width - 54, doc.y + 6).strokeColor(LINE).stroke()
      doc.y += 12
    })
  }

  // Scope honesty
  section(doc, 'What this report covers')
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.4).text(
    'Scores and findings are produced by Google Lighthouse via the PageSpeed Insights API for the URL and device strategy above. ' +
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
function safe(v, fallback) {
  try { const p = typeof v === 'string' ? JSON.parse(v) : v; return p || fallback } catch { return fallback }
}

export function reportBundle(reportId) {
  return one(
    `SELECT r.*, a.customer_note, a.requested_at, a.completed_at, w.name AS website_name, w.url AS website_url,
            u.email AS user_email, u.full_name AS user_name
       FROM audit_reports r
       JOIN audit_requests a ON a.id = r.audit_request_id
       JOIN websites w ON w.id = r.website_id
       JOIN users u ON u.id = r.user_id
      WHERE r.id = ?`, reportId,
  )
}
export { all }
