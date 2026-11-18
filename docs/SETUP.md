# SiteOps — Setup

## 1. Run locally (zero external credentials)

```bash
npm install
npm run dev        # web on http://localhost:3000, API on :8787
```

`npm run dev` starts **both** the API and the Vite dev server in one supervised process
(`scripts/dev.mjs`), and Vite proxies `/api` to the API so cookies stay first-party.

On first boot the server creates the database (`data/siteops.db`) and one operator account.
The generated password is printed to `data/admin-credentials.txt` — sign in at
`/admin/login`, change the password, then delete that file.

```bash
ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a-strong-password-1' npm run dev
```

Verify everything works:

```bash
node scripts/smoke-test.mjs      # API: auth, isolation, RBAC, PDF, email status
node scripts/ui-test.mjs         # browser walk-through (needs playwright-core + chromium)
```

## 2. Environment

Copy `.env.example` → `.env`. Nothing is required to boot; integrations degrade honestly.

| Variable | Effect when missing |
|---|---|
| `PAGESPEED_API_KEY` | PageSpeed works keyless with a small shared quota. Exhausted quota ⇒ audit marked **failed** with Google's exact message. No scores are invented. |
| `RESEND_API_KEY`, `MAIL_FROM` | Emails are recorded as `not_configured` (never "sent"). In development the verification/reset link is also returned in the UI so you can still test the flow. |
| `EXPO_ACCESS_TOKEN` | Push notifications are skipped; in-app notifications still work. |
| `SESSION_SECRET` | A random 32-byte secret is generated once into `data/keys.json`. |
| `APP_URL` | Falls back to the request host, so links always match the origin you are using. |

**Preview note:** the workspace sleeps when idle. Web servers, audit workers and email
sends only run while it is awake — this is not always-on hosting.

## 3. Integrations

**Google PageSpeed Insights** — <https://console.cloud.google.com/apis/credentials> →
enable "PageSpeed Insights API" → create an API key → set `PAGESPEED_API_KEY`.
Every score in a report is taken from that API for the given URL and strategy.

**Resend email** — create an account at <https://resend.com>, verify a sending domain,
create an API key, set `RESEND_API_KEY` and `MAIL_FROM="SiteOps <reports@yourdomain.com>"`.
Report delivery is always initiated manually by an admin, and the provider response is logged.

## 4. Structure

```
server/          API: auth, RBAC, audits, PDF, email, notifications
src/             React web app (customer portal + /admin console)
supabase/        Production Postgres schema, RLS policies, Edge Functions
mobile/          Expo React Native app (same API, same accounts)
docs/            setup, security, deployment, testing
```

## 5. Accounts & roles

Register normally to get a `customer`. Roles live in the database and are re-read on every
request: `customer` → `support` → `admin` → `super_admin`. Only a `super_admin` can change
another user's role, and nobody can change their own. Customers can never self-promote.
