import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { useAuth } from '../../context/AuthContext'
import { companyAssignablePermissionIds } from '../../data/permissions'
import { confirmDelete } from '../../lib/confirm'
import {
  isFormDirty,
  useUnsavedChangesGuard,
} from '../../hooks/useUnsavedChangesGuard'
import type { Role } from '../../types/rbac'
import { RolePermissionEditor } from '../admin/RolesPage'

function emptyCompanyRole(ownerUserId: string): Role {
  return {
    id: `role-co-${ownerUserId}-${Date.now()}`,
    name: '',
    description: '',
    permissionIds: [],
    isSystem: false,
    ownerUserId,
    createdByUserId: ownerUserId,
  }
}

function roleFormSnapshot(role: Role) {
  return {
    name: role.name,
    description: role.description,
    permissionIds: [...role.permissionIds].sort(),
  }
}

export function CompanyRolesPage() {
  const { user, roles, upsertRole, deleteRole, canEditRole } = useAuth()
  const envelope = useMemo(() => companyAssignablePermissionIds(), [])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Role>(() =>
    emptyCompanyRole(user?.id ?? 'unknown'),
  )
  const [baseline, setBaseline] = useState(() =>
    roleFormSnapshot(emptyCompanyRole(user?.id ?? 'unknown')),
  )
  const [message, setMessage] = useState('')
  const [nameError, setNameError] = useState('')
  const [moduleQuery, setModuleQuery] = useState('')

  const myRoles = useMemo(
    () => roles.filter((r) => r.ownerUserId === user?.id),
    [roles, user?.id],
  )

  const isEdit = myRoles.some((r) => r.id === draft.id)
  const locked = isEdit && !canEditRole(draft)
  const dirty =
    open && !locked && isFormDirty(roleFormSnapshot(draft), baseline)
  const { confirmAndStayOrDiscard } = useUnsavedChangesGuard(dirty)

  const openCreate = () => {
    if (!user) return
    const next = emptyCompanyRole(user.id)
    setDraft(next)
    setBaseline(roleFormSnapshot(next))
    setMessage('')
    setNameError('')
    setModuleQuery('')
    setOpen(true)
  }

  const openEdit = (role: Role) => {
    setDraft({ ...role })
    setBaseline(roleFormSnapshot(role))
    setMessage('')
    setNameError('')
    setModuleQuery('')
    setOpen(true)
  }

  const closeEditor = () => {
    void confirmAndStayOrDiscard().then((ok) => {
      if (!ok) return
      setOpen(false)
      setMessage('')
      setNameError('')
    })
  }

  const onToggleIds = (ids: string[], mode: 'toggle-one' | 'set-all' | 'clear-all') => {
    if (locked) return
    const allowed = ids.filter((id) => envelope.includes(id))
    setDraft((prev) => {
      if (mode === 'toggle-one') {
        const id = allowed[0]
        if (!id) return prev
        return {
          ...prev,
          permissionIds: prev.permissionIds.includes(id)
            ? prev.permissionIds.filter((x) => x !== id)
            : [...prev.permissionIds, id],
        }
      }
      if (mode === 'clear-all') {
        return {
          ...prev,
          permissionIds: prev.permissionIds.filter((id) => !allowed.includes(id)),
        }
      }
      return { ...prev, permissionIds: [...new Set([...prev.permissionIds, ...allowed])] }
    })
  }

  const selectAll = () => {
    if (locked) return
    setDraft((prev) => ({ ...prev, permissionIds: [...envelope] }))
  }

  const clearAll = () => {
    if (locked) return
    setDraft((prev) => ({ ...prev, permissionIds: [] }))
  }

  const save = () => {
    if (!user || locked) return
    const result = upsertRole({
      ...draft,
      ownerUserId: user.id,
      isSystem: false,
    })
    if (!result.ok) {
      if (result.fields?.name || result.field === 'name') {
        setNameError(result.fields?.name ?? result.message)
        setMessage('')
      } else {
        setNameError('')
        setMessage(result.message)
      }
      return
    }
    setNameError('')
    setOpen(false)
  }

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'نقش',
      render: (r) => (
        <div>
          <p className="font-medium text-heading">{r.name}</p>
          <p className="text-xs text-muted">{r.description}</p>
        </div>
      ),
    },
    {
      key: 'count',
      header: 'تعداد دسترسی',
      render: (r) => r.permissionIds.length.toLocaleString('fa-IR'),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) => {
        const editable = canEditRole(r)
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
              <Pencil className="size-3.5" />
            </Button>
            {editable ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void (async () => {
                    if (!(await confirmDelete(r.name))) return
                    const result = deleteRole(r.id)
                    if (!result.ok) setMessage(result.message)
                  })()
                }}
              >
                <Trash2 className="size-3.5 text-danger" />
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  if (open) {
    return (
      <div>
        <PageHeader
          title={isEdit ? 'ویرایش نقش شرکت' : 'نقش جدید شرکت'}
          description="دسترسی‌ها فقط در محدودهٔ شرکت شما — سراسری برای همه نرم‌افزارهای شرکت"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeEditor}>
                بازگشت
              </Button>
              {!locked ? <Button onClick={save}>ذخیره</Button> : null}
            </div>
          }
        />
        <RolePermissionEditor
          draft={draft}
          locked={locked}
          message={message}
          nameError={nameError}
          moduleQuery={moduleQuery}
          grantablePermissionIds={envelope}
          onModuleQueryChange={setModuleQuery}
          onDraftChange={(next) => {
            if (next.name !== draft.name) setNameError('')
            setDraft(next)
          }}
          onToggleIds={onToggleIds}
          onSelectAll={selectAll}
          onClearAll={clearAll}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="نقش‌های من"
        description="نقش‌های سراسری شرکت برای تخصیص به پشتیبان‌ها"
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            نقش جدید
          </Button>
        }
      />

      {message ? <p className="mb-3 text-sm text-danger">{message}</p> : null}

      <DataTable
        rows={myRoles}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی نقش یا توضیح..."
        searchFn={(row, q) => [row.name, row.description].some((v) => v.includes(q))}
        filters={[
          {
            key: 'name',
            label: 'نقش',
            type: 'text',
            placeholder: 'نام نقش...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.name.includes(value),
          },
          {
            key: 'desc',
            label: 'توضیح',
            type: 'text',
            placeholder: 'توضیح...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.description.includes(value),
          },
        ]}
      />
    </div>
  )
}
