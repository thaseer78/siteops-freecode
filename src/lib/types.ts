export type Role = 'customer' | 'support' | 'admin' | 'super_admin'

export interface User {
  id: string
  email: string
  full_name: string
  company: string | null
  phone: string | null
  role: Role
  status: 'active' | 'suspended'
  email_verified: boolean
  notification_prefs: { email_reports?: boolean; email_audits?: boolean; push?: boolean }
  created_at: string
}

export type AuditStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Website {
  id: string
  user_id: string
  name: string
  url: string
  notes: string | null
  created_at: string
  updated_at: string
  latest_score?: number | null
  latest_at?: string | null
  latest_request_status?: AuditStatus | null
  audit_count?: number
}

export interface AuditRequest {
  id: string
  website_id: string
  user_id: string
  status: AuditStatus
  priority: 'low' | 'normal' | 'high'
  strategy: 'mobile' | 'desktop'
  customer_note: string | null
  error: string | null
  requested_at: string
  started_at: string | null
  completed_at: string | null
  website_name: string
  url: string
  report_id?: string | null
  overall?: number | null
  customer?: string
  email?: string
}

export interface Finding {
  id: string
  category: string
  title: string
  description: string
  displayValue: string
  score: number | null
  weight: number
  mode: string
  savingsMs: number | null
  savingsBytes: number | null
}

export interface Recommendation {
  title: string
  category: string
  detail: string
  impact: string
}

export interface Report {
  id: string
  audit_request_id: string
  website_id: string
  user_id: string
  url: string
  strategy: 'mobile' | 'desktop'
  performance: number | null
  seo: number | null
  accessibility: number | null
  best_practices: number | null
  overall: number | null
  findings: Finding[]
  recommendations: Recommendation[]
  metrics: Record<string, { label: string; value: string; score: number | null }>
  lighthouse_version: string | null
  fetched_at: string
  website_name: string
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

export interface EmailLog {
  id: string
  user_id: string | null
  report_id: string | null
  to_email: string
  kind: string
  subject: string
  status: 'sent' | 'failed' | 'not_configured'
  provider: string
  provider_id: string | null
  error: string | null
  sent_by: string | null
  created_at: string
  customer?: string
  report_url?: string
}

export interface DashboardData {
  websites: Website[]
  counts: { total: number; pending: number; completed: number; failed: number; websites: number }
  recentReports: Array<Report & { website_name: string }>
  notifications: Notification[]
  unread: number
  health: number | null
}

export interface AdminStats {
  customers: number
  websites: number
  audits: { total: number; pending: number; completed: number; failed: number }
  reports: number
  avgScore: number | null
  unreadMailFailures: number
  recentCustomers: Array<{ id: string; full_name: string; email: string; company: string | null; created_at: string; email_verified_at: string | null }>
  recentAudits: AuditRequest[]
}

export interface ApiError { error: string; code?: string }
