import { PageHeader } from '../../components/layout/PageHeader'
import { KpiCard } from '../../components/ui/KpiCard'
import { Badge } from '../../components/ui/Badge'

const topics = [
  { name: 'تخلفات ساختمانی', count: 312 },
  { name: 'عوارض نوسازی', count: 248 },
  { name: 'مجوزهای ساختمانی', count: 190 },
  { name: 'پرونده‌های باز', count: 144 },
]

const models = [
  { name: 'OpenAI GPT-4o', status: 'آنلاین', load: '۴۲٪' },
  { name: 'Local Llama-3', status: 'آنلاین', load: '۶۸٪' },
  { name: 'آرشیو پاسخ', status: 'آنلاین', load: '۳۴٪' },
]

export function MgmtReportsPage() {
  return (
    <div>
      <PageHeader
        title="گزارش‌های مدیریتی"
        description="مصرف، نرخ صحت و درخواست‌ها در محدودهٔ شرکت و کاربران نهایی زیرمجموعه"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="میزان مصرف" value="۱۴٬۲۲۰" hint="توکن کاربران" />
        <KpiCard title="نرخ پاسخ صحیح" value="۹۳٪" />
        <KpiCard title="تعداد درخواست" value="۳٬۸۴۰" hint="ماه جاری" />
        <KpiCard title="کاربر نمونه 25" value="۱٬۲۱۰" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold">بیشترین موضوعات درخواست‌شده</h2>
          <ul className="space-y-3">
            {topics.map((t) => (
              <li key={t.name} className="flex items-center justify-between text-sm">
                <span>{t.name}</span>
                <span className="font-medium">{t.count.toLocaleString('fa-IR')}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex h-28 items-end gap-2">
            {topics.map((t) => (
              <div key={t.name} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-sky-500/80"
                  style={{ height: `${(t.count / 320) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold">وضعیت مدل‌ها</h2>
          <ul className="space-y-3">
            {models.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted">بار کاری {m.load}</p>
                </div>
                <Badge variant="success">{m.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
