import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiRequestError, api } from './api'
import type { User } from './types'

interface AuthState {
  user: User | null
  loading: boolean
  refresh: () => Promise<User | null>
  login: (email: string, password: string) => Promise<User>
  adminLogin: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  setUser: (u: User | null) => void
}

const AuthContext = createContext<AuthState | null>(null)
const isStaff = (u: User | null) => !!u && ['support', 'admin', 'super_admin'].includes(u.role)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: User | null }>('/auth/me')
      setUser(res.user)
      return res.user
    } catch (err) {
      // Only an explicit 401 means signed out. Network or throttling errors must not
      // silently log a customer out mid-session.
      if ((err as ApiRequestError).status === 401) setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User }>('/auth/login', { email, password })
    setUser(res.user)
    return res.user
  }

  const adminLogin = async (email: string, password: string) => {
    const res = await api.post<{ user: User }>('/auth/admin/login', { email, password })
    if (!isStaff(res.user)) throw new ApiRequestError('This account does not have administrator access.', 403)
    setUser(res.user)
    return res.user
  }

  const logout = async () => {
    try { await api.post('/auth/logout') } finally { setUser(null) }
  }

  const value = useMemo(
    () => ({ user, loading, refresh, login, adminLogin, logout, setUser }),
    [user, loading, refresh],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export { isStaff }
