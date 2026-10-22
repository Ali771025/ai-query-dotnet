import { useMemo } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { KpiCard } from '../../components/ui/KpiCard'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'

export function MyApiKeyReportsPage() {
  const { user, activeSoftwareId } = useAuth()
  const { apiKeys, tokenLedger, softwares } = useDomain()

  const keys = useMemo(() => {
    if (!user) return []
    return apiKeys.filter(
      (k) =>
        (k.userId === user.id || k.createdByTenantUserId === user.id) &&
        (!activeSoftwareId || k.softwareId === activeSoftwareId),
    )
  }, [apiKeys, user, activeSoftwareId])

  const rows = useMemo(() => {
    return keys.map((k) => {
      const sw = softwares.find((s) => s.id === k.softwareId)
      const ledger = tokenLedger.filter((t) => t.apiKeyId === k.id)
      const charged = Math.max(
        k.allocatedTokens,
        ledger
          .filter((t) => t.type === 'charge' || t.type === 'allocate')
          .reduce((s, t) => s + t.amount, 0),
      )
      const consumed = ledger
        .filter((t) => t.type === 'consume')
        .reduce((s, t) => s + Math.abs(t.amount), 0)
      return {
        id: k.id,
        name: k.keyMasked || k.id,
        softwareName: sw?.name ?? '—',
        status: k.status,
        charged,
        consumed,
        remaining: Math.max(0, charged - consumed),
        calls: ledger.filter((t) => t.type === 'consume').length,
      }
    })
  }, [keys, softwares, tokenLedger])

  const totals = useMemo(
    () => ({
      keys: rows.length,
      charged: rows.reduce((s, r) => s + r.charged, 0),
      consumed: rows.reduce((s, r) => s + r.consumed, 0),
      calls: rows.reduce((s, r) => s + r.calls, 0),
    }),
    [rows],
  )

  return (
    <div>
      <PageHeader
        title="گزارش API Key"
        description="مصرف و شارژ کلیدهای API سازمان شما"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="کلیدها" value={String(totals.keys)} />
        <KpiCard title="شارژ تخصیص‌یافته" value={totals.charged.toLocaleString('fa-IR')} />
        <KpiCard title="مصرف" value={totals.consumed.toLocaleString('fa-IR')} />
        <KpiCard title="فراخوانی‌ها" value={totals.calls.toLocaleString('fa-IR')} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-panel">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-primary-soft/40 text-muted">
            <tr>
              <th className="px-4 py-3 text-right font-medium">کلید</th>
              <th className="px-4 py-3 text-right font-medium">نرم‌افزار</th>
              <th className="px-4 py-3 text-right font-medium">وضعیت</th>
              <th className="px-4 py-3 text-right font-medium">شارژ</th>
              <th className="px-4 py-3 text-right font-medium">مصرف</th>
              <th className="px-4 py-3 text-right font-medium">مانده</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-heading">{r.name}</td>
                <td className="px-4 py-3">{r.softwareName}</td>
                <td className="px-4 py-3">
                  <Badge variant={r.status === 'active' ? 'success' : 'default'}>
                    {r.status === 'active' ? 'فعال' : r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">{r.charged.toLocaleString('fa-IR')}</td>
                <td className="px-4 py-3">{r.consumed.toLocaleString('fa-IR')}</td>
                <td className="px-4 py-3">{r.remaining.toLocaleString('fa-IR')}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  هنوز API Keyای برای گزارش نیست.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
