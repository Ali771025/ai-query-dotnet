import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Select } from '../../components/ui/Select'
import { KpiCard } from '../../components/ui/KpiCard'
import { useAuth } from '../../context/AuthContext'
import { SOFTWARE_COMPANY_ROLE_ID, SOFTWARE_OWNER_ROLE_ID } from '../../data/seed'

export function ReportsStatisticsPage() {
  const { users } = useAuth()
  const orgUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.roleIds.includes(SOFTWARE_COMPANY_ROLE_ID) ||
          u.roleIds.includes(SOFTWARE_OWNER_ROLE_ID),
      ),
    [users],
  )
  const [entity, setEntity] = useState('all')

  return (
    <div>
      <PageHeader
        title="گزارش‌های آماری"
        description="آمار مصرف و درخواست‌ها با فیلتر بر اساس موجودیت"
      />

      <div className="mb-6 max-w-xs">
        <Select
          label="فیلتر موجودیت"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          options={[
            { value: 'all', label: 'همه موجودیت‌ها' },
            ...orgUsers.map((u) => ({ value: u.id, label: u.name })),
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard title="درخواست‌ها" value="۱۲٬۴۸۰" hint={entity === 'all' ? 'کل سامانه' : 'فیلترشده'} />
        <KpiCard title="میانگین روزانه" value="۴۱۶" />
        <KpiCard title="نرخ کش" value="۳۴٪" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="flex h-56 items-end gap-2 rounded-xl border border-border bg-panel p-5">
          {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t bg-primary-500/80" style={{ height: `${h}%` }} />
              <span className="text-[10px] text-muted">{i + 1}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="mb-3 text-sm font-semibold">توزیع موضوعی</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between"><span>تخلفات</span><span>۳۲٪</span></li>
            <li className="flex justify-between"><span>مالی</span><span>۲۸٪</span></li>
            <li className="flex justify-between"><span>مجوزها</span><span>۲۲٪</span></li>
            <li className="flex justify-between"><span>سایر</span><span>۱۸٪</span></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
