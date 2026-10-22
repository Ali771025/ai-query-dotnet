import { Link } from 'react-router-dom'
import { Plus, Pencil } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { useAuth, userHasOwnerRole } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import type { Software } from '../../types/software'

export function SoftwareListPage() {
  const { user } = useAuth()
  const { softwares, databases } = useDomain()

  const rows = softwares.filter((s) => {
    if (!user) return false
    if (userHasOwnerRole(user)) return true
    return s.ownerUserId === user.id
  })

  const columns: Column<Software>[] = [
    {
      key: 'name',
      header: 'نرم‌افزار',
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">{r.code}</p>
        </div>
      ),
    },
    {
      key: 'dbs',
      header: 'دیتابیس‌ها',
      render: (r) =>
        databases.filter((d) => d.softwareId === r.id).length.toLocaleString('fa-IR'),
    },
    {
      key: 'versions',
      header: 'تعداد نسخه',
      render: (r) => r.versionCount.toLocaleString('fa-IR'),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => (
        <Badge variant={r.status === 'active' ? 'success' : 'neutral'}>
          {r.status === 'active' ? 'فعال' : 'غیرفعال'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) => (
        <Link to={`/app/software/${r.id}`}>
          <Button variant="ghost" size="sm">
            <Pencil className="size-3.5" />
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="نرم‌افزارها"
        description="نرم‌افزارهای تحت مالکیت شما"
        actions={
          <Link to="/app/software/new">
            <Button>
              <Plus className="size-4" />
              نرم‌افزار جدید
            </Button>
          </Link>
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی نام یا کد..."
        searchFn={(row, q) =>
          [row.name, row.code].some((v) => v.includes(q))
        }
        filters={[
          {
            key: 'name',
            label: 'نام',
            type: 'text',
            placeholder: 'نام نرم‌افزار...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.name.includes(value),
          },
          {
            key: 'code',
            label: 'کد',
            type: 'text',
            placeholder: 'کد...',
            className: 'w-36',
            filterFn: (row, value) => row.code.includes(value),
          },
          {
            key: 'status',
            label: 'وضعیت',
            type: 'select',
            className: 'w-36',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ],
            filterFn: (row, value) => row.status === value,
          },
        ]}
      />
    </div>
  )
}
