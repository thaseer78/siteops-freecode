#!/usr/bin/env node
/**
 * Single development entry point.
 * Starts the API and the Vite dev server in ONE process tree so the preview
 * supervisor can restart both together. Browser talks to Vite on $PORT; Vite
 * proxies /api to the API, so cookies stay first-party on one origin.
 */
import { spawn } from 'node:child_process'

const apiPort = process.env.API_PORT || '8787'
const webPort = process.env.PORT || '3000'

const children = []
let shuttingDown = false

function start(cmd, args, name, env = {}) {
  const child = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
  children.push(child)
  const pipe = (stream, out) => stream.setEncoding('utf8').on('data', (d) => {
    for (const line of d.split('\n')) if (line.trim()) out.write(`[${name}] ${line}\n`)
  })
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    if (shuttingDown) return
    console.error(`[${name}] exited with code ${code} — shutting down`)
    shutdown(code ?? 1)
  })
  return child
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) { try { c.kill('SIGTERM') } catch { /* already gone */ } }
  setTimeout(() => process.exit(code), 400)
}

process.on('SIGTERM', () => shutdown(0))
process.on('SIGINT', () => shutdown(0))

start(process.execPath, ['server/index.mjs'], 'api', { API_PORT: apiPort })
start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', webPort], 'web')
