import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { securityLogs } from '../../data/mock/managers'
import type { SecurityLog } from '../../types/manager'

const severityVariant = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
} as const

const severityLabel = {
  low: 'کم',
  medium: 'متوسط',
  high: 'بالا',
  critical: 'بحرانی',
}

export function SecurityLogsPage() {
  const columns: Column<SecurityLog>[] = [
    { key: 'time', header: 'زمان', render: (r) => r.timestamp },
    { key: 'event', header: 'رویداد', render: (r) => r.event },
    {
      key: 'severity',
      header: 'شدت',
      render: (r) => (
        <Badge variant={severityVariant[r.severity]}>{severityLabel[r.severity]}</Badge>
      ),
    },
    { key: 'ip', header: 'IP', render: (r) => r.ip },
    { key: 'actor', header: 'عامل', render: (r) => r.actor },
    { key: 'detail', header: 'جزئیات', render: (r) => r.detail },
  ]

  return (
    <div>
      <PageHeader title="لاگ‌های امنیتی" description="رویدادهای امنیتی قابل فیلتر بر اساس شدت و عامل" />
      <DataTable
        rows={securityLogs}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجو در رویداد، IP یا عامل..."
        searchFn={(row, q) =>
          [row.event, row.ip, row.actor, row.detail].some((v) => v.includes(q))
        }
        filters={[
          {
            key: 'event',
            label: 'رویداد',
            type: 'text',
            placeholder: 'رویداد...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.event.includes(value),
          },
          {
            key: 'severity',
            label: 'شدت',
            type: 'select',
            className: 'w-36',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'low', label: 'کم' },
              { value: 'medium', label: 'متوسط' },
              { value: 'high', label: 'بالا' },
              { value: 'critical', label: 'بحرانی' },
            ],
            filterFn: (row, value) => row.severity === value,
          },
          {
            key: 'ip',
            label: 'IP',
            type: 'text',
            placeholder: 'IP...',
            className: 'w-36',
            filterFn: (row, value) => row.ip.includes(value),
          },
          {
            key: 'actor',
            label: 'عامل',
            type: 'text',
            placeholder: 'عامل...',
            className: 'min-w-36 flex-1',
            filterFn: (row, value) => row.actor.includes(value),
          },
        ]}
      />
    </div>
  )
}
