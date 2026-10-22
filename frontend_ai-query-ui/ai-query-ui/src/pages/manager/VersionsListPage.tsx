import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, BookOpen } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column, type DataTableFilter } from '../../components/ui/DataTable'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import { jalaliDateIncludes } from '../../lib/jalaliDate'
import type { SoftwareVersion } from '../../types/software'

const knowledgeLabel = {
  complete: 'کامل',
  partial: 'ناقص',
  empty: 'خالی',
}

const knowledgeVariant = {
  complete: 'success',
  partial: 'warning',
  empty: 'neutral',
} as const

export function VersionsListPage() {
  const { user } = useAuth()
  const { ownedSoftwares, versions } = useDomain()

  const mySoftwares = useMemo(
    () => (user ? ownedSoftwares(user.id) : []),
    [ownedSoftwares, user],
  )

  const mySoftwareIds = useMemo(
    () => new Set(mySoftwares.map((s) => s.id)),
    [mySoftwares],
  )

  const rows = useMemo(
    () =>
      versions
        .filter((v) => mySoftwareIds.has(v.softwareId))
        .slice()
        .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt, 'fa')),
    [versions, mySoftwareIds],
  )

  const filters: DataTableFilter<SoftwareVersion>[] = useMemo(
    () => [
      {
        key: 'software',
        label: 'نرم‌افزار',
        type: 'select',
        className: 'w-52',
        options: [
          { value: 'all', label: 'همه' },
          ...mySoftwares.map((s) => ({ value: s.id, label: s.name })),
        ],
        filterFn: (row, value) => row.softwareId === value,
      },
      {
        key: 'version',
        label: 'نسخه',
        type: 'text',
        placeholder: 'شماره نسخه...',
        className: 'w-36',
        filterFn: (row, value) => row.version.includes(value),
      },
      {
        key: 'knowledge',
        label: 'وضعیت دانش',
        type: 'select',
        className: 'w-40',
        options: [
          { value: 'all', label: 'همه' },
          { value: 'complete', label: 'کامل' },
          { value: 'partial', label: 'ناقص' },
          { value: 'empty', label: 'خالی' },
        ],
        filterFn: (row, value) => row.knowledgeStatus === value,
      },
      {
        key: 'refs',
        label: 'ارجاع نسخه‌ها',
        type: 'text',
        placeholder: 'مثلاً 2.3.0',
        className: 'w-40',
        filterFn: (row, value) =>
          row.referencedVersions.some((v) => v.includes(value)),
      },
      {
        key: 'released',
        label: 'تاریخ انتشار',
        type: 'date',
        placeholder: '۱۴۰۳/۰۱/۰۱',
        className: 'w-40',
        filterFn: (row, value) => jalaliDateIncludes(row.releasedAt, value),
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
    ],
    [mySoftwares],
  )

  const columns: Column<SoftwareVersion>[] = [
    { key: 'software', header: 'نرم‌افزار', render: (r) => r.softwareName },
    { key: 'version', header: 'نسخه', render: (r) => r.version },
    {
      key: 'knowledge',
      header: 'وضعیت دانش',
      render: (r) => (
        <Badge variant={knowledgeVariant[r.knowledgeStatus]}>
          {knowledgeLabel[r.knowledgeStatus]}
        </Badge>
      ),
    },
    {
      key: 'refs',
      header: 'ارجاع نسخه‌ها',
      render: (r) => (r.referencedVersions.length ? r.referencedVersions.join('، ') : '—'),
    },
    { key: 'released', header: 'تاریخ انتشار', render: (r) => r.releasedAt },
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
        <div className="flex items-center gap-1">
          <Link to={`/app/versions/${r.id}`}>
            <Button variant="ghost" size="sm" title="ویرایش">
              <Pencil className="size-3.5" />
            </Button>
          </Link>
          <Link to={`/app/versions/${r.id}/knowledge`}>
            <Button variant="ghost" size="sm" title="مدیریت دانش نسخه">
              <BookOpen className="size-3.5" />
              <span className="ms-1 hidden sm:inline">مدیریت دانش نسخه</span>
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="نسخه‌های نرم‌افزار"
        description="فقط نسخه‌های نرم‌افزارهای تحت مالکیت شما"
        actions={
          <Link to="/app/versions/new">
            <Button>
              <Plus className="size-4" />
              نسخه جدید
            </Button>
          </Link>
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی نسخه، نرم‌افزار یا ارجاع..."
        searchFn={(row, q) =>
          [
            row.softwareName,
            row.version,
            row.releasedAt,
            ...row.referencedVersions,
          ].some((v) => v.includes(q))
        }
        filters={filters}
      />
    </div>
  )
}
