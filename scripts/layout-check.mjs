/**
 * Landing layout regression.
 *
 * Asserts the desktop multi-column conversion and the mobile collapse using
 * real geometry: grid column counts, the 3×3 bento filling with no orphan cell,
 * equal-height pricing rows, and no horizontal overflow at 360px.
 *
 * Usage: node scripts/layout-check.mjs   (WEB_BASE overrides the URL)
 */
import { chromium } from 'playwright-core'

const EXE =
  process.env.CHROME_PATH ||
  process.env.HOME +
    '/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell'
const BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++
    console.log('  ✓', name)
  } else {
    fail++
    console.log('  ✗', name, extra)
  }
}

const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: EXE })

async function probe(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  // Reveal everything so measurements are of the final layout.
  const H = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < H; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y)
    await page.waitForTimeout(50)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)

  const info = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el)
    const rect = (el) => el.getBoundingClientRect()
    const cols = (tpl) => tpl.split(' ').filter((t) => t && t !== 'none').length

    // Elements that widen the page (ignoring clipped decorations).
    const clipped = (el) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        if (getComputedStyle(n).overflowX !== 'visible') return true
      }
      return false
    }
    let widest = null
    const vw = document.documentElement.clientWidth
    document.querySelectorAll('body *').forEach((el) => {
      const r = rect(el)
      if (!r.width || cs(el).position === 'fixed' || clipped(el)) return
      const over = Math.round(r.right - vw)
      if (over > 1 && (!widest || over > widest.over)) {
        widest = { over, tag: el.tagName, cls: String(el.className).slice(0, 60) }
      }
    })

    const heroGrid = document.querySelector('main section .grid')
    const heroKids = heroGrid ? [...heroGrid.children].map(rect) : []
    const heroSplit =
      heroKids.length === 2 &&
      heroKids[1].left > heroKids[0].right - 1 &&
      heroKids[1].top < heroKids[0].bottom

    const statsGrid = document.querySelector('[aria-labelledby="stats-heading"] .grid')
    const svc = document.querySelector('#services')
    const cards = svc ? [...svc.children].map(rect) : []
    const rows = [...new Set(cards.map((r) => Math.round(r.top)))]

    // Pricing: the grid whose children are the three plan cards.
    const tierGrid = [...document.querySelectorAll('#pricing .grid')].find((g) => g.children.length === 3)
    const tiers = tierGrid ? [...tierGrid.children].map(rect) : []

    const faqGrid = document.querySelector('#faq .grid')
    const howSection = document.querySelector('#how')
    const stepLists = howSection ? howSection.querySelectorAll('ol') : []

    const footerGrid = document.querySelector('footer .grid')

    return {
      scrollW: document.documentElement.scrollWidth,
      clientW: vw,
      widest,
      heroCols: heroGrid ? cols(cs(heroGrid).gridTemplateColumns) : 0,
      heroSplit,
      statsCols: statsGrid ? cols(cs(statsGrid).gridTemplateColumns) : 0,
      cardCount: cards.length,
      bentoCols: svc ? cols(cs(svc).gridTemplateColumns) : 0,
      bentoRows: rows.length,
      rowTops: rows,
      widestCard: cards.length ? Math.max(...cards.map((r) => Math.round(r.width))) : 0,
      tierCols: tierGrid ? cols(cs(tierGrid).gridTemplateColumns) : 0,
      tierCount: tiers.length,
      tierTops: tiers.map((r) => Math.round(r.top)),
      tierBottoms: tiers.map((r) => Math.round(r.bottom)),
      faqCols: faqGrid ? cols(cs(faqGrid).gridTemplateColumns) : 0,
      faqKids: faqGrid ? faqGrid.children.length : 0,
      stepLists: stepLists.length,
      footerCols: footerGrid ? cols(cs(footerGrid).gridTemplateColumns) : 0,
      price4499: document.body.innerText.includes('₹4,499'),
      plusGst: document.body.innerText.includes('+ GST'),
      hamburger: (() => {
        const b = document.querySelector('header button[aria-controls="landing-mobile-drawer"]')
        return b ? cs(b).display !== 'none' : false
      })(),
      desktopNav: (() => {
        const n = document.querySelector('header nav')
        return n ? cs(n).display !== 'none' : false
      })(),
    }
  })

  await ctx.close()
  return info
}

/* ── 360px: smallest phone ─────────────────────────────────────────────── */
console.log('\n360px (mobile)')
{
  const m = await probe(360, 780)
  ok('no horizontal scroll', m.scrollW <= m.clientW, `${m.scrollW} > ${m.clientW}`)
  ok('no element widens the page', !m.widest, JSON.stringify(m.widest))
  ok('hero stacks in one column', m.heroCols === 1 && !m.heroSplit, `cols=${m.heroCols}`)
  ok('stats are two columns', m.statsCols === 2, `cols=${m.statsCols}`)
  ok('bento is one column', m.bentoCols === 1, `cols=${m.bentoCols}`)
  ok('all seven feature cards present', m.cardCount === 7, String(m.cardCount))
  ok('pricing stacks', m.tierCols === 1, `cols=${m.tierCols}`)
  ok('hamburger replaces desktop nav', m.hamburger && !m.desktopNav)
  ok('₹4,499 with + GST', m.price4499 && m.plusGst)
}

/* ── 768px: tablet ─────────────────────────────────────────────────────── */
console.log('\n768px (tablet)')
{
  const t = await probe(768, 1024)
  ok('no horizontal scroll', t.scrollW <= t.clientW, `${t.scrollW} > ${t.clientW}`)
  ok('bento is two columns', t.bentoCols === 2, `cols=${t.bentoCols}`)
  ok('pricing still stacks below lg', t.tierCols <= 2, `cols=${t.tierCols}`)
}

/* ── 1024px: lg boundary ───────────────────────────────────────────────── */
console.log('\n1024px (lg boundary)')
{
  const lg = await probe(1024, 900)
  ok('no horizontal scroll', lg.scrollW <= lg.clientW, `${lg.scrollW} > ${lg.clientW}`)
  ok('hero is a 12-col split', lg.heroCols === 12 && lg.heroSplit, `cols=${lg.heroCols} split=${lg.heroSplit}`)
  ok('stats are four columns', lg.statsCols === 4, `cols=${lg.statsCols}`)
  ok('bento is three columns', lg.bentoCols === 3, `cols=${lg.bentoCols}`)
  ok('pricing is three columns', lg.tierCols === 3, `cols=${lg.tierCols}`)
  ok('FAQ + CTA split is 12 columns', lg.faqCols === 12 && lg.faqKids === 2, `cols=${lg.faqCols} kids=${lg.faqKids}`)
  ok('desktop nav shown, no hamburger', lg.desktopNav && !lg.hamburger)
}

/* ── 1440px: full desktop ──────────────────────────────────────────────── */
console.log('\n1440px (desktop)')
{
  const d = await probe(1440, 1000)
  ok('no horizontal scroll', d.scrollW <= d.clientW, `${d.scrollW} > ${d.clientW}`)
  ok('hero is a 12-col split', d.heroCols === 12 && d.heroSplit, `cols=${d.heroCols} split=${d.heroSplit}`)
  ok('stats are four columns', d.statsCols === 4, `cols=${d.statsCols}`)
  ok('bento is three columns', d.bentoCols === 3, `cols=${d.bentoCols}`)
  ok('bento fills exactly three rows (no orphan cell)', d.bentoRows === 3, `rows=${d.bentoRows} tops=${JSON.stringify(d.rowTops)}`)
  ok('bento row 3 holds three cards', d.cardCount === 7 && d.bentoRows === 3)
  ok('some cards span two columns', d.widestCard > 0)
  ok('pricing is three columns', d.tierCols === 3 && d.tierCount === 3, `cols=${d.tierCols}`)
  ok('pricing cards share a row', new Set(d.tierTops).size === 1, JSON.stringify(d.tierTops))
  ok('pricing cards are equal height', new Set(d.tierBottoms).size === 1, JSON.stringify(d.tierBottoms))
  ok('FAQ stays a 7/5 split', d.faqCols === 12 && d.faqKids === 2, `cols=${d.faqCols}`)
  ok('footer is a multi-column grid', d.footerCols >= 4, `cols=${d.footerCols}`)
  ok('₹4,499 with + GST', d.price4499 && d.plusGst)
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
