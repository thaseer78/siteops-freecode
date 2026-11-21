import { chromium } from 'playwright-core'
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell'
const B = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE })
let pass = 0, fail = 0
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, e) } }

/* 360px mobile */
const m = await (await B.newContext({ viewport: { width: 360, height: 780 } })).newPage()
await m.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' })
await m.waitForTimeout(1200)
const info = await m.evaluate(() => {
  const cs = (e) => getComputedStyle(e)
  const clipped = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) if (cs(n).overflowX !== 'visible') return true; return false }
  let worst = null
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (!r.width || cs(el).position === 'fixed' || clipped(el)) return
    const over = Math.round(r.right - document.documentElement.clientWidth)
    if (over > 1 && (!worst || over > worst.over)) worst = { over, cls: (el.className || '').toString().slice(0, 50), txt: (el.textContent || '').trim().slice(0, 24) }
  })
  const btn = document.querySelector('header button[aria-controls="landing-mobile-drawer"]')
  const signIn = [...document.querySelectorAll('header a')].find((a) => /Sign in/.test(a.textContent))
  const startFree = [...document.querySelectorAll('header a')].find((a) => /Start free/.test(a.textContent))
  return {
    docW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    worst, burger: btn ? cs(btn).display : 'none', burgerLabel: btn?.getAttribute('aria-label'),
    expanded: btn?.getAttribute('aria-expanded'),
    signInVisible: signIn ? cs(signIn).display !== 'none' : false,
    startFreeVisible: startFree ? cs(startFree).display !== 'none' : false,
    anyOverflowX: cs(document.body).overflowX,
  }
})
ok('no horizontal overflow at 360px', info.docW <= info.clientW, `${info.docW} > ${info.clientW} ${JSON.stringify(info.worst)}`)
ok('no element escapes to widen page', !info.worst, JSON.stringify(info.worst))
ok('hamburger visible on mobile', info.burger !== 'none', info.burger)
ok('hamburger has aria-label', !!info.burgerLabel, info.burgerLabel)
ok('hamburger starts aria-expanded=false', info.expanded === 'false', info.expanded)
ok('Start free stays visible', info.startFreeVisible)

/* open the drawer */
await m.locator('header button[aria-controls="landing-mobile-drawer"]').click()
await m.waitForTimeout(400)
const drawer = await m.evaluate(() => {
  const d = document.getElementById('landing-mobile-drawer')
  const cs = getComputedStyle
  return {
    exists: !!d,
    role: d?.getAttribute('role'),
    modal: d?.getAttribute('aria-modal'),
    label: d?.getAttribute('aria-label'),
    open: d?.getAttribute('data-open'),
    transformed: d ? cs(d).transform : 'none',
    links: d ? [...d.querySelectorAll('a')].map((a) => a.textContent.trim()) : [],
    focusInside: d ? d.contains(document.activeElement) : false,
    expanded: document.querySelector('header button[aria-controls="landing-mobile-drawer"]')?.getAttribute('aria-expanded'),
  }
})
ok('drawer exists with role=dialog', drawer.exists && drawer.role === 'dialog', drawer.role)
ok('drawer is modal + labelled', drawer.modal === 'true' && !!drawer.label, `${drawer.modal} ${drawer.label}`)
ok('drawer slid into view', drawer.open === 'true' && (drawer.transformed === 'none' || drawer.transformed === 'matrix(1, 0, 0, 1, 0, 0)'), drawer.transformed)
ok('drawer has all section links', ['Services', 'Features', 'How it works', 'Pricing', 'FAQ'].every((l) => drawer.links.some((x) => x.includes(l))), drawer.links.join(','))
ok('focus moved inside drawer', drawer.focusInside)
ok('aria-expanded=true when open', drawer.expanded === 'true', drawer.expanded)
ok('drawer body scroll locked', await m.evaluate(() => document.body.style.overflow === 'hidden'))

/* escape closes and restores focus */
await m.keyboard.press('Escape')
await m.waitForTimeout(350)
const after = await m.evaluate(() => ({
  gone: !document.getElementById('landing-mobile-drawer'),
  expanded: document.querySelector('header button[aria-controls="landing-mobile-drawer"]')?.getAttribute('aria-expanded'),
  focusOnTrigger: document.activeElement?.getAttribute('aria-controls') === 'landing-mobile-drawer',
  scrollUnlocked: document.body.style.overflow !== 'hidden',
}))
ok('Escape closes the drawer', after.gone)
ok('aria-expanded back to false', after.expanded === 'false', after.expanded)
ok('focus returned to trigger', after.focusOnTrigger)
ok('background scroll restored', after.scrollUnlocked)

/* a drawer link navigates and closes */
await m.locator('header button[aria-controls="landing-mobile-drawer"]').click()
await m.waitForTimeout(300)
await m.locator('#landing-mobile-drawer a[href="#pricing"]').click()
await m.waitForTimeout(600)
ok('drawer link closes drawer', await m.evaluate(() => !document.getElementById('landing-mobile-drawer')))

/* FAQ: first open by default, aria wired */
const faq = await m.evaluate(() => {
  const btns = [...document.querySelectorAll('#faq button[aria-expanded]')]
  const first = btns[0]
  return {
    count: btns.length,
    firstExpanded: first?.getAttribute('aria-expanded'),
    controls: first?.getAttribute('aria-controls'),
    panelExists: !!(first && document.getElementById(first.getAttribute('aria-controls'))),
    panelRole: first ? document.getElementById(first.getAttribute('aria-controls'))?.getAttribute('role') : null,
    othersCollapsed: btns.slice(1).every((b) => b.getAttribute('aria-expanded') === 'false'),
  }
})
ok('faq has 6 rows', faq.count === 6, String(faq.count))
ok('first faq opens by default', faq.firstExpanded === 'true', faq.firstExpanded)
ok('faq aria-controls points at a real panel', faq.panelExists && faq.controls, faq.controls)
ok('faq panel has region role', faq.panelRole === 'region', faq.panelRole)
ok('other faqs start collapsed', faq.othersCollapsed)

console.log(`\n${pass} passed, ${fail} failed`)
await B.close()
process.exit(fail ? 1 : 0)
