# Project notes

SiteOps — website operations platform (India-first). See `ARCHITECTURE.md` and `docs/SETUP.md`.

## Things to remember
- **One dev command:** `npm run dev` → `scripts/dev.mjs` starts API (`server/index.mjs`, port 8787)
  *and* Vite on `$PORT`(3000) in one supervised tree. Vite proxies `/api` → 8787. Do not run the
  API as a detached background process: the preview supervisor only owns one tree, so a detached
  API dies on restart and the site appears "broken".
- **Never hardcode link origins.** `server/routes/auth.mjs` uses `appOrigin(req)`; building links from
  `localhost` while the browser is on `127.0.0.1` breaks the session cookie and looks like a login bug.
- Data layer is `node:sqlite` (`server/db.mjs`) for zero-setup runs; the production Postgres schema +
  RLS lives in `supabase/migrations`. Keep the two in sync when columns change.
- Cookie auth: mutating `/api` requests are origin-checked; mobile clients send no Origin and pass.
- Roles are re-read from the DB per request (`requireRole`). Never trust a role in the token or client.
- Audits must stay truthful: scores only from PageSpeed Insights. Provider failures set status
  `failed` with the real message. Email status is `sent | failed | not_configured`.
- PDF: footer writes temporarily zero the bottom margin, otherwise PDFKit emits blank pages.
- Verification tokens are single-use — guard React effects with a ref (dev StrictMode double-invokes).
- QA: `node scripts/smoke-test.mjs` (API) and `node scripts/ui-test.mjs` (Playwright). Both should pass
  before claiming a change works. `scripts/qa-pdf-fixture.mjs` renders a PDF in a throwaway DB.

## Visual system (Obsidian / Alabaster / Electric Violet)
- Tokens live in `tailwind.config.js` + `src/index.css`. The `ink` scale and the `surface*/line/page`
  colours are CSS variables (`--ink-900`, `--surface`, …) flipped by `data-theme` on a shell root.
  That is why untouched pages adopted dark mode without edits: sets `data-theme="dark"` on
  `CustomerShell` + `AuthLayout`, and `data-theme="light"` on `AdminShell` and the report container.
  Do not hardcode `bg-white`/`text-ink-900` in a shell — it will not adapt.
- Palettes: violet `#7C3AED` (hover `#6D28D9`), lavender `#C084FC`/`#A855F7`, tint `#F3E8FF`,
  dark `#0D0C11` / elevated `#16151D` / hairline `#262432`, light `#FAFAFC` / border `#EAE8F2`.
  Status: emerald `#10B981`, amber `#F59E0B`, rose `#EF4444`. Font: Plus Jakarta Sans, `tabular-nums`.
- `bg-*/50` light tints would go invisible on dark shells, so `index.css` remaps the status tints
  inside `[data-theme='dark']`. Add new light-tint utilities there if you use them.
- Tailwind config lives outside Vite's HMR graph: restart `npm run dev` after editing it, or Vite
  serves a stale stylesheet and reports "class does not exist".
- Growth plan price is `₹4,499` (the visual spec overrides the older `₹2,499`). `ui-test.mjs` asserts it.
- Visual regression: `scripts/design-check.mjs` (landing sections, computed colours), `app-check.mjs`
  (auth/customer dark/admin light shells), `report-check.mjs` (report view; needs the fixture DB on
  :3001 + API :8788). These assert computed styles, not screenshots, so they do not need image diffs.
- Layout regression: `scripts/layout-check.mjs` probes the landing page at 320/375/768/1024/1280 and
  asserts real geometry — grid column counts from `grid-template-columns`, the 7-card Advantage grid
  closing on an even bottom edge, pricing tiers sharing a row, and no element escaping a clipping
  ancestor into a horizontal scrollbar. `scripts/landing-behaviour-check.mjs` guards the FAQ
  accordion state and CTA/nav hrefs. Run both after touching `Landing.tsx` layout classes.
- Landing layout conventions: the page wrapper is `overflow-x-hidden`; hero is `lg:grid-cols-2`; the
  Advantage grid is a single 7-card `sm:grid-cols-2` grid where the last card is `sm:col-span-2`; the
  step row is `lg:grid-cols-4`, badges `md:grid-cols-3`, pricing `lg:grid-cols-3 items-stretch`
  (Growth is lifted by `lg:-mt-3`, so compare card bottoms, not tops), FAQ/CTA `lg:grid-cols-12`
  with a 7/5 split. Decorative glows may overhang the viewport — they are clipped by their own
  `overflow-hidden` section and must not be "fixed" by widening the page.
