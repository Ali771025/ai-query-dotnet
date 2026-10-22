import { useMemo } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import { confirmRevoke } from '../../lib/confirm'
import type { ApiKeyRecord } from '../../types/software'

export function ApiKeysPage() {
  const { activeSoftwareId, users } = useAuth()
  const { apiKeys, softwares, revokeApiKey, usersOfKindForSoftware } = useDomain()
  const software = softwares.find((s) => s.id === activeSoftwareId)
  const endUserIds = new Set(
    usersOfKindForSoftware(activeSoftwareId ?? '', 'end_user').map((u) => u.id),
  )

  const rows = useMemo(
    () =>
      apiKeys
        .filter(
          (k) =>
            (!activeSoftwareId || k.softwareId === activeSoftwareId) &&
            (endUserIds.has(k.userId) || k.softwareId === activeSoftwareId),
        )
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt, 'fa')),
    [apiKeys, activeSoftwareId, endUserIds],
  )

  const columns: Column<ApiKeyRecord>[] = [
    {
      key: 'user',
      header: 'کاربر',
      render: (r) => users.find((u) => u.id === r.userId)?.name ?? r.userName,
    },
    {
      key: 'key',
      header: 'کلید',
      render: (r) => (
        <code className="rounded bg-primary-soft px-1.5 py-0.5 text-xs">{r.keyMasked}</code>
      ),
    },
    {
      key: 'tokens',
      header: 'توکن اختصاصی',
      render: (r) => r.allocatedTokens.toLocaleString('fa-IR'),
    },
    { key: 'created', header: 'ایجاد', render: (r) => r.createdAt },
    { key: 'last', header: 'آخرین استفاده', render: (r) => r.lastUsedAt },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => (
        <Badge variant={r.status === 'active' ? 'success' : 'neutral'}>
          {r.status === 'active' ? 'فعال' : 'باطل‌شده'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          disabled={r.status !== 'active'}
          onClick={() => {
            void (async () => {
              if (!(await confirmRevoke(r.keyMasked))) return
              revokeApiKey(r.id)
            })()
          }}
        >
          ابطال
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="API Key نرم‌افزار"
        description={
          software
            ? `کلیدهای کاربران «${software.name}» — صدور توسط خود کاربر نهایی`
            : 'نرم‌افزار فعال را انتخاب کنید'
        }
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی کاربر یا کلید..."
        searchFn={(row, q) =>
          [row.userName, row.keyMasked].some((v) => v.includes(q))
        }
        filters={[
          {
            key: 'user',
            label: 'کاربر',
            type: 'text',
            placeholder: 'نام کاربر...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.userName.includes(value),
          },
          {
            key: 'key',
            label: 'کلید',
            type: 'text',
            placeholder: 'بخشی از کلید...',
            className: 'w-40',
            filterFn: (row, value) => row.keyMasked.includes(value),
          },
          {
            key: 'status',
            label: 'وضعیت',
            type: 'select',
            className: 'w-36',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'باطل‌شده' },
            ],
            filterFn: (row, value) => row.status === value,
          },
        ]}
      />
    </div>
  )
}
