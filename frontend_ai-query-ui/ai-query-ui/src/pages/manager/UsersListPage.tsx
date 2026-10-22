import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import type { SystemUser } from '../../types/rbac'
import type { MembershipKind } from '../../lib/hierarchy'
import { confirmDelete } from '../../lib/confirm'

type Row = SystemUser & {
  kinds: MembershipKind[]
  membershipIds: string[]
}

const KIND_LABEL: Record<string, string> = {
  software_owner: 'مالک نرم‌افزار',
  software_support: 'پشتیبان نرم‌افزار',
  end_user: 'کاربر نهایی',
  org_member: 'کاربر سازمان',
  company_owner: 'مالک شرکت نرم‌افزاری',
}

const KIND_ORDER: MembershipKind[] = [
  'software_owner',
  'company_owner',
  'software_support',
  'end_user',
  'org_member',
]

export function UsersListPage() {
  const { getRoleNames, activeSoftwareId, activeWorkspace, users } = useAuth()
  const {
    softwares,
    membershipsForSoftware,
    removeMembership,
    actorTier,
    canEditAssignedUser,
  } = useDomain()

  const software = softwares.find((s) => s.id === activeSoftwareId)

  const kinds = useMemo<MembershipKind[]>(() => {
    if (activeWorkspace === 'platform' || actorTier === 'platform') {
      return ['software_owner']
    }
    if (activeWorkspace === 'software_owner' || actorTier === 'software_owner') {
      return ['company_owner']
    }
    if (activeWorkspace === 'support' || actorTier === 'support') return ['end_user']
    if (activeWorkspace === 'company' || actorTier === 'company') {
      return ['software_support', 'end_user']
    }
    return ['end_user']
  }, [activeWorkspace, actorTier])

  const rows: Row[] = useMemo(() => {
    if (!activeSoftwareId) return []
    const members = membershipsForSoftware(activeSoftwareId).filter((m) =>
      kinds.includes(m.kind),
    )
    const byUser = new Map<string, { kinds: MembershipKind[]; membershipIds: string[] }>()
    for (const m of members) {
      const cur = byUser.get(m.userId) ?? { kinds: [], membershipIds: [] }
      if (!cur.kinds.includes(m.kind)) cur.kinds.push(m.kind)
      if (m.id && !cur.membershipIds.includes(m.id)) cur.membershipIds.push(m.id)
      byUser.set(m.userId, cur)
    }
    return [...byUser.entries()]
      .map(([userId, data]) => {
        const u = users.find((x) => x.id === userId)
        if (!u) return null
        const sortedKinds = [...data.kinds].sort(
          (a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b),
        )
        return {
          ...u,
          kinds: sortedKinds,
          membershipIds: data.membershipIds,
        }
      })
      .filter((r): r is Row => Boolean(r))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt, 'fa'))
  }, [activeSoftwareId, kinds, membershipsForSoftware, users])

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'کاربر',
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">{r.username}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'سطح',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.kinds.map((kind) => (
            <Badge key={kind} variant="info">
              {KIND_LABEL[kind] ?? kind}
            </Badge>
          ))}
        </div>
      ),
    },
    { key: 'mobile', header: 'موبایل', render: (r) => r.mobile },
    {
      key: 'org',
      header: 'سازمان',
      render: (r) => r.organizationName ?? '—',
    },
    {
      key: 'roles',
      header: 'نقش‌ها',
      render: (r) => getRoleNames(r.roleIds).join('، ') || '—',
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
        <div className="flex gap-1">
          {canEditAssignedUser(r.id) ? (
            <Link to={`/app/users/${r.id}`}>
              <Button variant="ghost" size="sm" title="ویرایش">
                <Pencil className="size-3.5" />
              </Button>
            </Link>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled
              title="ویرایش کاربر شرکت دیگر مجاز نیست"
            >
              <Pencil className="size-3.5 opacity-40" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void (async () => {
                if (!r.membershipIds.length) return
                if (!(await confirmDelete(r.name || r.username))) return
                for (const membershipId of r.membershipIds) {
                  removeMembership(membershipId)
                }
              })()
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="کاربران نرم‌افزار"
        description={
          software
            ? `تفکیک سلسله‌مراتبی برای «${software.name}» — فقط سطوح مجاز سطح شما`
            : 'نرم‌افزار فعال را از هدر انتخاب کنید'
        }
        actions={
          <Link to="/app/users/new">
            <Button disabled={!activeSoftwareId}>
              <Plus className="size-4" />
              تخصیص کاربر
            </Button>
          </Link>
        }
      />
      {!activeSoftwareId ? (
        <p className="rounded-xl border border-border bg-panel p-6 text-sm text-muted">
          نرم‌افزار فعال را انتخاب کنید.
        </p>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchPlaceholder="جستجو در نام، موبایل، سازمان..."
          searchFn={(row, q) =>
            [row.name, row.username, row.mobile, row.organizationName ?? ''].some((v) =>
              v.includes(q),
            )
          }
          filters={[
            {
              key: 'name',
              label: 'کاربر',
              type: 'text',
              placeholder: 'نام یا نام کاربری...',
              className: 'min-w-40 flex-1',
              filterFn: (row, value) =>
                [row.name, row.username].some((v) => v.includes(value)),
            },
            {
              key: 'mobile',
              label: 'موبایل',
              type: 'text',
              placeholder: '09...',
              className: 'w-36',
              filterFn: (row, value) => (row.mobile ?? '').includes(value),
            },
            {
              key: 'org',
              label: 'سازمان',
              type: 'text',
              placeholder: 'نام سازمان...',
              className: 'min-w-36 flex-1',
              filterFn: (row, value) => (row.organizationName ?? '').includes(value),
            },
            {
              key: 'kind',
              label: 'سطح',
              type: 'select',
              className: 'w-44',
              options: [
                { value: 'all', label: 'همه' },
                ...kinds.map((k) => ({
                  value: k,
                  label: KIND_LABEL[k] ?? k,
                })),
              ],
              filterFn: (row, value) => row.kinds.includes(value as MembershipKind),
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
      )}
    </div>
  )
}
