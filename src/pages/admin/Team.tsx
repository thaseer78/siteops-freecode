import { useEffect, useState } from 'react'
import { ShieldCheck, Users } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ErrorState, PageHeader, SkeletonRows, useToast } from '../../components/ui'
import { formatDate } from '../../lib/format'

interface Staff { id: string; full_name: string; email: string; role: 'customer' | 'support' | 'admin' | 'super_admin'; status: string; created_at: string }

const roleCopy: Record<string, { label: string; body: string }> = {
  support: { label: 'Support staff', body: 'Read customer and audit data, add internal notes. No audit runs or email sends.' },
  admin: { label: 'Administrator', body: 'Run audits, deliver PDFs, suspend customers, view the activity log.' },
  super_admin: { label: 'Super admin', body: 'Everything, plus promoting staff and full platform control.' },
}

export default function AdminTeam() {
  const { user } = useAuth()
  const { push } = useToast()
  const [staff, setStaff] = useState<Staff[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const isSuper = user?.role === 'super_admin'

  const load = () => {
    setError(null)
    api.get<{ staff: Staff[] }>('/admin/staff').then((r) => setStaff(r.staff)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  async function changeRole(id: string, role: string) {
    setBusy(id)
    try {
      await api.patch(`/admin/staff/${id}/role`, { role })
      push({ kind: 'success', title: 'Role updated' })
      load()
    } catch (e) { push({ kind: 'error', title: 'Could not change role', body: (e as Error).message }) } finally { setBusy(null) }
  }

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Team & roles"
        subtitle="Access is enforced server-side: the role is read from the database on every request, never from the browser." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {Object.entries(roleCopy).map(([key, r]) => (
          <div key={key} className="card card-pad">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-900"><ShieldCheck size={14} className="text-mint-600" /> {r.label}</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">{r.body}</p>
          </div>
        ))}
      </div>

      {error && <div className="card"><ErrorState message={error} onRetry={load} /></div>}
      {!error && staff === null && <div className="card"><SkeletonRows rows={3} /></div>}
      {staff && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-900/[.07] px-5 py-4">
            <Users size={15} className="text-ink-500" /><h2 className="text-[14.5px] font-semibold text-ink-900">Staff accounts</h2>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[600px]">
              <thead><tr className="border-b border-ink-900/[.06]">
                <th className="table-head">Member</th><th className="table-head">Joined</th><th className="table-head">Status</th><th className="table-head">Role</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-900/[.05]">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FBFCFE]">
                    <td className="table-cell"><p className="font-medium text-ink-900">{s.full_name}{s.id === user?.id && <span className="ml-1.5 text-[11px] text-ink-500">(you)</span>}</p><p className="text-[11.5px] text-ink-500">{s.email}</p></td>
                    <td className="table-cell whitespace-nowrap text-ink-500">{formatDate(s.created_at)}</td>
                    <td className="table-cell"><span className={`chip ${s.status === 'active' ? 'bg-mint-50 text-mint-700' : 'bg-red-50 text-red-700'}`}>{s.status}</span></td>
                    <td className="table-cell">
                      {isSuper && s.id !== user?.id ? (
                        <select className="input py-1.5 text-[12.5px]" value={s.role} disabled={busy === s.id}
                          onChange={(e) => changeRole(s.id, e.target.value)} aria-label={`Role for ${s.full_name}`}>
                          <option value="support">Support staff</option>
                          <option value="admin">Administrator</option>
                          <option value="super_admin">Super admin</option>
                        </select>
                      ) : (
                        <span className="text-[12.5px] capitalize text-ink-700">{s.role.replace('_', ' ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-500">
        To create a staff account, register normally then promote the account here. Customers can never promote themselves:
        role changes are validated server-side and recorded in the activity log.
      </p>
    </div>
  )
}
