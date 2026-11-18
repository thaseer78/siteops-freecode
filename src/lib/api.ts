const BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api'

export class ApiRequestError extends Error {
  status: number
  code?: string
  payload: unknown
  constructor(message: string, status: number, payload?: unknown, code?: string) {
    super(message)
    this.status = status
    this.payload = payload
    this.code = code
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiRequestError('Cannot reach the SiteOps API. Check your connection and try again.', 0)
  }
  const ct = res.headers.get('content-type') || ''
  const payload = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text()
  if (!res.ok) {
    const message = (payload as { error?: string })?.error || defaultMessage(res.status)
    throw new ApiRequestError(message, res.status, payload, (payload as { code?: string })?.code)
  }
  return payload as T
}

function defaultMessage(status: number) {
  if (status === 401) return 'Please sign in to continue.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'We could not find what you were looking for.'
  if (status === 429) return 'Too many attempts. Please wait a minute.'
  return 'Something went wrong. Please try again.'
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b ?? {}),
  del: <T>(p: string) => request<T>('DELETE', p),
}

export async function downloadFile(path: string, filename: string) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' })
  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    throw new ApiRequestError(payload?.error || 'Download failed.', res.status, payload)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
