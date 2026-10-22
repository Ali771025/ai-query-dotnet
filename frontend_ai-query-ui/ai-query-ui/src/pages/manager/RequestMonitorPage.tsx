import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { requestMonitor } from '../../data/mock/software'
import type { RequestMonitorItem } from '../../types/software'

export function RequestMonitorPage() {
  const columns: Column<RequestMonitorItem>[] = [
    { key: 'time', header: 'زمان', render: (r) => r.timestamp },
    { key: 'user', header: 'کاربر', render: (r) => r.user },
    { key: 'software', header: 'نرم‌افزار/نسخه', render: (r) => r.software },
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
    {
      key: 'latency',
      header: 'تأخیر',
      render: (r) => `${r.latencyMs.toLocaleString('fa-IR')} ms`,
    },
    { key: 'model', header: 'مدل', render: (r) => r.model },
  ]

  return (
    <div>
      <PageHeader
        title="مانیتورینگ درخواست‌ها"
        description="وضعیت زنده درخواست‌ها شامل تأخیر و مدل استفاده‌شده"
      />
      <DataTable
        rows={requestMonitor}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی کاربر، موضوع، نرم‌افزار یا مدل..."
        searchFn={(row, q) =>
          [row.user, row.topic, row.model, row.software].some((v) => v.includes(q))
        }
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
            key: 'software',
            label: 'نرم‌افزار/نسخه',
            type: 'text',
            placeholder: 'نرم‌افزار یا نسخه...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.software.includes(value),
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
          {
            key: 'model',
            label: 'مدل',
            type: 'text',
            placeholder: 'مدل...',
            className: 'w-36',
            filterFn: (row, value) => row.model.includes(value),
          },
        ]}
      />
    </div>
  )
}
