import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import { confirmDelete } from '../../lib/confirm'
import type { SystemUser } from '../../types/rbac'

export function OrgMembersPage() {
  const { user, activeSoftwareId } = useAuth()
  const {
    softwares,
    assignUserToSoftware,
    orgMembersForTenant,
    removeMembership,
    memberships,
  } = useDomain()

  const software = softwares.find((s) => s.id === activeSoftwareId)
  const rows = useMemo(() => {
    const list = user ? orgMembersForTenant(user.id, activeSoftwareId ?? undefined) : []
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt, 'fa'))
  }, [user, orgMembersForTenant, activeSoftwareId])

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const columns: Column<SystemUser>[] = [
    {
      key: 'name',
      header: 'کاربر سازمان',
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">{r.username}</p>
        </div>
      ),
    },
    { key: 'mobile', header: 'موبایل', render: (r) => r.mobile },
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
      render: (r) => {
        const mem = memberships.find(
          (m) =>
            m.userId === r.id &&
            m.kind === 'org_member' &&
            m.parentTenantUserId === user?.id &&
            (!activeSoftwareId || m.softwareId === activeSoftwareId),
        )
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={!mem}
            onClick={() => {
              void (async () => {
                if (!mem) return
                if (!(await confirmDelete(r.name || r.username))) return
                removeMembership(mem.id)
              })()
            }}
          >
            حذف از نرم‌افزار
          </Button>
        )
      },
    },
  ]

  const submit = () => {
    if (!activeSoftwareId) {
      setMessage('نرم‌افزار فعال را انتخاب کنید.')
      return
    }
    const result = assignUserToSoftware({
      softwareId: activeSoftwareId,
      kinds: ['org_member'],
      name,
      username,
      mobile,
      email,
      password,
      organizationName: user?.organizationName,
    })
    if (!result.ok) {
      setErrors(result.fields ?? {})
      setMessage(result.message)
      return
    }
    setErrors({})
    setMessage(result.linked ? 'کاربر موجود لینک شد.' : 'کاربر سازمان ایجاد شد.')
    setName('')
    setUsername('')
    setMobile('')
    setEmail('')
    setPassword('')
  }

  return (
    <div>
      <PageHeader
        title="کاربران سازمان"
        description={
          software
            ? `اعضای سازمان شما روی «${software.name}» — سپس از API Key برایشان کلید بسازید`
            : 'نرم‌افزار فعال را انتخاب کنید'
        }
      />

      <div className="mb-6 grid gap-4 rounded-xl border border-border bg-panel p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="نام" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="نام کاربری"
          value={username}
          error={errors.username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          label="موبایل"
          value={mobile}
          error={errors.mobile}
          onChange={(e) => setMobile(e.target.value)}
        />
        <Input label="ایمیل" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="رمز عبور"
          type="password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex items-end">
          <Button className="w-full" onClick={submit} disabled={!activeSoftwareId}>
            افزودن کاربر سازمان
          </Button>
        </div>
      </div>

      {message ? <p className="mb-4 text-sm text-muted">{message}</p> : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجو در نام، نام کاربری، موبایل..."
        searchFn={(row, q) =>
          [row.name, row.username, row.mobile].some((v) => v.includes(q))
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
