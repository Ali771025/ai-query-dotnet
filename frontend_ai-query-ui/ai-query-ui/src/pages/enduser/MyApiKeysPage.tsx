import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Dialog } from '../../components/ui/Dialog'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import { confirmRevoke } from '../../lib/confirm'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard'
import type { ApiKeyRecord } from '../../types/software'

type MyApiKeysPanelProps = {
  /** داخل صفحهٔ تست مدل — بدون PageHeader */
  embedded?: boolean
}

export function MyApiKeysPanel({ embedded = false }: MyApiKeysPanelProps) {
  const { user, activeSoftwareId, hasPermission } = useAuth()
  const {
    apiKeys,
    softwares,
    createApiKey,
    allocateTokensToApiKey,
    revokeApiKey,
    orgMembersForTenant,
    accessibleSoftwares,
    actorTier,
    apiKeyPeerUsers,
  } = useDomain()

  const isOwnerActor =
    actorTier === 'platform' ||
    actorTier === 'software_owner' ||
    actorTier === 'company'

  /** پلتفرم / مالک نرم‌افزار: صدور برای هم‌سطح */
  const canManagePeers =
    actorTier === 'platform' || actorTier === 'software_owner'

  const softwareOptions = accessibleSoftwares.length
    ? accessibleSoftwares
    : softwares.filter((s) =>
        apiKeys.some((k) => k.createdByTenantUserId === user?.id && k.softwareId === s.id),
      )

  const [softwareId, setSoftwareId] = useState(
    activeSoftwareId ?? softwareOptions[0]?.id ?? '',
  )
  const orgMembers = user ? orgMembersForTenant(user.id, softwareId || undefined) : []
  const [forUserId, setForUserId] = useState(user?.id ?? '')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [allocKeyId, setAllocKeyId] = useState('')
  const [allocAmount, setAllocAmount] = useState('500')
  const [allocBaseline, setAllocBaseline] = useState('500')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const peerOptions = useMemo(() => {
    if (!canManagePeers) return []
    return apiKeyPeerUsers
  }, [canManagePeers, apiKeyPeerUsers])

  useEffect(() => {
    if (!canManagePeers) return
    if (forUserId && !peerOptions.some((u) => u.id === forUserId)) {
      setForUserId(user?.id ?? peerOptions[0]?.id ?? '')
    }
  }, [peerOptions, forUserId, canManagePeers, user?.id])

  useEffect(() => {
    if (canManagePeers || isOwnerActor) return
    if (forUserId && !orgMembers.some((u) => u.id === forUserId)) {
      setForUserId('')
    }
  }, [orgMembers, forUserId, canManagePeers, isOwnerActor])

  const allocDirty = Boolean(allocKeyId) && allocAmount !== allocBaseline
  useUnsavedChangesGuard(allocDirty)

  const peerIds = useMemo(
    () => new Set(apiKeyPeerUsers.map((u) => u.id)),
    [apiKeyPeerUsers],
  )

  const myKeys = useMemo(() => {
    const list = apiKeys.filter((k) => {
      if (isOwnerActor) {
        if (canManagePeers) {
          return peerIds.has(k.userId)
        }
        return k.userId === user?.id || k.createdByTenantUserId === user?.id
      }
      return k.createdByTenantUserId === user?.id
    })
    return list
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt, 'fa'))
  }, [apiKeys, user, isOwnerActor, canManagePeers, peerIds])

  const allocatableBalance = useMemo(() => {
    if (!user) return 0
    if (
      isOwnerActor &&
      (actorTier === 'company' ||
        actorTier === 'platform' ||
        (user.endUserTokenBalance ?? 0) <= 0)
    ) {
      return user.managerTokenBalance ?? 0
    }
    return user.endUserTokenBalance ?? 0
  }, [user, isOwnerActor, actorTier])

  const canCreate = hasPermission('owner-apikeys.create') || hasPermission('my-apikeys.create')
  const canEdit = hasPermission('owner-apikeys.edit') || hasPermission('my-apikeys.edit')
  const canDelete = hasPermission('owner-apikeys.delete') || hasPermission('my-apikeys.delete')

  const columns: Column<ApiKeyRecord>[] = [
    {
      key: 'software',
      header: 'نرم‌افزار',
      render: (r) => softwares.find((s) => s.id === r.softwareId)?.name ?? r.softwareId,
    },
    { key: 'user', header: 'کاربر', render: (r) => r.userName },
    {
      key: 'key',
      header: 'کلید',
      render: (r) => (
        <code className="rounded bg-primary-soft px-1.5 py-0.5 text-xs">{r.keyMasked}</code>
      ),
    },
    {
      key: 'tokens',
      header: 'توکن',
      render: (r) => r.allocatedTokens.toLocaleString('fa-IR'),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => (
        <Badge variant={r.status === 'active' ? 'success' : 'neutral'}>
          {r.status === 'active' ? 'فعال' : 'باطل'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) => (
        <div className="flex gap-1">
          {canEdit ? (
            <Button
              size="sm"
              variant="outline"
              disabled={r.status !== 'active'}
              onClick={() => {
                setAllocAmount('500')
                setAllocBaseline('500')
                setAllocKeyId(r.id)
              }}
            >
              اختصاص توکن
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="sm"
              variant="ghost"
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
          ) : null}
        </div>
      ),
    },
  ]

  const issue = () => {
    if (!softwareId) {
      setMessage('نرم‌افزار را انتخاب کنید.')
      return
    }
    if (!canCreate) {
      setMessage('اجازهٔ صدور کلید را ندارید.')
      return
    }
    if (canManagePeers) {
      const target = forUserId || user?.id
      if (!target) {
        setMessage('کاربر هم‌سطح را انتخاب کنید.')
        return
      }
      const result = createApiKey(softwareId, target)
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      setCreatedKey(result.keyFull)
      setMessage('')
      return
    }
    if (isOwnerActor) {
      const result = createApiKey(softwareId, user?.id)
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      setCreatedKey(result.keyFull)
      setMessage('')
      return
    }
    const target = forUserId || orgMembers[0]?.id
    if (!target) {
      setMessage('نرم‌افزار و کاربر سازمان را انتخاب کنید.')
      return
    }
    const result = createApiKey(softwareId, target)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setCreatedKey(result.keyFull)
    setMessage('')
  }

  const allocate = () => {
    const result = allocateTokensToApiKey(allocKeyId, Number(allocAmount))
    if (!result.ok) {
      setErrors(result.fields ?? {})
      setMessage(result.message)
      return
    }
    setErrors({})
    setMessage('توکن اختصاص یافت.')
    setAllocKeyId('')
  }

  const canIssue = canCreate
    ? canManagePeers
      ? Boolean(softwareId && (forUserId || user?.id))
      : isOwnerActor
        ? Boolean(softwareId)
        : Boolean(softwareId && orgMembers.length)
    : false

  const gridCols = canManagePeers
    ? 'sm:grid-cols-3'
    : isOwnerActor
      ? 'sm:grid-cols-2'
      : 'sm:grid-cols-3'

  return (
    <div>
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            موجودی قابل اختصاص: {allocatableBalance.toLocaleString('fa-IR')}
          </p>
          {hasPermission('owner-apikeys.view') ? (
            <Link
              to="/app/owner-api-keys"
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              مدیریت کامل در منوی API Keyها
            </Link>
          ) : null}
        </div>
      ) : (
        <PageHeader
          title="API Keyها"
          description={
            canManagePeers
              ? `کلیدهای کاربران هم‌سطح — موجودی قابل اختصاص: ${allocatableBalance.toLocaleString('fa-IR')}`
              : `موجودی قابل اختصاص: ${allocatableBalance.toLocaleString('fa-IR')}`
          }
        />
      )}

      <div
        className={`mb-6 grid gap-4 rounded-xl border border-border bg-panel p-5 ${gridCols}`}
      >
        <Select
          label="نرم‌افزار"
          value={softwareId}
          onChange={(e) => {
            setSoftwareId(e.target.value)
            if (!canManagePeers && !isOwnerActor) setForUserId('')
          }}
          options={
            softwareOptions.length
              ? softwareOptions.map((s) => ({ value: s.id, label: s.name }))
              : [{ value: '', label: 'نرم‌افزار قابل دسترسی ندارید' }]
          }
        />
        {canManagePeers ? (
          <Select
            label="کاربر هم‌سطح"
            value={forUserId}
            onChange={(e) => setForUserId(e.target.value)}
            isSearchable
            placeholder="جستجو یا انتخاب کاربر..."
            emptyText="کاربر هم‌سطحی یافت نشد"
            options={
              peerOptions.length
                ? peerOptions.map((u) => ({
                    value: u.id,
                    label: u.id === user?.id ? `${u.name} (خودم)` : u.name,
                  }))
                : [{ value: user?.id ?? '', label: user?.name ?? '—' }]
            }
          />
        ) : isOwnerActor ? null : (
          <Select
            label="کاربر سازمان"
            value={forUserId}
            onChange={(e) => setForUserId(e.target.value)}
            isSearchable
            placeholder="جستجو یا انتخاب کاربر..."
            emptyText={
              orgMembers.length === 0
                ? 'ابتدا کاربر سازمان بسازید'
                : 'کاربری یافت نشد'
            }
            options={
              orgMembers.length
                ? orgMembers.map((u) => ({ value: u.id, label: u.name }))
                : [{ value: '', label: 'ابتدا کاربر سازمان بسازید' }]
            }
          />
        )}
        <div className="flex items-end">
          <Button onClick={issue} disabled={!canIssue}>
            {canManagePeers
              ? forUserId && forUserId !== user?.id
                ? 'صدور کلید برای کاربر'
                : 'صدور کلید برای خودم'
              : isOwnerActor
                ? 'صدور کلید برای خودم'
                : 'صدور کلید'}
          </Button>
        </div>
      </div>

      {message ? <p className="mb-4 text-sm text-muted">{message}</p> : null}

      <DataTable rows={myKeys} columns={columns} rowKey={(r) => r.id}
        searchPlaceholder="جستجو در نرم‌افزار، کاربر، کلید..."
        searchFn={(row, q) => {
          const sw = softwares.find((s) => s.id === row.softwareId)?.name ?? ''
          return [sw, row.userName, row.keyMasked].some((v) => v.includes(q))
        }}
        filters={[
          {
            key: 'software',
            label: 'نرم‌افزار',
            type: 'select',
            className: 'w-48',
            options: [
              { value: 'all', label: 'همه' },
              ...softwareOptions.map((s) => ({ value: s.id, label: s.name })),
            ],
            filterFn: (row, value) => row.softwareId === value,
          },
          ...(canManagePeers
            ? [
                {
                  key: 'peerUser',
                  label: 'کاربر',
                  type: 'select' as const,
                  className: 'w-48',
                  options: [
                    { value: 'all', label: 'همه' },
                    ...peerOptions.map((u) => ({
                      value: u.id,
                      label: u.id === user?.id ? `${u.name} (خودم)` : u.name,
                    })),
                  ],
                  filterFn: (row: ApiKeyRecord, value: string) => row.userId === value,
                },
              ]
            : [
                {
                  key: 'user',
                  label: 'کاربر',
                  type: 'text' as const,
                  placeholder: 'نام کاربر...',
                  className: 'min-w-36 flex-1',
                  filterFn: (row: ApiKeyRecord, value: string) =>
                    row.userName.includes(value),
                },
              ]),
          {
            key: 'status',
            label: 'وضعیت',
            type: 'select',
            className: 'w-36',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'باطل' },
            ],
            filterFn: (row, value) => row.status === value,
          },
        ]}
      />

      <Dialog
        open={Boolean(createdKey)}
        title="کلید جدید"
        onClose={() => setCreatedKey(null)}
        footer={<Button onClick={() => setCreatedKey(null)}>متوجه شدم</Button>}
      >
        <code className="block break-all rounded-lg bg-primary-soft p-3 text-sm">
          {createdKey}
        </code>
      </Dialog>

      <Dialog
        open={Boolean(allocKeyId)}
        title="اختصاص توکن"
        form
        dirty={allocDirty}
        onClose={() => setAllocKeyId('')}
        footer={({ requestClose }) => (
          <>
            <Button variant="outline" onClick={requestClose}>
              انصراف
            </Button>
            <Button onClick={allocate}>ثبت</Button>
          </>
        )}
      >
        <Input
          label="مقدار"
          value={allocAmount}
          error={errors.amount}
          onChange={(e) => setAllocAmount(e.target.value)}
        />
      </Dialog>
    </div>
  )
}

export function MyApiKeysPage() {
  return <MyApiKeysPanel />
}
