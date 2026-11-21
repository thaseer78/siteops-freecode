import { chromium } from 'playwright-core'
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell'
const BASE = process.env.WEB_BASE || 'http://127.0.0.1:3001'
const REPORT = process.argv[2]
let pass = 0, fail = 0
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, e) } }
const rgb = (s) => s.match(/\d+/g)?.slice(0,3).map(Number) || []
const near = (s, [r,g,b], t = 14) => { const c = rgb(s); return c.length === 3 && Math.abs(c[0]-r)<=t && Math.abs(c[1]-g)<=t && Math.abs(c[2]-b)<=t }
const light = (s) => { const c = rgb(s); return c.length === 3 && (0.299*c[0]+0.587*c[1]+0.114*c[2]) > 235 }

const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE })
const c = await b.newContext({ viewport: { width: 1440, height: 1100 } })
const p = await c.newPage()
await p.goto(BASE + '/login', { waitUntil: 'networkidle' })
await p.locator('#email').fill('fixture@siteops.test')
await p.locator('#password').fill('FixturePass1234')
await p.getByRole('button', { name: /^Sign in/ }).click()
await p.waitForURL('**/dashboard', { timeout: 20000 })
await p.goto(`${BASE}/dashboard/reports/${REPORT}`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)

const info = await p.evaluate(() => {
  const doc = document.querySelector('[data-theme="light"]')
  const gauge = document.querySelector('[style*="conic-gradient"]')
  const gaugeInner = gauge?.firstElementChild
  const cards = [...doc.querySelectorAll('.rounded-xl')].filter(e => /Performance|Accessibility|SEO|Best Practices/.test(e.innerText))
  const dots = [...doc.querySelectorAll('span[title]')].filter(s => /Critical|High|Medium/.test(s.title))
  const pdfBtn = [...doc.querySelectorAll('button')].find(x => /Download PDF/i.test(x.textContent))
  const nextBar = [...doc.querySelectorAll('div')].find(x => /Next step/i.test(x.innerText) && x.className.includes('border-t'))
  return {
    containerBg: getComputedStyle(doc).backgroundColor,
    containerBorder: getComputedStyle(doc).borderColor,
    radius: getComputedStyle(doc).borderRadius,
    gauge: !!gauge,
    gaugeColor: gauge ? getComputedStyle(gauge).backgroundImage.slice(0, 120) : 'none',
    metricCards: cards.length,
    metricBg: cards[0] ? getComputedStyle(cards[0]).backgroundColor : 'none',
    magnitude: cards[0] ? getComputedStyle(cards[0]).backgroundColor : 'none',
    severityDots: dots.length,
    dotColors: [...new Set(dots.map(d => getComputedStyle(d).backgroundColor))].slice(0, 4),
    pdfBtnBg: pdfBtn ? getComputedStyle(pdfBtn).backgroundColor : 'none',
    pdfBtnRadius: pdfBtn ? getComputedStyle(pdfBtn).borderRadius : 'none',
    nextBar: !!nextBar,
    hasHeader: /SiteOps/.test(doc.innerText) && /Audit date/i.test(doc.innerText),
    hasSummary: /Executive summary/i.test(doc.innerText),
    hasFindings: /Key findings/i.test(doc.innerText),
    leaked: /internal_admin_notes|SECRET/i.test(document.body.innerText),
  }
})
ok('report container is white', light(info.containerBg), info.containerBg)
ok('report container border #EAE8F2', near(info.containerBorder, [234,232,242], 8), info.containerBorder)
ok('report container rounded-2xl', parseFloat(info.radius) >= 14, info.radius)
ok('SiteOps header + audit date', info.hasHeader)
ok('overall score ring gauge', info.gauge)
ok('four metric cards, white', info.metricCards === 4 && light(info.metricBg), `${info.metricCards} ${info.metricBg}`)
ok('executive summary section', info.hasSummary)
ok('key findings section', info.hasFindings)
ok('severity colour dots', info.severityDots >= 3, String(info.severityDots))
ok('next-steps bar present', info.nextBar)
ok('download PDF button is electric violet', near(info.pdfBtnBg, [124,58,237], 16), info.pdfBtnBg)
ok('no internal admin notes leaked', !info.leaked)
await b.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
