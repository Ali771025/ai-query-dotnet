import { PageHeader } from '../../components/layout/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { userLogs } from '../../data/mock/managers'
import type { UserLog } from '../../types/manager'

export function UserLogsPage() {
  const columns: Column<UserLog>[] = [
    { key: 'time', header: 'زمان', render: (r) => r.timestamp },
    { key: 'user', header: 'کاربر', render: (r) => r.user },
    { key: 'entity', header: 'موجودیت', render: (r) => r.entity },
    { key: 'action', header: 'اقدام', render: (r) => r.action },
    { key: 'detail', header: 'جزئیات', render: (r) => r.detail },
  ]

  return (
    <div>
      <PageHeader
        title="لاگ‌های کاربری"
        description="فعالیت کاربران با امکان فیلتر بر اساس موجودیت"
      />
      <DataTable
        rows={userLogs}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی کاربر، موجودیت یا اقدام..."
        searchFn={(row, q) =>
          [row.user, row.entity, row.action, row.detail].some((v) => v.includes(q))
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
            key: 'entity',
            label: 'موجودیت',
            type: 'select',
            className: 'w-40',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'نسخه', label: 'نسخه' },
              { value: 'کاربران', label: 'کاربران' },
              { value: 'دانش', label: 'دانش' },
              { value: 'API', label: 'API Key' },
            ],
            filterFn: (row, value) => row.entity.includes(value),
          },
          {
            key: 'action',
            label: 'اقدام',
            type: 'text',
            placeholder: 'اقدام...',
            className: 'w-36',
            filterFn: (row, value) => row.action.includes(value),
          },
          {
            key: 'detail',
            label: 'جزئیات',
            type: 'text',
            placeholder: 'جزئیات...',
            className: 'min-w-36 flex-1',
            filterFn: (row, value) => row.detail.includes(value),
          },
        ]}
      />
    </div>
  )
}
