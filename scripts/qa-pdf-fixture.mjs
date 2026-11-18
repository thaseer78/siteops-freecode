#!/usr/bin/env node
/**
 * QA fixture — renders a PDF from a synthetic report in a THROWAWAY database
 * so the PDF layout can be reviewed without burning PageSpeed quota.
 * This never writes to the application database and is not imported by the app.
 * Usage: DATA_DIR=/tmp/siteops-qa node scripts/qa-pdf-fixture.mjs
 */
process.env.DATA_DIR = process.env.DATA_DIR || '/tmp/siteops-qa'
const { db, run, id, one } = await import('../server/db.mjs')
const { buildReportPdf, reportBundle } = await import('../server/pdf.mjs')
const fs = await import('node:fs')

const uid = id(), wid = id(), rid = id(), aid = id()
run(`INSERT INTO users (id,email,password_hash,full_name,role,email_verified_at) VALUES (?,?,?,?, 'customer',datetime('now'))`,
  uid, 'qa@example.com', 'x', 'Asha Rao')
run(`INSERT INTO websites (id,user_id,name,url) VALUES (?,?,?,?)`, wid, uid, 'Kaveri Crafts', 'https://kavericrafts.example')
run(`INSERT INTO audit_requests (id,website_id,user_id,status,strategy,completed_at) VALUES (?,?,?, 'completed','mobile',datetime('now'))`,
  aid, wid, uid)
const findings = {
  findings: [
    { id: 'largest-contentful-paint', category: 'performance', title: 'Largest Contentful Paint is high', description: 'Largest Contentful Paint marks the time at which the largest text or image is painted.', displayValue: '4.8 s', score: 0.12, weight: 0.25, mode: 'diagnostic', savingsMs: null },
    { id: 'render-blocking-resources', category: 'performance', title: 'Eliminate render-blocking resources', description: 'Resources are blocking the first paint of your page. Consider delivering critical JS/CSS inline.', displayValue: 'Potential savings of 1,240 ms', score: 0.3, weight: 0, mode: 'opportunity', savingsMs: 1240 },
    { id: 'image-alt', category: 'accessibility', title: 'Image elements do not have [alt] attributes', description: 'Informative elements should aim for short, descriptive alternate text.', displayValue: '3 images', score: 0, weight: 1, mode: 'a11y-image-alt' },
    { id: 'color-contrast', category: 'accessibility', title: 'Background and foreground colours do not have a sufficient contrast ratio', description: 'Low-contrast text is difficult for some users to read.', displayValue: '6 elements', score: 0.4, weight: 1, mode: 'a11y-color-contrast' },
    { id: 'meta-description', category: 'seo', title: 'Document does not have a meta description', description: 'Meta descriptions may be included in search results.', displayValue: '', score: 0, weight: 1, mode: 'seo' },
    { id: 'uses-http2', category: 'best-practices', title: 'Does not use HTTP/2 for all of its resources', description: 'HTTP/2 offers many benefits over HTTP/1.1.', displayValue: '4 requests', score: 0.5, weight: 0, mode: 'diagnostic' },
  ],
  recommendations: [
    { title: 'Eliminate render-blocking resources', category: 'performance', detail: 'Resources are blocking the first paint of your page. Deliver critical JS/CSS inline and defer the rest.', impact: '1.2s potential saving' },
    { title: 'Image elements do not have alt attributes', category: 'accessibility', detail: 'Add descriptive alt text to 3 images so screen readers can convey their meaning.', impact: '3 images' },
    { title: 'Add a meta description', category: 'seo', detail: 'Write a 140–160 character description of the page for search result snippets.', impact: '' },
  ],
}
run(`INSERT INTO audit_reports (id,audit_request_id,website_id,user_id,url,strategy,performance,seo,accessibility,best_practices,overall,findings,metrics,lighthouse_version)
     VALUES (?,?,?,?,?, 'mobile',46,83,71,92,73,?,?, '12.2.1')`,
  rid, aid, wid, uid, 'https://kavericrafts.example', JSON.stringify(findings),
  JSON.stringify({
    'first-contentful-paint': { label: 'First Contentful Paint', value: '2.1 s', score: 0.7 },
    'largest-contentful-paint': { label: 'Largest Contentful Paint', value: '4.8 s', score: 0.12 },
    'total-blocking-time': { label: 'Total Blocking Time', value: '410 ms', score: 0.6 },
    'cumulative-layout-shift': { label: 'Cumulative Layout Shift', value: '0.02', score: 0.99 },
  }))
const report = reportBundle(rid)
const buf = await buildReportPdf(report, one('SELECT * FROM audit_requests WHERE id=?', aid),
  one('SELECT * FROM websites WHERE id=?', wid), one('SELECT * FROM users WHERE id=?', uid))
fs.writeFileSync('/tmp/siteops-qa-report.pdf', buf)
console.log(`QA PDF written: /tmp/siteops-qa-report.pdf (${buf.length} bytes)`)
db.close()
