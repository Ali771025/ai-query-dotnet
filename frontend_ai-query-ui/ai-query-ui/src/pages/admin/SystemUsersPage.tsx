import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ArrowRightLeft } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { MultiSelect } from '../../components/ui/MultiSelect'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { useAuth, userHasOwnerRole } from '../../context/AuthContext'
import { OWNER_TRANSFER_DEMO_OTP, OWNER_ROLE_ID, SOFTWARE_OWNER_ROLE_ID } from '../../data/seed'
import { confirmDelete } from '../../lib/confirm'
import {
  isFormDirty,
  useUnsavedChangesGuard,
} from '../../hooks/useUnsavedChangesGuard'
import type { SystemUser } from '../../types/rbac'

function emptyUser(): SystemUser {
  return {
    id: `user-${Date.now()}`,
    username: '',
    password: '',
    name: '',
    email: '',
    mobile: '',
    roleIds: [],
    status: 'active',
    createdAt: new Date().toLocaleDateString('fa-IR'),
    managerTokenBalance: 0,
    endUserTokenBalance: 0,
  }
}

function userFormSnapshot(u: SystemUser) {
  return {
    username: u.username,
    password: u.password,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    roleIds: [...u.roleIds].sort(),
    status: u.status,
    organizationName: u.organizationName ?? '',
  }
}

export function SystemUsersPage() {
  const {
    user,
    manageableUsers,
    roles,
    upsertUser,
    deleteUser,
    getRoleNames,
    transferOwnership,
    grantablePermissionIds,
    canManageSystemUser,
    sessionRoleIds,
  } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SystemUser>(emptyUser())
  const [baseline, setBaseline] = useState(() => userFormSnapshot(emptyUser()))
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [transferOpen, setTransferOpen] = useState(false)
  const [transferStep, setTransferStep] = useState<1 | 2>(1)
  const [targetUserId, setTargetUserId] = useState('')
  const [transferPassword, setTransferPassword] = useState('')
  const [transferOtp, setTransferOtp] = useState('')
  const [transferMessage, setTransferMessage] = useState('')
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({})

  const userDirty = open && isFormDirty(userFormSnapshot(draft), baseline)
  const transferDirty =
    transferOpen &&
    (Boolean(transferPassword.trim()) ||
      Boolean(transferOtp.trim()) ||
      transferStep === 2)
  useUnsavedChangesGuard(userDirty || transferDirty)

  const currentIsOwner = sessionRoleIds.includes(OWNER_ROLE_ID)
  const users = useMemo(
    () =>
      [...manageableUsers].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt, 'fa'),
      ),
    [manageableUsers],
  )
  const transferTargets = useMemo(
    () =>
      users.filter(
        (u) => u.status === 'active' && u.id !== user?.id && !userHasOwnerRole(u),
      ),
    [users, user],
  )

  const assignableRoles = useMemo(
    () =>
      roles.filter((r) => {
        if (r.ownerUserId) return false
        if (r.id === OWNER_ROLE_ID && !currentIsOwner) return false
        if (r.id === SOFTWARE_OWNER_ROLE_ID && !currentIsOwner) return false
        if (currentIsOwner) return true
        return r.permissionIds.every((p) => grantablePermissionIds.includes(p))
      }),
    [roles, currentIsOwner, grantablePermissionIds],
  )

  const openCreate = () => {
    const next = emptyUser()
    setDraft(next)
    setBaseline(userFormSnapshot(next))
    setMessage('')
    setFieldErrors({})
    setOpen(true)
  }

  const openEdit = (row: SystemUser) => {
    if (!canManageSystemUser(row.id)) {
      setMessage('اجازه ویرایش این کاربر را ندارید.')
      return
    }
    const next = { ...row, password: '' }
    setDraft(next)
    setBaseline(userFormSnapshot(next))
    setMessage('')
    setFieldErrors({})
    setOpen(true)
  }

  const save = () => {
    const isEdit = users.some((u) => u.id === draft.id)
    const payload: SystemUser = {
      ...draft,
      password:
        draft.password ||
        (isEdit ? users.find((u) => u.id === draft.id)?.password || '' : ''),
      companyOwnerUserId: draft.companyOwnerUserId ?? user?.id,
      organizationName: draft.organizationName || user?.organizationName,
    }
    const result = upsertUser(payload)
    if (!result.ok) {
      if (result.fields && Object.keys(result.fields).length > 0) {
        setFieldErrors(result.fields)
        setMessage('')
      } else if (result.field) {
        setFieldErrors({ [result.field]: result.message })
        setMessage('')
      } else {
        setFieldErrors({})
        setMessage(result.message)
      }
      return
    }
    setFieldErrors({})
    setOpen(false)
  }

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const openTransfer = () => {
    setTransferStep(1)
    setTargetUserId(transferTargets[0]?.id ?? '')
    setTransferPassword('')
    setTransferOtp('')
    setTransferMessage('')
    setTransferErrors({})
    setTransferOpen(true)
  }

  const continueTransfer = () => {
    const nextErrors: Record<string, string> = {}
    if (!targetUserId) nextErrors.targetUserId = 'کاربر مقصد را انتخاب کنید.'
    if (!transferPassword) nextErrors.password = 'رمز عبور فعلی الزامی است.'
    if (Object.keys(nextErrors).length) {
      setTransferErrors(nextErrors)
      setTransferMessage('')
      return
    }
    setTransferErrors({})
    setTransferMessage('')
    setTransferStep(2)
  }

  const confirmTransfer = () => {
    const result = transferOwnership(targetUserId, transferPassword, transferOtp)
    if (!result.ok) {
      if (result.fields && Object.keys(result.fields).length > 0) {
        setTransferErrors(result.fields)
        setTransferMessage('')
      } else if (result.field) {
        setTransferErrors({ [result.field]: result.message })
        setTransferMessage('')
      } else {
        setTransferErrors({})
        setTransferMessage(result.message)
      }
      return
    }
    setTransferOpen(false)
    setMessage('مالکیت با موفقیت منتقل شد.')
  }

  const columns: Column<SystemUser>[] = [
    {
      key: 'name',
      header: 'کاربر',
      render: (r) => (
        <div>
          <p className="font-medium text-heading">{r.name}</p>
          <p className="text-xs text-muted">{r.username}</p>
        </div>
      ),
    },
    { key: 'email', header: 'ایمیل', render: (r) => r.email },
    {
      key: 'mobile',
      header: 'همراه',
      render: (r) => r.mobile || '—',
    },
    {
      key: 'roles',
      header: 'نقش‌ها',
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          {getRoleNames(r.roleIds).join('، ') || '—'}
          {userHasOwnerRole(r) ? <Badge variant="info">مالک</Badge> : null}
        </span>
      ),
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
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="ویرایش">
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void (async () => {
                if (!canManageSystemUser(r.id)) return
                if (!(await confirmDelete(r.name || r.username))) return
                const result = deleteUser(r.id)
                if (!result.ok) setMessage(result.message)
              })()
            }}
            title="حذف"
          >
            <Trash2 className="size-3.5 text-danger" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="کاربران"
        description={
          currentIsOwner
            ? 'کاربران قابل ویرایش‌اند؛ همیشه حداقل یک مالک فعال در سامانه لازم است'
            : 'فقط کاربران متعلق به شرکت خودتان را می‌بینید و مدیریت می‌کنید'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {currentIsOwner ? (
              <Button variant="outline" onClick={openTransfer}>
                <ArrowRightLeft className="size-4" />
                انتقال مالکیت
              </Button>
            ) : null}
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              کاربر جدید
            </Button>
          </div>
        }
      />

      {message ? <p className="mb-3 text-sm text-danger">{message}</p> : null}

      <DataTable
        rows={users}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی نام، ایمیل، موبایل..."
        searchFn={(row, q) =>
          [row.name, row.username, row.email, row.mobile ?? ''].some((v) =>
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
            key: 'email',
            label: 'ایمیل',
            type: 'text',
            placeholder: 'جستجوی ایمیل...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.email.includes(value),
          },
          {
            key: 'mobile',
            label: 'همراه',
            type: 'text',
            placeholder: '09...',
            className: 'w-36',
            filterFn: (row, value) => (row.mobile ?? '').includes(value),
          },
          {
            key: 'role',
            label: 'نقش',
            type: 'select',
            className: 'w-44',
            options: [
              { value: 'all', label: 'همه' },
              ...roles.map((role) => ({ value: role.id, label: role.name })),
            ],
            filterFn: (row, value) => row.roleIds.includes(value),
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

      <Dialog
        open={open}
        title={users.some((u) => u.id === draft.id) ? 'ویرایش کاربر' : 'کاربر جدید'}
        form
        dirty={userDirty}
        onClose={() => setOpen(false)}
        footer={({ requestClose }) => (
          <>
            <Button variant="outline" onClick={requestClose}>
              انصراف
            </Button>
            <Button onClick={save}>ذخیره</Button>
          </>
        )}
      >
        <div className="grid gap-3">
          <Input
            label="نام"
            value={draft.name}
            error={fieldErrors.name}
            onChange={(e) => {
              clearFieldError('name')
              setDraft({ ...draft, name: e.target.value })
            }}
          />
          <Input
            label="نام کاربری"
            value={draft.username}
            error={fieldErrors.username}
            onChange={(e) => {
              clearFieldError('username')
              setDraft({ ...draft, username: e.target.value })
            }}
          />
          <Input
            label="ایمیل"
            value={draft.email}
            error={fieldErrors.email}
            onChange={(e) => {
              clearFieldError('email')
              setDraft({ ...draft, email: e.target.value })
            }}
          />
          <Input
            label="شماره همراه"
            value={draft.mobile}
            error={fieldErrors.mobile}
            onChange={(e) => {
              clearFieldError('mobile')
              setDraft({ ...draft, mobile: e.target.value })
            }}
            placeholder="09000000000"
            hint="الزامی — برای بازیابی رمز و اطلاع‌رسانی"
            inputMode="tel"
            autoComplete="tel"
          />
          <Input
            label="رمز عبور"
            type="password"
            value={draft.password}
            error={fieldErrors.password}
            onChange={(e) => {
              clearFieldError('password')
              setDraft({ ...draft, password: e.target.value })
            }}
            hint={users.some((u) => u.id === draft.id) ? 'خالی بگذارید تا رمز قبلی حفظ شود' : undefined}
          />
          <Select
            label="وضعیت"
            value={draft.status}
            error={fieldErrors.status}
            onChange={(e) => {
              clearFieldError('status')
              setDraft({ ...draft, status: e.target.value as 'active' | 'inactive' })
            }}
            options={[
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ]}
          />
          <MultiSelect
            label="نقش‌ها"
            placeholder="انتخاب نقش از لیست..."
            emptyText="نقش دیگری برای انتخاب نیست"
            error={fieldErrors.roleIds}
            options={assignableRoles.map((role) => ({ value: role.id, label: role.name }))}
            value={draft.roleIds.filter((id) => assignableRoles.some((role) => role.id === id))}
            onChange={(roleIds) => {
              clearFieldError('roleIds')
              setDraft({
                ...draft,
                roleIds: roleIds.filter((id) => assignableRoles.some((role) => role.id === id)),
              })
            }}
          />
          <p className="text-xs text-muted">
            می‌توانید چند نقش از جمله مالک بدهید. حذف نقش/کاربر مالک فقط وقتی مجاز است که حداقل
            یک مالک فعال دیگر بماند.
          </p>
          {message ? <p className="text-sm text-danger">{message}</p> : null}
        </div>
      </Dialog>

      <Dialog
        open={transferOpen}
        title="انتقال مالکیت"
        form
        dirty={transferDirty}
        onClose={() => setTransferOpen(false)}
        footer={({ requestClose }) => (
          <>
            <Button variant="outline" onClick={requestClose}>
              انصراف
            </Button>
            {transferStep === 1 ? (
              <Button onClick={continueTransfer}>ادامه — مرحله تأیید</Button>
            ) : (
              <Button onClick={confirmTransfer}>تأیید نهایی انتقال</Button>
            )}
          </>
        )}
      >
        <div className="grid gap-3">
          <p className="text-xs text-muted">
            مرحله {transferStep.toLocaleString('fa-IR')} از ۲ — پس از انتقال، نقش مالک از شما
            برداشته و به کاربر مقصد داده می‌شود.
          </p>
          {transferStep === 1 ? (
            <>
              <Select
                label="کاربر مقصد"
                value={targetUserId}
                error={transferErrors.targetUserId}
                onChange={(e) => {
                  setTransferErrors((prev) => {
                    const next = { ...prev }
                    delete next.targetUserId
                    return next
                  })
                  setTargetUserId(e.target.value)
                }}
                options={
                  transferTargets.length
                    ? transferTargets.map((u) => ({
                        value: u.id,
                        label: `${u.name} (${u.username})`,
                      }))
                    : [{ value: '', label: 'کاربر فعالی برای انتقال نیست' }]
                }
              />
              <Input
                label="رمز عبور فعلی شما"
                type="password"
                value={transferPassword}
                error={transferErrors.password}
                onChange={(e) => {
                  setTransferErrors((prev) => {
                    const next = { ...prev }
                    delete next.password
                    return next
                  })
                  setTransferPassword(e.target.value)
                }}
              />
            </>
          ) : (
            <>
              <p className="rounded-lg bg-primary-soft px-3 py-2 text-xs text-muted">
                کد تأیید دمو: <span className="font-semibold text-heading">{OWNER_TRANSFER_DEMO_OTP}</span>
              </p>
              <Input
                label="کد تأیید دو مرحله‌ای"
                value={transferOtp}
                error={transferErrors.otp}
                onChange={(e) => {
                  setTransferErrors((prev) => {
                    const next = { ...prev }
                    delete next.otp
                    return next
                  })
                  setTransferOtp(e.target.value)
                }}
                placeholder={OWNER_TRANSFER_DEMO_OTP}
              />
            </>
          )}
          {transferMessage ? <p className="text-sm text-danger">{transferMessage}</p> : null}
        </div>
      </Dialog>
    </div>
  )
}
