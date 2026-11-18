#!/usr/bin/env node
/**
 * UI smoke test — real browser walk-through of the customer + admin web apps.
 * Requires the dev server on :3000 and API on :8787, plus the seeded operator
 * password (data/admin-credentials.txt) for admin checks.
 * Usage: node scripts/ui-test.mjs
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@siteops.in'
const credFile = 'data/admin-credentials.txt'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ||
  (fs.existsSync(credFile) ? fs.readFileSync(credFile, 'utf8').match(/^password:\s*(.+)$/m)?.[1] : undefined)

const rand = Math.random().toString(36).slice(2, 7)
const results = []
let pass = 0, fail = 0
const check = (name, cond, extra = '') => {
  if (cond) { pass++; results.push(`  ✓ ${name}`) }
  else { fail++; results.push(`  ✗ ${name} ${extra}`) }
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(String(e)))

async function shot(name) {
  await page.screenshot({ path: `/tmp/ui-${name}.png`, fullPage: false })
}

// ── landing ────────────────────────────────────────────────────────────────
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
check('landing renders hero', (await page.locator('h1').first().innerText()).includes('keep it working'))
check('landing has services section', await page.locator('#services').isVisible())
check('landing shows plans', (await page.locator('#pricing').innerText()).includes('₹2,499'))
await shot('landing')

// ── registration ───────────────────────────────────────────────────────────
await page.getByRole('link', { name: /Start free|Create your account|Start with a free audit/ }).first().click()
await page.waitForURL('**/register')
await page.waitForSelector('text=Create your SiteOps account', { timeout: 15000 })
check('register page loads', true)
await page.locator('#name').fill('Asha Rao')
await page.locator('#email').fill(`ui-${rand}@example.com`)
await page.locator('#company').fill('Kaveri Crafts')
await page.locator('#pw').fill('GoodPass1234')
await page.locator('#pw2').fill('GoodPass1234')
await page.getByRole('button', { name: /Create account/i }).click()
await page.waitForSelector('text=Check your inbox', { timeout: 15000 })
check('registration shows verification state', true)
const devLink = await page.locator('input[readonly]').first().inputValue().catch(() => '')
check('unconfigured email surfaces dev link', devLink.includes('/verify-email?token='))
await shot('register-done')

// ── verification + login ───────────────────────────────────────────────────
await page.goto(devLink)
await page.waitForSelector('text=Sign in to continue', { timeout: 15000 })
check('email verification succeeds', true)
await page.getByRole('button', { name: /Sign in to continue/i }).click()
await page.waitForURL('**/login**')
await page.locator('#email').fill(`ui-${rand}@example.com`)
await page.locator('#password').fill('GoodPass1234')
await page.getByRole('button', { name: /^Sign in/ }).click()
await page.waitForURL('**/app', { timeout: 15000 })
await page.waitForSelector('text=Welcome back', { timeout: 15000 })
check('customer dashboard loads', true)
await shot('dashboard-empty')

// ── add website ────────────────────────────────────────────────────────────
await page.getByRole('link', { name: /Add website/i }).first().click()
await page.locator('#wn').fill('Example Store')
await page.locator('#wu').fill('example.com')
await page.getByRole('button', { name: /^Add website$/ }).last().click()
await page.waitForSelector('text=Example Store', { timeout: 15000 })
check('website added and listed', true)
await shot('websites')

// ── request audit ──────────────────────────────────────────────────────────
await page.getByRole('button', { name: /Request audit/i }).first().click()
await page.getByRole('button', { name: /Run audit/i }).click()
await page.waitForSelector('text=Measurement in progress', { timeout: 15000 })
check('audit request accepted in UI', true)
await shot('audit-modal')
await page.keyboard.press('Escape')
await page.goto(BASE + '/app/audits', { waitUntil: 'networkidle' })
try { await page.waitForSelector('text=Example Store', { timeout: 15000 }) }
catch { results.push('    ↳ audits page text: ' + (await page.locator('body').innerText()).slice(0, 300).replace(/\n/g, ' | ')) }
check('audit listed with status', (await page.locator('body').innerText()).match(/Pending|Running|Completed|Failed/) != null)
await shot('audits')

// ── other customer pages ───────────────────────────────────────────────────
await page.goto(BASE + '/app/reports', { waitUntil: 'networkidle' })
await page.waitForSelector('h1', { timeout: 15000 })
check('reports page renders', (await page.locator('h1').first().innerText()).includes('Audit reports'))
await page.goto(BASE + '/app/notifications', { waitUntil: 'networkidle' })
await page.waitForSelector('h1', { timeout: 15000 })
check('notifications page renders', (await page.locator('h1').first().innerText()).includes('notifications'))
await page.goto(BASE + '/app/profile', { waitUntil: 'networkidle' })
await page.waitForSelector('h1', { timeout: 15000 })
check('profile page renders', (await page.locator('h1').first().innerText()).includes('Profile'))
await shot('profile')

// ── access control in the browser ──────────────────────────────────────────
await page.goto(BASE + '/admin', { waitUntil: 'networkidle' })
check('customer redirected away from admin', page.url().includes('/admin/login'))
await shot('admin-login-denied')

// ── mobile viewport ────────────────────────────────────────────────────────
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const mp = await mobile.newPage()
await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
check('landing responsive on mobile', (await mp.locator('h1').first().innerText()).includes('keep it working'))
await mp.screenshot({ path: '/tmp/ui-mobile-landing.png' })
await mp.goto(BASE + '/app', { waitUntil: 'networkidle' })
check('customer app redirects to login when signed out', mp.url().includes('/login'))
await mobile.close()

// ── admin console ──────────────────────────────────────────────────────────
if (ADMIN_PASSWORD) {
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const ap = await adminCtx.newPage()
  await ap.goto(BASE + '/admin/login', { waitUntil: 'networkidle' })
  check('admin login page renders', (await ap.locator('body').innerText()).includes('Operations sign in'))
  await ap.screenshot({ path: '/tmp/ui-admin-login.png' })
  await ap.locator('#email').fill(ADMIN_EMAIL)
  await ap.locator('#password').fill(ADMIN_PASSWORD)
  await ap.getByRole('button', { name: /^Sign in/ }).click()
  await ap.waitForURL('**/admin', { timeout: 15000 })
  await ap.waitForSelector('text=Console overview', { timeout: 15000 })
  check('admin dashboard loads', true)
  await ap.screenshot({ path: '/tmp/ui-admin-dashboard.png' })
  await ap.goto(BASE + '/admin/audits', { waitUntil: 'networkidle' })
  check('admin audit queue lists customer request', (await ap.locator('body').innerText()).includes('Example Store'))
  await ap.screenshot({ path: '/tmp/ui-admin-audits.png' })
  await ap.goto(BASE + '/admin/customers', { waitUntil: 'networkidle' })
  check('admin customers lists new account', (await ap.locator('body').innerText()).includes(`ui-${rand}@example.com`))
  await ap.screenshot({ path: '/tmp/ui-admin-customers.png' })
  await ap.goto(BASE + '/admin/emails', { waitUntil: 'networkidle' })
  check('admin email log renders', (await ap.locator('body').innerText()).includes('Email delivery'))
  await ap.goto(BASE + '/admin/activity', { waitUntil: 'networkidle' })
  check('admin activity log renders', (await ap.locator('body').innerText()).includes('Activity log'))
  await adminCtx.close()
} else {
  results.push('  ! admin checks skipped (no operator password available)')
}

// ── console hygiene ────────────────────────────────────────────────────────
const meaningful = consoleErrors.filter((e) => !/favicon|Download the React DevTools|Failed to load resource: the server responded with a status of 40[13]/i.test(e))
check('no unexpected browser console errors', meaningful.length === 0, meaningful.slice(0, 3).join(' | '))

await browser.close()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
