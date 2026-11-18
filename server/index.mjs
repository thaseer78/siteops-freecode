import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bootstrapAdmin, userFromRequest, isStaff } from './auth.mjs'
import { router as authRouter } from './routes/auth.mjs'
import { router as customerRouter } from './routes/customer.mjs'
import { router as adminRouter } from './routes/admin.mjs'


const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const API_PORT = Number(process.env.API_PORT || 8787)
const WEB_PORT = Number(process.env.PORT || 3000)
const DIST = path.join(ROOT, 'dist')

bootstrapAdmin()

export const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  next()
})
app.use(express.json({ limit: '256kb' }))
app.use(cookieParser())

/* Same-origin guard for state-changing requests (CSRF defence for cookie auth).
   Compares hostnames only, and honours the forwarded host set by a proxy/tunnel. */
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.get('origin') || req.get('referer')
  if (!origin) return next() // native mobile clients send no Origin
  try {
    const originHost = new URL(origin).hostname
    const hosts = new Set(
      [req.get('host'), req.get('x-forwarded-host')]
        .filter(Boolean)
        .map((h) => String(h).split(':')[0].toLowerCase()),
    )
    hosts.add('localhost')
    hosts.add('127.0.0.1')
    if (!hosts.has(originHost.toLowerCase())) {
      return res.status(403).json({ error: 'Request blocked: cross-origin request rejected.' })
    }
  } catch {
    return res.status(403).json({ error: 'Request blocked: invalid origin.' })
  }
  next()
})

/* Lightweight per-IP ceiling on the whole API. */
const ipHits = new Map()
app.use('/api', (req, res, next) => {
  const now = Date.now()
  const key = req.ip
  const e = ipHits.get(key)
  if (!e || e.reset < now) ipHits.set(key, { n: 1, reset: now + 60_000 })
  else if (++e.n > 400) return res.status(429).json({ error: 'Too many requests. Slow down.' })
  next()
})

app.use((req, _res, next) => {
  req.user = userFromRequest(req)
  next()
})

app.get('/api/health', (_req, res) => res.json({
  ok: true, service: 'siteops-api', time: new Date().toISOString(),
  pagespeed_key: !!process.env.PAGESPEED_API_KEY, email: !!process.env.RESEND_API_KEY,
  push: !!process.env.EXPO_ACCESS_TOKEN,
}))
app.use('/api/auth', authRouter)
app.use('/api', customerRouter)
app.use('/api/admin', adminRouter)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }))

app.use((err, _req, res, _next) => {
  console.error('[api error]', err)
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Something went wrong. Please try again.' })
})

/* Static web app (production build) or redirect to Vite in development. */
function serveSpa(req, res, next) {
  if (fs.existsSync(path.join(DIST, 'index.html'))) {
    if (req.path.startsWith('/assets/')) return res.sendFile(path.join(DIST, req.path))
    return res.sendFile(path.join(DIST, 'index.html'))
  }
  if (req.path === '/') return res.redirect(`http://localhost:${WEB_PORT}/`)
  res.status(404).send(`<!doctype html><body style="font-family:system-ui;padding:40px;line-height:1.6">
    <h2>SiteOps API is running</h2><p>The web app is served by Vite in development.</p>
    <p>Open <a href="http://localhost:${WEB_PORT}/">http://localhost:${WEB_PORT}/</a>, or run <code>npm run build</code> and restart to serve the built app from this port.</p></body>`)
}
app.use(serveSpa)

app.listen(API_PORT, '0.0.0.0', () => {
  console.log(`[siteops] API listening on http://0.0.0.0:${API_PORT}`)
  if (process.env.NODE_ENV === 'production' || process.env.SERVE_WEB === '1') {
    app.listen(WEB_PORT, '0.0.0.0', () => console.log(`[siteops] web on http://0.0.0.0:${WEB_PORT}`))
  }
})

process.on('SIGTERM', () => process.exit(0))
