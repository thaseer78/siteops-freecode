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
