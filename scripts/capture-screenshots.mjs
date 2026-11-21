import { chromium } from 'playwright-core'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:3000'
const OUT = 'public/screenshots'
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell'
const admin = fs.readFileSync('data/admin-credentials.txt', 'utf8')
const ADMIN_EMAIL = admin.match(/^email:\s*(.+)$/m)[1].trim()
const ADMIN_PASSWORD = admin.match(/^password:\s*(.+)$/m)[1].trim()

const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE })
const rand = Math.random().toString(36).slice(2, 7)
const email = `shot-${rand}@example.com`

async function shoot(page, name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 900)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!opts.full })
  console.log('captured', name)
}

// ── public pages ──────────────────────────────────────────────────────────
const pub = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const p = await pub.newPage()
await p.goto(BASE + '/', { waitUntil: 'networkidle' })
await shoot(p, 'landing-hero')
await shoot(p, 'landing-full', { full: true })
await p.goto(BASE + '/login', { waitUntil: 'networkidle' })
await shoot(p, 'login')

// ── create a real customer account so dashboard shots show live data ──────
await p.goto(BASE + '/register', { waitUntil: 'networkidle' })
await p.locator('#name').fill('Asha Rao')
await p.locator('#email').fill(email)
await p.locator('#company').fill('Kaveri Crafts')
await p.locator('#pw').fill('GoodPass1234')
await p.locator('#pw2').fill('GoodPass1234')
await p.getByRole('button', { name: /Create account/i }).click()
await p.waitForSelector('text=Check your inbox', { timeout: 20000 })
const devLink = await p.locator('input[readonly]').first().inputValue()
await p.goto(devLink)
await p.waitForSelector('text=Sign in to continue', { timeout: 20000 })
await p.getByRole('button', { name: /Sign in to continue/i }).click()
await p.waitForURL('**/login**')
await p.locator('#email').fill(email)
await p.locator('#password').fill('GoodPass1234')
await p.getByRole('button', { name: /^Sign in/ }).click()
await p.waitForURL('**/app', { timeout: 20000 })
await shoot(p, 'dashboard-empty')

// add a real site and request a real audit
await p.getByRole('link', { name: /Add website/i }).first().click()
await p.locator('#wn').fill('Kaveri Crafts store')
await p.locator('#wu').fill('example.com')
await p.getByRole('button', { name: /^Add website$/ }).last().click()
await p.waitForSelector('text=Kaveri Crafts store', { timeout: 20000 })
await shoot(p, 'websites')

await p.getByRole('button', { name: /Request audit/i }).first().click()
await p.getByRole('button', { name: /Run audit/i }).click()
await p.waitForSelector('text=Measurement in progress', { timeout: 20000 })
await shoot(p, 'audit-request')
await p.keyboard.press('Escape')
await p.goto(BASE + '/app/audits', { waitUntil: 'networkidle' })
await shoot(p, 'audits', { wait: 1500 })
await p.goto(BASE + '/app/notifications', { waitUntil: 'networkidle' })
await shoot(p, 'notifications')

// ── mobile viewport ───────────────────────────────────────────────────────
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const m = await mob.newPage()
await m.goto(BASE + '/', { waitUntil: 'networkidle' })
await shoot(m, 'mobile-landing')
await m.close()

// ── admin console ─────────────────────────────────────────────────────────
const adm = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const a = await adm.newPage()
await a.goto(BASE + '/admin/login', { waitUntil: 'networkidle' })
await a.locator('#email').fill(ADMIN_EMAIL)
await a.locator('#password').fill(ADMIN_PASSWORD)
await a.getByRole('button', { name: /^Sign in/ }).click()
await a.waitForURL('**/admin', { timeout: 20000 })
await shoot(a, 'admin-dashboard', { wait: 1500 })
await a.goto(BASE + '/admin/audits', { waitUntil: 'networkidle' })
await shoot(a, 'admin-audit-queue', { wait: 1200 })
await a.goto(BASE + '/admin/customers', { waitUntil: 'networkidle' })
await shoot(a, 'admin-customers')

await browser.close()
