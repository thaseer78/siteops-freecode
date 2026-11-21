/**
 * Landing behaviour regression: FAQ accordion, nav hrefs, CTA destinations,
 * the pricing toggle and the mobile drawer. Complements layout-check.mjs
 * (geometry) and a11y-check.mjs (contrast/type sizes).
 */
import { chromium } from 'playwright-core'

const EXE =
  process.env.CHROME_PATH ||
  process.env.HOME +
    '/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell'
const BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000'

let pass = 0
let fail = 0
const ok = (n, c, e = '') => {
  if (c) {
    pass++
    console.log('  ✓', n)
  } else {
    fail++
    console.log('  ✗', n, e)
  }
}

const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|4\d\d|429|fonts\.g/i.test(m.text())) errs.push(m.text())
})

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

/* ── FAQ ── */
const faq = page.locator('#faq button[aria-expanded]')
const count = await faq.count()
ok('six FAQ rows', count === 6, String(count))
ok('first FAQ open by default', (await faq.first().getAttribute('aria-expanded')) === 'true')
ok('others collapsed', (await Promise.all([1, 2, 3, 4, 5].map((i) => faq.nth(i).getAttribute('aria-expanded')))).every((v) => v === 'false'))

await faq.nth(2).click()
await page.waitForTimeout(450)
ok('clicking a row opens it', (await faq.nth(2).getAttribute('aria-expanded')) === 'true')
ok('opening another closes the first', (await faq.first().getAttribute('aria-expanded')) === 'false')

const panelId = await faq.nth(2).getAttribute('aria-controls')
const answer = await page.evaluate((id) => {
  const panel = document.getElementById(id)
  if (!panel) return { h: 0, text: '' }
  return { h: Math.round(panel.getBoundingClientRect().height), text: panel.innerText.trim().slice(0, 40) }
}, panelId)
ok('open answer has real height', answer.h > 20, `${answer.h}px`)
ok('open answer shows its text', answer.text.length > 10, answer.text)

await faq.nth(2).click()
await page.waitForTimeout(450)
const closedH = await page.evaluate((id) => Math.round(document.getElementById(id).getBoundingClientRect().height), panelId)
ok('clicking again collapses it', closedH < 4, `${closedH}px`)

/* ── Nav hrefs & CTAs ── */
for (const [label, id] of [['Services', '#services'], ['Features', '#features'], ['How it works', '#how'], ['Pricing', '#pricing'], ['FAQ', '#faq']]) {
  ok(`nav "${label}" targets ${id}`, (await page.locator(`header a[href="${id}"]`).count()) > 0)
}
ok('Sign in links to /login', (await page.locator('header a[href="/login"]').count()) > 0)
ok('Start free links to /register', (await page.locator('header a[href="/register"]').count()) > 0)

/* ── Pricing toggle ── */
const monthly = page.getByRole('button', { name: /^Monthly/ })
const annual = page.getByRole('button', { name: /^Annual/ })
ok('monthly pressed by default', (await monthly.getAttribute('aria-pressed')) === 'true')
ok('monthly shows ₹4,499', (await page.locator('#pricing').innerText()).includes('₹4,499'))
await annual.click()
await page.waitForTimeout(350)
ok('annual pressed after click', (await annual.getAttribute('aria-pressed')) === 'true')
const annualText = await page.locator('#pricing').innerText()
ok('annual shows a TODO rather than a guessed price', /TODO/.test(annualText) && !annualText.includes('₹4,499'))
await monthly.click()
await page.waitForTimeout(350)
ok('switching back restores ₹4,499', (await page.locator('#pricing').innerText()).includes('₹4,499'))

/* ── Pricing CTAs ── */
const pricingText = await page.locator('#pricing').innerText()
ok('Custom plan CTA is "Talk to us"', /Talk to us/i.test(pricingText))
ok('Free plan is labelled Free', /Free/.test(pricingText))

/* ── Footer ── */
const footer = await page.locator('footer').innerText()
ok('footer has Privacy, Terms and Refund', /Privacy/.test(footer) && /Terms/.test(footer) && /Refund/.test(footer))
ok('footer has About and Contact', /About/.test(footer) && /Contact/.test(footer))
ok('public footer hides the operations console', !/Operations console/i.test(footer))
ok('footer shows TODO company placeholders', /TODO/.test(footer))
const socials = await page.evaluate(() =>
  [...document.querySelectorAll('footer a[rel*="noopener"] svg path')].length
)
ok('footer uses real SVG social icons', socials === 3, String(socials))

/* ── Legal pages resolve ── */
for (const path of ['/privacy', '/terms', '/refund', '/about', '/contact']) {
  const r = await page.goto(BASE + path, { waitUntil: 'networkidle' })
  const h1 = await page.locator('h1').first().innerText()
  ok(`${path} loads`, r.status() === 200 && h1.length > 3, `${r.status()} ${h1}`)
}

/* ── No console noise ── */
ok('no runtime errors', errs.length === 0, errs.slice(0, 3).join(' | '))

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
