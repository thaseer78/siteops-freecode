import { chromium } from 'playwright-core'
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell'
const B = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE })
let pass = 0, fail = 0
const ok = (n, c, e = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, e) } }

const audit = async (page, label) => {
  const res = await page.evaluate(() => {
    const toRgb = (s) => { const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null }
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
    const bgOf = (el) => {
      let n = el
      while (n && n !== document.documentElement) {
        const c = toRgb(getComputedStyle(n).backgroundColor)
        if (c && c.a > 0.5) return c
        n = n.parentElement
      }
      return { r: 11, g: 6, b: 21, a: 1 }
    }
    const cr = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) }
    const low = []; const small = []
    document.querySelectorAll('main *, footer *, header *').forEach((el) => {
      const txt = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim()
      if (!txt) return
      const s = getComputedStyle(el)
      if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      const size = parseFloat(s.fontSize)
      if (size < 12) small.push({ size, txt: txt.slice(0, 30) })
      const bg = bgOf(el)
      let fg = toRgb(s.color)
      if (!fg) return
      // Gradient-clipped text reports rgba(0,0,0,0); sample the darkest stop of
      // the gradient instead, which is what the eye actually reads.
      if (fg.a === 0 && /gradient/.test(s.backgroundImage)) {
        const stops = [...s.backgroundImage.matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/g)].map((m) => ({ r: +m[1], g: +m[2], b: +m[3], a: 1 }))
        if (stops.length) fg = stops.reduce((best, c) => (cr(c, bg) < cr(best, bg) ? c : best), stops[0])
      }
      if (!fg || fg.a === 0) return
      const fgc = fg.a < 1 ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 } : fg
      const ratio = cr(fgc, bg)
      const bold = +s.fontWeight >= 700
      const large = size >= 24 || (size >= 18.66 && bold)
      const need = large ? 3 : 4.5
      if (ratio < need - 0.02) low.push({ ratio: +ratio.toFixed(2), need, size: +size.toFixed(1), txt: txt.slice(0, 34), color: s.color })
    })
    return { low: low.slice(0, 10), small: small.slice(0, 10) }
  })
  ok(`${label}: text contrast >= 4.5:1 (3:1 large)`, res.low.length === 0, JSON.stringify(res.low))
  ok(`${label}: no text under 12px`, res.small.length === 0, JSON.stringify(res.small))
}

const d = await (await B.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
await d.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' })
await d.waitForTimeout(1500)
// reveal everything so nothing is judged at opacity 0
const H = await d.evaluate(() => document.documentElement.scrollHeight)
for (let y = 0; y < H; y += 400) { await d.evaluate((v) => window.scrollTo(0, v), y); await d.waitForTimeout(90) }
await d.waitForTimeout(700)
await audit(d, 'desktop')

const m = await (await B.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
await m.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' })
await m.waitForTimeout(1200)
const H2 = await m.evaluate(() => document.documentElement.scrollHeight)
for (let y = 0; y < H2; y += 400) { await m.evaluate((v) => window.scrollTo(0, v), y); await m.waitForTimeout(90) }
await m.waitForTimeout(700)
await audit(m, 'mobile')

console.log(`\n${pass} passed, ${fail} failed`)
await B.close()
process.exit(fail ? 1 : 0)
