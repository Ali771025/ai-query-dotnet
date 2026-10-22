import { Activity, CheckCircle2, Cpu, Coins } from 'lucide-react'
import { KpiCard } from '../../components/ui/KpiCard'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'

const recentTopics = [
  { topic: 'تخلفات ساختمانی', count: 842 },
  { topic: 'عوارض نوسازی', count: 611 },
  { topic: 'مجوزهای ساختمانی', count: 390 },
  { topic: 'گزارش مالی منطقه', count: 278 },
]

const modelStatus = [
  { name: 'OpenAI GPT-4o', status: 'online' as const },
  { name: 'Local Llama-3', status: 'online' as const },
  { name: 'آرشیو پاسخ', status: 'online' as const },
]

export function OwnerDashboardPage() {
  return (
    <div>
      <PageHeader
        title="داشبورد مالک سامانه"
        description="نمای کلی مصرف، دقت پاسخ و وضعیت مدل‌ها"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="مصرف توکن"
          value="۳۸۶٬۲۰۰"
          hint="۳۰ روز اخیر"
          trend="+۱۲٪"
          icon={<Coins className="size-5" />}
        />
        <KpiCard
          title="نرخ پاسخ صحیح"
          value="۹۱٪"
          hint="بر اساس امتیاز مدیران"
          trend="+۳٪"
          icon={<CheckCircle2 className="size-5" />}
        />
        <KpiCard
          title="تعداد درخواست"
          value="۱۲٬۴۸۰"
          hint="تمام نرم‌افزارها"
          icon={<Activity className="size-5" />}
        />
        <KpiCard
          title="وضعیت مدل‌ها"
          value="۳ / ۳"
          hint="همه در دسترس"
          icon={<Cpu className="size-5" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold text-heading">بیشترین موضوعات درخواست</h2>
          <ul className="space-y-3">
            {recentTopics.map((item) => (
              <li key={item.topic} className="flex items-center justify-between text-sm">
                <span className="text-ink">{item.topic}</span>
                <span className="font-medium text-heading">{item.count.toLocaleString('fa-IR')}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold text-heading">وضعیت مدل‌ها</h2>
          <ul className="space-y-3">
            {modelStatus.map((m) => (
              <li key={m.name} className="flex items-center justify-between text-sm">
                <span className="text-ink">{m.name}</span>
                <Badge variant="success">آنلاین</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-5 h-32 rounded-lg bg-gradient-to-l from-primary-50 to-slate-50 p-4 text-xs text-muted">
            نمودار مصرف ۳۰ روز — placeholder
          </div>
        </div>
      </div>
    </div>
  )
}
