import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Select } from '../../components/ui/Select'
import { KpiCard } from '../../components/ui/KpiCard'
import { Badge } from '../../components/ui/Badge'

export function ReportsPerformancePage() {
  const [range, setRange] = useState('30')

  return (
    <div>
      <PageHeader
        title="گزارش عملکرد"
        description="متریک‌های عملکرد سامانه در بازه زمانی انتخابی"
      />

      <div className="mb-6 max-w-xs">
        <Select
          label="بازه زمانی"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          options={[
            { value: '7', label: '۷ روز اخیر' },
            { value: '30', label: '۳۰ روز اخیر' },
            { value: '90', label: '۹۰ روز اخیر' },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="میانگین تأخیر" value="۱٫۲ ثانیه" />
        <KpiCard title="نرخ موفقیت" value="۹۶٪" />
        <KpiCard title="Failover مدل" value="۱۸" hint="سوئیچ خودکار" />
        <KpiCard title="کاربر نمونه 25" value="۴٬۲۴۰" />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-primary-soft text-muted">
            <tr>
              <th className="px-4 py-3 text-right font-medium">متریک</th>
              <th className="px-4 py-3 text-right font-medium">مقدار</th>
              <th className="px-4 py-3 text-right font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {[
              { metric: 'Uptime API', value: '۹۹٫۸٪', ok: true },
              { metric: 'متوسط توکن/درخواست', value: '۳۱', ok: true },
              { metric: 'رد امنیتی', value: '۴۲', ok: false },
            ].map((row) => (
              <tr key={row.metric} className="border-t border-border">
                <td className="px-4 py-3">{row.metric}</td>
                <td className="px-4 py-3">{row.value}</td>
                <td className="px-4 py-3">
                  <Badge variant={row.ok ? 'success' : 'warning'}>
                    {row.ok ? 'مطلوب' : 'نیاز به بررسی'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-4 py-2 text-xs text-muted">
          بازه انتخابی: {range} روز
        </p>
      </div>
    </div>
  )
}
