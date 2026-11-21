import { chromium } from 'playwright-core'
import fs from 'node:fs'
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell'
const BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n, extra) } }
const rgb = (s) => s.match(/\d+/g)?.slice(0, 3).map(Number) || []
const near = (s, [r, g, b], tol = 14) => { const c = rgb(s); return c.length === 3 && Math.abs(c[0]-r) <= tol && Math.abs(c[1]-g) <= tol && Math.abs(c[2]-b) <= tol }
const dark = (s) => { const c = rgb(s); return c.length === 3 && (0.299*c[0] + 0.587*c[1] + 0.114*c[2]) < 60 }

const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE })
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } })
const p = await ctx.newPage()
await p.goto(BASE + '/', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)

// nav
const nav = await p.evaluate(() => {
  const h = document.querySelector('header')
  const links = [...h.querySelectorAll('a')].map(a => a.textContent.trim())
  const cta = [...h.querySelectorAll('a')].find(a => /Start free|dashboard/i.test(a.textContent))
  return { bg: getComputedStyle(h).backgroundColor, links, ctaRadius: cta ? getComputedStyle(cta).borderRadius : 'none', ctaBg: cta ? getComputedStyle(cta).backgroundColor : 'none' }
})
ok('nav is obsidian dark', dark(nav.bg), nav.bg)
ok('nav links match spec', ['Services','Features','Pricing','FAQ'].every(l => nav.links.some(x => x.includes(l))), nav.links.join(','))
ok('nav CTA is pill shaped', parseFloat(nav.ctaRadius) >= 100, nav.ctaRadius)
ok('nav CTA is electric violet', near(nav.ctaBg, [124, 58, 237]), nav.ctaBg)

// hero
const hero = await p.evaluate(() => {
  const s = document.querySelector('section')
  const h1 = s.querySelector('h1')
  const span = h1.querySelector('span')
  const btns = [...s.querySelectorAll('a')].filter(a => /Audit my website|See how it works/.test(a.textContent))
  return {
    bg: getComputedStyle(s).backgroundColor,
    h1Color: getComputedStyle(h1).color,
    accent: (() => {
      const el = h1.querySelector('.text-shimmer') || span
      if (!el) return 'none'
      const st = getComputedStyle(el)
      if (st.color !== 'rgba(0, 0, 0, 0)') return st.color
      const stops = st.backgroundImage.match(/rgba?\(\d+, \d+, \d+/g) || []
      return stops.join(' ')
    })(),
    primaryBtn: btns[0] ? getComputedStyle(btns[0]).backgroundColor : 'none',
    primaryRadius: btns[0] ? getComputedStyle(btns[0]).borderRadius : 'none',
    ghostBorder: btns[1] ? getComputedStyle(btns[1]).borderColor : 'none',
    tracking: getComputedStyle(h1).letterSpacing,
  }
})
ok('hero is obsidian dark', dark(hero.bg), hero.bg)
ok('hero headline is white', near(hero.h1Color, [255,255,255]), hero.h1Color)
ok('hero accent line is lavender gradient', /192, 132, 252|196, 181, 253|245, 243, 255|167, 139, 250/.test(hero.accent), hero.accent)
ok('hero primary CTA is lavender pill (#D8B4FE)', parseFloat(hero.primaryRadius) >= 100 && near(hero.primaryBtn, [216,180,254], 12), `${hero.primaryBtn} r=${hero.primaryRadius}`)
ok('hero secondary CTA is bordered', rgb(hero.ghostBorder).length === 3 && !near(hero.ghostBorder, [0,0,0], 5), hero.ghostBorder)
ok('headline has tight tracking', parseFloat(hero.tracking) < -0.5, hero.tracking)

// trust bar 4 metrics
const trust = await p.evaluate(() => {
  const grid = document.querySelector('[aria-labelledby="stats-heading"] .grid')
  return grid ? [...grid.children].map((c) => c.innerText.split('\n')[0]) : []
})
ok('stats strip has four numeric metrics', trust.length === 4, trust.join('|'))
ok('stats strip has no real-time/expert claims', !/Real-time|Expert/i.test(trust.join(' ')), trust.join('|'))

// advantage section light
const adv = await p.evaluate(() => {
  const s = document.querySelector('#features')
  const grid = s.querySelector('#services')
  const cards = grid ? grid.querySelectorAll(':scope > div') : []
  const iconBadge = s.querySelector('.bg-\\[\\#F3E8FF\\]')
  return { bg: getComputedStyle(s).backgroundColor, cardCount: cards.length, iconBg: iconBadge ? getComputedStyle(iconBadge).backgroundColor : 'none', iconColor: iconBadge ? getComputedStyle(iconBadge).color : 'none' }
})
ok('advantage section is light alabaster', near(adv.bg, [250,250,252], 8), adv.bg)
ok('advantage bento has seven cards', adv.cardCount === 7, String(adv.cardCount))
ok('icon badge is lavender tint with violet icon', near(adv.iconBg, [243,232,255], 10) && near(adv.iconColor, [109,40,217], 20), `${adv.iconBg} / ${adv.iconColor}`)

// how it works dark
const how = await p.evaluate(() => {
  const s = document.querySelector('#how')
  const list = [...s.querySelectorAll('ol')][0]
  const nums = list ? [...list.querySelectorAll('span')].filter(e => /^[1-4]$/.test(e.textContent.trim())) : []
  return { bg: getComputedStyle(s).backgroundColor, steps: nums.length, stepBg: nums[0] ? getComputedStyle(nums[0]).backgroundColor : 'none' }
})
ok('how-it-works is dark', dark(how.bg), how.bg)
ok('four numbered steps', how.steps === 4, String(how.steps))
ok('step badges are electric violet', near(how.stepBg, [124,58,237]), how.stepBg)

// pricing
const pricing = await p.evaluate(() => {
  const s = document.querySelector('#pricing')
  const grid = [...s.querySelectorAll('.grid')].find((g) => g.children.length === 3 && /Growth/i.test(g.innerText))
  const cards = grid
    ? [...grid.children].map((w) => w.querySelector(':scope > div > div') || w.firstElementChild || w)
    : []
  const mid = cards.find(c => c.textContent.includes('Growth'))
  const last = cards[cards.length - 1]
  const midBtn = mid?.querySelector('a')
  return {
    bg: getComputedStyle(s).backgroundColor,
    count: cards.length,
    text: s.innerText,
    midCls: mid ? mid.className : '',
    midBefore: (() => {
      if (!mid) return ''
      const b = getComputedStyle(mid, '::before')
      return b.backgroundImage || ''
    })(),
    midBorder: mid ? getComputedStyle(mid).borderColor : 'none',
    midBorderW: mid ? getComputedStyle(mid).borderWidth : 'none',
    midBg: mid ? getComputedStyle(mid).backgroundColor : 'none',
    midBtnBg: midBtn ? getComputedStyle(midBtn).backgroundColor : 'none',
    badge: mid ? /most popular/i.test(mid.innerText) : false,
    thirdPrice: last ? (last.innerText.match(/₹[\d,]+|Custom/) || ['none'])[0] : 'none',
  }
})
ok('pricing section is light', near(pricing.bg, [250,250,252], 8), pricing.bg)
ok('three pricing cards', pricing.count === 3, String(pricing.count))
ok('growth card carries the rotating conic border', /conic-border/.test(pricing.midCls) && /conic-gradient/.test(pricing.midBefore), `${pricing.midCls}`)
ok('growth card has lavender tint', near(pricing.midBg, [250,245,255], 8), pricing.midBg)
ok('growth button is solid violet', near(pricing.midBtnBg, [109,40,217], 20), pricing.midBtnBg)
ok('most popular badge present', pricing.badge)
ok('growth price is ₹4,499', pricing.text.includes('₹4,499'), '')
ok('old price gone', !pricing.text.includes('2,499'))

// FAQ + CTA
const faq = await p.evaluate(() => {
  const s = document.querySelector('#faq')
  const details = s.querySelectorAll('button[aria-expanded]')
  const darkCard = [...s.querySelectorAll('div')].find(d => {
    const bg = getComputedStyle(d).backgroundColor
    const c = bg.match(/\d+/g)?.map(Number) || []
    const lum = c.length === 3 ? 0.299*c[0]+0.587*c[1]+0.114*c[2] : 999
    return d.className.includes('rounded-3xl') && lum < 40
  })
  return {
    bg: getComputedStyle(s).backgroundColor,
    faqs: details.length,
    plusIcons: [...s.querySelectorAll('button[aria-expanded] svg')].length,
    ctaBg: darkCard ? getComputedStyle(darkCard).backgroundColor : 'none',
    ctaText: darkCard ? darkCard.innerText : '',
  }
})
ok('faq section is light', near(faq.bg, [250,250,252], 8), faq.bg)
ok('faq accordions present', faq.faqs >= 5, String(faq.faqs))
ok('faq rows use + icons', faq.plusIcons >= 5, String(faq.plusIcons))
ok('cta card is dark', dark(faq.ctaBg), faq.ctaBg)
ok('cta copy matches spec', /Ready to optimise your website/i.test(faq.ctaText), faq.ctaText.slice(0, 40))

// footer dark
const foot = await p.evaluate(() => {
  const f = document.querySelector('footer')
  const social = f.querySelectorAll('.rounded-full').length
  return { bg: getComputedStyle(f).backgroundColor, social }
})
ok('footer is obsidian dark', dark(foot.bg), foot.bg)
ok('footer has social icons', foot.social >= 3, String(foot.social))

await ctx.close()
await b.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
