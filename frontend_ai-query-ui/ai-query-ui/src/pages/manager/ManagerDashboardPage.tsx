import { Activity, CheckCircle2, Coins, Radar } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { KpiCard } from '../../components/ui/KpiCard'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { requestMonitor } from '../../data/mock/software'
import type { RequestMonitorItem } from '../../types/software'

export function ManagerDashboardPage() {
  const columns: Column<RequestMonitorItem>[] = [
    { key: 'time', header: 'زمان', render: (r) => r.timestamp },
    { key: 'user', header: 'کاربر', render: (r) => r.user },
    { key: 'topic', header: 'موضوع', render: (r) => r.topic },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => (
        <Badge
          variant={
            r.status === 'success' ? 'success' : r.status === 'cached' ? 'info' : 'danger'
          }
        >
          {r.status === 'success' ? 'موفق' : r.status === 'cached' ? 'کش' : 'ناموفق'}
        </Badge>
      ),
    },
    { key: 'latency', header: 'تأخیر', render: (r) => `${r.latencyMs} ms` },
  ]

  return (
    <div>
      <PageHeader
        title="داشبورد مدیر نرم‌افزار"
        description="نمای کلی نرم‌افزار نمونه و درخواست‌های اخیر"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="درخواست امروز" value="۱۸۴" icon={<Activity className="size-5" />} />
        <KpiCard title="نرخ صحت" value="۹۳٪" icon={<CheckCircle2 className="size-5" />} />
        <KpiCard title="مصرف توکن کاربران" value="۱۴٬۲۲۰" icon={<Coins className="size-5" />} />
        <KpiCard title="درخواست فعال" value="۳" icon={<Radar className="size-5" />} />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-heading">درخواست‌های اخیر</h2>
        <DataTable
          rows={requestMonitor}
          columns={columns}
          rowKey={(r) => r.id}
          searchPlaceholder="جستجوی کاربر یا موضوع..."
          searchFn={(row, q) => [row.user, row.topic].some((v) => v.includes(q))}
          filters={[
            {
              key: 'user',
              label: 'کاربر',
              type: 'text',
              placeholder: 'نام کاربر...',
              className: 'min-w-36 flex-1',
              filterFn: (row, value) => row.user.includes(value),
            },
            {
              key: 'topic',
              label: 'موضوع',
              type: 'text',
              placeholder: 'موضوع...',
              className: 'min-w-36 flex-1',
              filterFn: (row, value) => row.topic.includes(value),
            },
            {
              key: 'status',
              label: 'وضعیت',
              type: 'select',
              className: 'w-36',
              options: [
                { value: 'all', label: 'همه' },
                { value: 'success', label: 'موفق' },
                { value: 'cached', label: 'کش' },
                { value: 'failed', label: 'ناموفق' },
              ],
              filterFn: (row, value) => row.status === value,
            },
          ]}
          pageSize={4}
        />
      </div>
    </div>
  )
}
