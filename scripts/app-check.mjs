import { chromium } from 'playwright-core'
import fs from 'node:fs'
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell'
const BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000'
const API = 'http://127.0.0.1:8787'
let pass = 0, fail = 0
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, e) } }
const rgb = (s) => s.match(/\d+/g)?.slice(0,3).map(Number) || []
const near = (s, [r,g,b], t = 14) => { const c = rgb(s); return c.length === 3 && Math.abs(c[0]-r)<=t && Math.abs(c[1]-g)<=t && Math.abs(c[2]-b)<=t }
const dark = (s) => { const c = rgb(s); return c.length === 3 && (0.299*c[0]+0.587*c[1]+0.114*c[2]) < 62 }
const light = (s) => { const c = rgb(s); return c.length === 3 && (0.299*c[0]+0.587*c[1]+0.114*c[2]) > 235 }

const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE })

/* ── Auth pages ── */
const ac = await b.newContext({ viewport: { width: 1440, height: 1000 } })
const ap = await ac.newPage()
for (const [path, label] of [['/login','login'],['/register','register'],['/verify-email','verify'],['/forgot-password','forgot'],['/admin/login','admin-login']]) {
  await ap.goto(BASE + path, { waitUntil: 'networkidle' })
  const info = await ap.evaluate(() => {
    const shell = document.querySelector('[data-theme="dark"]')
    const card = [...document.querySelectorAll('.rounded-2xl')].find(e => getComputedStyle(e).backgroundColor.match(/rgba?\(22, 21, 30/))
    const input = document.querySelector('input.input, input#email')
    const btn = [...document.querySelectorAll('button')].find(x => /Sign in|Continue|Send|Create/i.test(x.textContent))
    return {
      bg: shell ? getComputedStyle(shell).backgroundColor : 'none',
      cardBg: card ? getComputedStyle(card).backgroundColor : 'none',
      cardBorder: card ? getComputedStyle(card).borderColor : 'none',
      inputBg: input ? getComputedStyle(input).backgroundColor : 'none',
      inputFocusRing: input ? getComputedStyle(input).getPropertyValue('--tw-ring-color') : '',
      btnBg: btn ? getComputedStyle(btn).backgroundColor : 'none',
      hasLogo: !!document.querySelector('svg'),
    }
  })
  ok(`${label}: obsidian background`, dark(info.bg), info.bg)
  ok(`${label}: elevated dark card`, rgb(info.cardBg).length===3 && dark(info.cardBg), info.cardBg)
  ok(`${label}: violet submit button`, info.btnBg === 'none' || near(info.btnBg, [124,58,237], 20), info.btnBg)
  if (label === 'login') {
    ok('login: dark input surface', dark(info.inputBg) || info.inputBg === 'none', info.inputBg)
    ok('login: logo present', info.hasLogo)
  }
}
await ac.close()

/* ── Customer dark shell ── */
const email = `app-${Date.now()}@example.com`
const reg = await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ full_name: 'App Check', email, password: 'GoodPass1234' }) }).then(r => r.json())
await fetch(API + '/api/auth/verify-email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: new URL(reg.dev_verification_url).searchParams.get('token') }) })
const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'GoodPass1234' }) })
const cookie = (login.headers.getSetCookie() || []).map(c => c.split(';')[0]).find(c => c.startsWith('siteops_session='))
const h = { 'content-type': 'application/json', cookie }
await fetch(API + '/api/websites', { method: 'POST', headers: h, body: JSON.stringify({ display_name: 'Kaveri Crafts', url: 'example.com' }) })

const cc = await b.newContext({ viewport: { width: 1440, height: 1000 } })
await cc.addCookies([{ name: 'siteops_session', value: cookie.split('=')[1], domain: '127.0.0.1', path: '/' }])
const cp = await cc.newPage()

// sidebar nav labels
await cp.goto(BASE + '/dashboard', { waitUntil: 'networkidle' })
await cp.waitForTimeout(1200)
const side = await cp.evaluate(() => {
  const shell = document.querySelector('[data-theme="dark"]')
  const aside = shell.querySelector('aside')
  const active = aside.querySelector('.nav-link-active')
  const links = [...aside.querySelectorAll('nav a')].map(a => a.textContent.trim())
  return {
    pageBg: getComputedStyle(shell).backgroundColor,
    asideBg: getComputedStyle(aside).backgroundColor,
    asideBorder: getComputedStyle(aside).borderRightColor,
    activeBg: active ? getComputedStyle(active).backgroundImage : 'none',
    activeColor: active ? getComputedStyle(active).color : 'none',
    links,
    logoutLast: /\bLogout\b/i.test(aside.innerText),
    avatar: (() => { const a = [...shell.querySelectorAll('header .rounded-full')].find(e => /gradient/.test(getComputedStyle(e).backgroundImage)); return a ? getComputedStyle(a).backgroundImage : 'none' })(),
  }
})
ok('customer page bg is #0F0E13', near(side.pageBg, [15,14,19], 6), side.pageBg)
ok('sidebar on #16151D', near(side.asideBg, [22,21,29], 6), side.asideBg)
ok('sidebar hairline #262432', near(side.asideBorder, [38,36,50], 8), side.asideBorder)
ok('active nav pill is plum gradient', /gradient/.test(side.activeBg), side.activeBg)
ok('nav has spec labels', ['Dashboard','My websites','Audit requests','Reports','Notifications'].every(l => side.links.some(x => x.includes(l))), side.links.join(','))
ok('logout at sidebar bottom', side.logoutLast)
ok('avatar uses violet gradient', /gradient/.test(side.avatar), side.avatar)

const kpis = await cp.evaluate(() => {
  const labels = [...document.querySelectorAll('.card')].map(c => c.innerText.split('\n')[0])
  const kpis = ['TOTAL WEBSITES','AUDIT REQUESTS','REPORTS READY','AVG SCORE'].filter(l => document.body.innerText.toUpperCase().includes(l))
  return { labels, kpis, chart: !!document.querySelector('svg[aria-label="Website health trend"]'), greeting: /Welcome back,/.test(document.body.innerText) }
})
ok('four KPI cards', kpis.kpis.length === 4, kpis.labels.join('|'))
ok('greeting header present', kpis.greeting)
await cp.goto(BASE + '/dashboard/reports', { waitUntil: 'networkidle' })
await cp.waitForTimeout(600)
const reportBg = await cp.evaluate(() => {
  const c = document.querySelector('.card')
  return { cardBg: getComputedStyle(c).backgroundColor, cardBorder: getComputedStyle(c).borderColor }
})
ok('customer cards on dark elevated surface', near(reportBg.cardBg, [22,21,29], 6), reportBg.cardBg)
ok('customer card border #262432', near(reportBg.cardBorder, [38,36,50], 10), reportBg.cardBorder)
await cc.close()

/* ── Admin light shell ── */
const cred = fs.readFileSync('data/admin-credentials.txt', 'utf8')
const aEmail = cred.match(/^email:\s*(.+)$/m)[1].trim()
const aPass = cred.match(/^password:\s*(.+)$/m)[1].trim()
const lc = await b.newContext({ viewport: { width: 1440, height: 1000 } })
const lp = await lc.newPage()
await lp.goto(BASE + '/admin/login', { waitUntil: 'networkidle' })
await lp.locator('#email').fill(aEmail)
await lp.locator('#password').fill(aPass)
await lp.getByRole('button', { name: /^Sign in/ }).click()
await lp.waitForURL('**/admin', { timeout: 20000 })
await lp.waitForTimeout(1500)
const adm = await lp.evaluate(() => {
  const shell = document.querySelector('[data-theme="light"]')
  const aside = shell.querySelector('aside')
  const active = aside.querySelector('.nav-link-active')
  const card = shell.querySelector('.card')
  return {
    pageBg: getComputedStyle(shell).backgroundColor,
    asideBg: getComputedStyle(aside).backgroundColor,
    asideBorder: getComputedStyle(aside).borderRightColor,
    activeBg: getComputedStyle(active).backgroundColor,
    activeColor: getComputedStyle(active).color,
    cardBg: getComputedStyle(card).backgroundColor,
    cardBorder: getComputedStyle(card).borderColor,
    links: [...aside.querySelectorAll('nav a')].map(a => a.textContent.trim()),
    badge: /Admin/.test(shell.querySelector('header').innerText),
    sendCard: /Send (Report|Email)/i.test(shell.innerText),
    table: !!shell.querySelector('table'),
    h1: shell.querySelector('h1')?.innerText.trim(),
  }
})
ok('admin page bg #F8F7FC', near(adm.pageBg, [248,247,252], 6), adm.pageBg)
ok('admin sidebar white', light(adm.asideBg), adm.asideBg)
ok('admin sidebar border #EAE8F2', near(adm.asideBorder, [234,232,242], 8), adm.asideBorder)
ok('admin active pill lavender #EDE9FE', near(adm.activeBg, [237,233,254], 10), adm.activeBg)
ok('admin active text violet', near(adm.activeColor, [124,58,237], 20), adm.activeColor)
ok('admin cards white with crisp border', light(adm.cardBg) && near(adm.cardBorder, [234,232,242], 8), `${adm.cardBg} / ${adm.cardBorder}`)
ok('admin nav labels match spec', ['Dashboard','Customers','Audit requests','Reports','Email logs','Activity logs'].every(l => adm.links.some(x => x.includes(l))), adm.links.join(','))
ok('admin header has Admin badge', adm.badge)
ok('admin dashboard titled Admin Dashboard', adm.h1 === 'Admin Dashboard', adm.h1)
ok('Send Report card present', adm.sendCard)
ok('recent requests table present', adm.table)
await lc.close()
await b.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
