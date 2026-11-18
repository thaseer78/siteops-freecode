# SiteOps — Architecture

**Tagline:** From AI-built to business-ready.

SiteOps is an India-first website operations platform: customers register sites, request audits,
and receive professional reports; SiteOps operators run real audits, deliver PDFs and manage accounts.

## 1. System overview

```
Customer Web (React/Vite)      Admin Web (/admin, same SPA build, separate shell)
          │                              │
          └────────── REST /api ─────────┘
                         │
             Node API (Express, TypeScript-checked JS)
             ├── auth + sessions (httpOnly cookie, DB-backed)
             ├── RBAC (role read from DB on every request)
             ├── audit engine → Google PageSpeed Insights API (real data)
             ├── PDF reports → PDFKit
             ├── email → Resend API (PDF attachment), logged + retryable
             └── data layer
                  ├── local: SQLite (node:sqlite) — zero-setup dev/preview
                  └── production: Supabase Postgres + RLS + Edge Functions (supabase/)

Customer Mobile (Expo + React Native + TS) ── REST /api (same accounts & data)
```

### Why the data-layer adapter
The repo runs end-to-end on a fresh VM with no external credentials: SQLite implements the exact
Postgres schema in `supabase/migrations`. `supabase/` holds the production Supabase schema, RLS
policies and Edge Functions. Swapping is a repository-layer change; the API contract is identical.

## 2. Folder structure

```
/                      web app + API (one deployable)
  server/
    index.mjs          app assembly, security headers, static serving
    db.mjs             schema, migrations, seed, query helpers
    auth.mjs           password hashing, sessions, RBAC, rate limiting
    audit.mjs          PageSpeed Insights integration + findings
    pdf.mjs            branded report PDF
    mail.mjs           Resend transactional email + email_logs
    notify.mjs         in-app notifications / activity log
    routes/            auth, customer, admin
  src/
    main.tsx, App.tsx  router, providers
    lib/               api client, auth context, types, formatting
    components/ui/     design system (buttons, cards, tables, modals, score rings)
    components/layout/ customer + admin shells, marketing nav
    pages/             public, auth, customer, admin
  supabase/
    migrations/        Postgres schema + RLS (production)
    functions/         run-audit, send-report, send-notification (Deno edge functions)
  mobile/              Expo app: onboarding, auth, 5-tab app, push tokens
  docs/                setup, deployment, testing, security
  data/                SQLite database (git-ignored)
```

## 3. Database schema

| Table | Key columns | Relationships |
|---|---|---|
| users | id, email UNIQUE, password_hash, full_name, role, email_verified_at, status | 1‑n websites, notifications, sessions |
| sessions | id, user_id, token_hash, expires_at, ip, user_agent | → users |
| email_tokens | id, user_id, kind(verify/reset), token_hash, expires_at, used_at | → users |
| websites | id, user_id, name, url, created_at | → users; 1‑n audits |
| audit_requests | id, website_id, user_id, status(pending/running/completed/failed), priority, note, timestamps, error | → websites, users |
| audit_reports | id, audit_request_id UNIQUE, website_id, user_id, 4 category scores, overall, strategy, findings_json, metrics_json, raw_json | → audit_requests |
| notifications | id, user_id, type, title, body, link, read_at | → users |
| email_logs | id, to_email, kind, subject, status(sent/failed/not_configured), provider, error, report_id | → audit_reports |
| activity_logs | id, actor_id, action, entity, entity_id, meta_json | → users |
| admin_notes | id, audit_request_id, author_id, body | internal only |
| push_tokens | id, user_id, token, platform | → users |
| settings | key, value | branding/config |

Indexes on every FK, `audit_requests(status, requested_at)`, `notifications(user_id, read_at)`,
`email_logs(created_at)`. Constraints: CHECK on status/role/kind, UNIQUE email + report-per-request.

## 4. Auth & authorization

- **Passwords:** scrypt + per-user salt, constant-time compare, min 10 chars.
- **Sessions:** 32-byte random token; only SHA-256 hash stored; `HttpOnly`, `SameSite=Lax`, `Secure`
  in production; 7-day server-side expiry; revocable logout; session listing not exposed.
- **Email verification:** one-time hashed token (24 h). Development shows the link only when
  email delivery is not configured; production never returns it.
- **RBAC:** `role ∈ customer | support | admin | super_admin` lives in `users` (never in the token
  payload or frontend state). Middleware re-reads the role from the DB on every request.
  - support: read customers/audits, notes, cannot manage admins.
  - admin: + run audits, send reports, suspend customers.
  - super_admin: + promote/demote users, platform settings.
- **Customer isolation:** every customer query is scoped by `user_id` from the server session.
  Postgres RLS mirrors this (`auth.uid() = user_id`) with admin policies via a `is_admin()` helper.
- **CSRF/origin:** same-origin check on mutating requests; no wildcard CORS.
- **Rate limits:** login/register/forgot (10/min/IP), audit runs (6/min/user), email sends (10/min/admin).
- **Input validation:** URL must be http(s) + host; lengths capped; all SQL parameterised.
- **Audit truthfulness:** scores come only from PageSpeed Insights. "Security monitoring" is never
  claimed; the UI states what was and was not measured.

## 5. API surface (abridged)

```
POST /api/auth/register|login|logout|verify-email|resend-verification
     /api/auth/forgot-password|reset-password|change-password
GET  /api/auth/me          PATCH /api/auth/profile      GET/PATCH /api/auth/preferences
GET  /api/customer/dashboard
CRUD /api/websites         POST /api/websites/:id/audits
GET  /api/audits  /api/audits/:id        GET /api/reports/:id  /api/reports/:id/pdf
GET  /api/notifications    POST /api/notifications/:id/read | /read-all
POST /api/admin/login (alias of auth login, role-gated)
GET  /api/admin/stats|customers|audits|email-logs|activity
PATCH /api/admin/customers/:id          POST /api/admin/audits/:id/run|notes
POST /api/admin/audits/:id/send-report  POST /api/admin/email-logs/:id/retry
PATCH /api/admin/audits/:id/status
```

## 6. Milestones (all delivered in this build)

1. Foundation: schema, API, auth/session/RBAC, seed operator account.
2. Real audit engine (PSI) + findings + PDF + email pipeline with delivery log.
3. Customer web app: landing, auth, dashboard, websites, audit flow, reports, notifications, profile.
4. Admin web app: `/admin/login`, dashboard, audit operations, customer management, email ops,
   activity log, role-aware actions.
5. Expo mobile app sharing the same API.
6. QA sweep: authz isolation, validation, PDF/email, responsive, loading/error states.
7. Docs, env templates, Supabase production schema + edge functions, deployment checklists.

## 7. External services

| Service | Env vars | Needed for |
|---|---|---|
| Google PageSpeed Insights | `PAGESPEED_API_KEY` (optional; keyless quota works) | real audit scores |
| Resend | `RESEND_API_KEY`, `MAIL_FROM` | verification/reset/report emails |
| Expo push (EAS) | `EXPO_ACCESS_TOKEN` | mobile push notifications |
| Supabase (prod path) | `SUPABASE_URL`, anon+service keys, JWT secret | managed Postgres/auth/storage |

Without these the product stays honest: audits fail with the provider's real error, emails are
recorded as `not_configured`, push is skipped. No fake success states.
