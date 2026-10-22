import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { KpiCard } from '../../components/ui/KpiCard'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import {
  SOFTWARE_COMPANY_ROLE_ID,
} from '../../data/seed'

const LEVELS = [
  { value: 'all', label: 'همه سطوح' },
  { value: 'company', label: 'مالک شرکت نرم‌افزاری' },
  { value: 'support', label: 'پشتیبان' },
  { value: 'end_user', label: 'کاربر نهایی' },
]

export function SoftwareOwnerReportsPage() {
  const { users } = useAuth()
  const { softwares, memberships, tokenLedger } = useDomain()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('all')

  const rows = useMemo(() => {
    return softwares
      .map((sw) => {
        const mems = memberships.filter((m) => m.softwareId === sw.id)
        const companyOwner = users.find((u) => u.id === sw.ownerUserId)
        const endCount = mems.filter((m) => m.kind === 'end_user').length
        const supportCount = mems.filter((m) => m.kind === 'software_support').length
        const tokens = tokenLedger
          .filter((t) => t.softwareId === sw.id)
          .reduce((s, t) => s + (t.type === 'charge' ? t.amount : 0), 0)
        return {
          id: sw.id,
          name: sw.name,
          code: sw.code,
          companyName: companyOwner?.organizationName || companyOwner?.name || '—',
          companyOwnerId: sw.ownerUserId,
          endCount,
          supportCount,
          tokens,
        }
      })
      .filter((r) => {
        if (level === 'company') {
          const isCompany = users.some(
            (u) =>
              u.id === r.companyOwnerId && u.roleIds.includes(SOFTWARE_COMPANY_ROLE_ID),
          )
          if (!isCompany) return false
        }
        if (level === 'end_user' && r.endCount === 0) return false
        if (level === 'support' && r.supportCount === 0) return false
        const hay = `${r.name} ${r.code} ${r.companyName}`.toLowerCase()
        return !q.trim() || hay.includes(q.trim().toLowerCase())
      })
  }, [softwares, memberships, users, tokenLedger, q, level])

  return (
    <div>
      <PageHeader
        title="گزارش پیشرفته بین‌سطحی"
        description="جستجو و نمای تجمیعی در سطح شرکت‌ها، پشتیبان‌ها و کاربران نهایی زیر مالک نرم‌افزار"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="نرم‌افزارها" value={String(rows.length)} />
        <KpiCard
          title="کاربران نهایی"
          value={String(rows.reduce((s, r) => s + r.endCount, 0))}
        />
        <KpiCard
          title="پشتیبان‌ها"
          value={String(rows.reduce((s, r) => s + r.supportCount, 0))}
        />
        <KpiCard
          title="شارژ ثبت‌شده"
          value={rows.reduce((s, r) => s + r.tokens, 0).toLocaleString('fa-IR')}
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Input
          label="جستجو"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="نام نرم‌افزار، کد، شرکت…"
        />
        <Select
          label="فیلتر سطح"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          options={LEVELS}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-panel">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-primary-soft/40 text-muted">
            <tr>
              <th className="px-4 py-3 text-right font-medium">نرم‌افزار</th>
              <th className="px-4 py-3 text-right font-medium">شرکت</th>
              <th className="px-4 py-3 text-right font-medium">پشتیبان</th>
              <th className="px-4 py-3 text-right font-medium">کاربر نهایی</th>
              <th className="px-4 py-3 text-right font-medium">شارژ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-heading">{r.name}</div>
                  <div className="text-xs text-muted">{r.code}</div>
                </td>
                <td className="px-4 py-3">{r.companyName}</td>
                <td className="px-4 py-3">{r.supportCount.toLocaleString('fa-IR')}</td>
                <td className="px-4 py-3">{r.endCount.toLocaleString('fa-IR')}</td>
                <td className="px-4 py-3">{r.tokens.toLocaleString('fa-IR')}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  نتیجه‌ای یافت نشد.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
