import { chromium } from 'playwright-core'
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell'
const B = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE })
let pass = 0, fail = 0
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  ✓', n, e ? `(${e})` : '') } else { fail++; console.log('  ✗', n, e) } }

/* ── CLS on mobile with animations running ── */
const ctx = await B.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
await p.addInitScript(() => {
  window.__cls = 0
  window.__shifts = []
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.hadRecentInput) {
        window.__cls += e.value
        window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime) })
      }
    }
  }).observe({ type: 'layout-shift', buffered: true })
})
await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' })
// Scroll the whole page slowly so every reveal + count-up + chart fires.
const h = await p.evaluate(() => document.documentElement.scrollHeight)
for (let y = 0; y < h; y += 320) {
  await p.evaluate((yy) => window.scrollTo(0, yy), y)
  await p.waitForTimeout(140)
}
await p.waitForTimeout(1600)
const cls = await p.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts.slice(0, 6) }))
ok('CLS < 0.05 on mobile', cls.cls < 0.05, `CLS=${cls.cls.toFixed(4)} shifts=${JSON.stringify(cls.shifts)}`)

/* ── touch targets on mobile ── */
const small = await p.evaluate(() => {
  const out = []
  document.querySelectorAll('a[href], button').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    if (r.height < 24 || r.width < 24) out.push({ h: Math.round(r.height), w: Math.round(r.width), t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 26) })
  })
  return out.filter((o) => !/skip|logo/i.test(o.t)).slice(0, 8)
})
ok('interactive targets >= 24px', small.length === 0, JSON.stringify(small))

/* ── reduced motion: everything visible, no running animations ── */
const rm = await B.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const rp = await rm.newPage()
await rp.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' })
await rp.waitForTimeout(700)
const rmInfo = await rp.evaluate(() => {
  const hidden = []
  document.querySelectorAll('.reveal, .word-rise, .spring-in').forEach((el) => {
    const s = getComputedStyle(el)
    if (+s.opacity < 0.99) hidden.push((el.textContent || '').trim().slice(0, 26))
  })
  const running = []
  document.querySelectorAll('*').forEach((el) => {
    const name = getComputedStyle(el).animationName
    if (name && name !== 'none' && getComputedStyle(el).animationPlayState === 'running') running.push(name)
  })
  // Without scrolling: are below-the-fold reveals already visible?
  return {
    hidden,
    runningCount: running.length,
    runningUnique: [...new Set(running)],
    progressBar: !!document.querySelector('.scroll-progress'),
    scoreText: document.querySelector('[aria-label*="Sample overall score"]')?.textContent?.trim(),
  }
})
ok('reduced motion: no element left hidden', rmInfo.hidden.length === 0, JSON.stringify(rmInfo.hidden.slice(0, 5)))
ok('reduced motion: no running animations', rmInfo.runningCount === 0, JSON.stringify(rmInfo.runningUnique.slice(0, 6)))
ok('reduced motion: scroll progress bar removed', !rmInfo.progressBar)
ok('reduced motion: score shown at final value', /94/.test(rmInfo.scoreText || ''), rmInfo.scoreText)

console.log(`\n${pass} passed, ${fail} failed`)
await B.close()
process.exit(fail ? 1 : 0)
