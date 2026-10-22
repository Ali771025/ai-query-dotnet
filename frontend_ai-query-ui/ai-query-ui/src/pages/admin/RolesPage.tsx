import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { useAuth } from '../../context/AuthContext'
import {
  ALL_PERMISSION_IDS,
  PERMISSION_ACTIONS,
  getRoleMenuModules,
  permissionId,
} from '../../data/permissions'
import { OWNER_ROLE_ID } from '../../data/seed'
import { confirmDelete } from '../../lib/confirm'
import {
  isFormDirty,
  useUnsavedChangesGuard,
} from '../../hooks/useUnsavedChangesGuard'
import type {
  MenuEntity,
  MenuModule,
  MenuPart,
  PermissionAction,
  Role,
} from '../../types/rbac'

function emptyRole(): Role {
  return {
    id: `role-${Date.now()}`,
    name: '',
    description: '',
    permissionIds: [],
    isSystem: false,
  }
}

function roleFormSnapshot(role: Role) {
  return {
    name: role.name,
    description: role.description,
    permissionIds: [...role.permissionIds].sort(),
  }
}

function actionLabel(action: PermissionAction): string {
  return PERMISSION_ACTIONS.find((a) => a.id === action)?.label ?? action
}

function entityPermissionIds(entity: MenuEntity): string[] {
  return entity.actions.map((a) => permissionId(entity.id, a))
}

function partPermissionIds(part: MenuPart): string[] {
  return part.entities.flatMap(entityPermissionIds)
}

function modulePermissionIds(mod: MenuModule): string[] {
  return mod.parts.flatMap(partPermissionIds)
}

function countSelected(ids: string[], selected: string[]): number {
  return ids.filter((id) => selected.includes(id)).length
}

function moduleMatchesQuery(mod: MenuModule, q: string): boolean {
  if (!q) return true
  if (mod.label.includes(q)) return true
  return mod.parts.some(
    (part) =>
      part.label.includes(q) ||
      part.entities.some(
        (entity) =>
          entity.label.includes(q) ||
          entity.actions.some((a) => actionLabel(a).includes(q)),
      ),
  )
}

function filterModuleByQuery(mod: MenuModule, q: string): MenuModule {
  if (!q || mod.label.includes(q)) return mod
  return {
    ...mod,
    parts: mod.parts
      .map((part) => {
        if (part.label.includes(q)) return part
        return {
          ...part,
          entities: part.entities.filter(
            (entity) =>
              entity.label.includes(q) ||
              entity.actions.some((a) => actionLabel(a).includes(q)),
          ),
        }
      })
      .filter((part) => part.entities.length > 0),
  }
}

function PermissionChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'bg-primary text-primary-fg shadow-sm'
          : 'border border-border bg-panel text-muted hover:bg-primary-soft hover:text-heading'
      }`}
    >
      {label}
    </button>
  )
}

export function RolePermissionEditor({
  draft,
  locked,
  message,
  nameError,
  moduleQuery,
  grantablePermissionIds,
  onModuleQueryChange,
  onDraftChange,
  onToggleIds,
  onSelectAll,
  onClearAll,
}: {
  draft: Role
  locked: boolean
  message: string
  nameError?: string
  moduleQuery: string
  grantablePermissionIds: string[]
  onModuleQueryChange: (q: string) => void
  onDraftChange: (next: Role) => void
  onToggleIds: (ids: string[], mode: 'toggle-one' | 'set-all' | 'clear-all') => void
  onSelectAll: () => void
  onClearAll: () => void
}) {
  const roleModules = useMemo(() => {
    const all = getRoleMenuModules()
    return all
      .map((mod) => ({
        ...mod,
        parts: mod.parts
          .map((part) => ({
            ...part,
            entities: part.entities
              .map((entity) => ({
                ...entity,
                actions: entity.actions.filter((a) =>
                  grantablePermissionIds.includes(permissionId(entity.id, a)),
                ),
              }))
              .filter((entity) => entity.actions.length > 0),
          }))
          .filter((part) => part.entities.length > 0),
      }))
      .filter((mod) => mod.parts.length > 0)
  }, [grantablePermissionIds])
  const q = moduleQuery.trim()

  const visibleModules = useMemo(() => {
    return roleModules
      .filter((mod) => moduleMatchesQuery(mod, q))
      .map((mod) => filterModuleByQuery(mod, q))
  }, [roleModules, q])

  const [selectedModuleId, setSelectedModuleId] = useState(
    () => visibleModules[0]?.id ?? '',
  )
  const [collapsedParts, setCollapsedParts] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!visibleModules.some((m) => m.id === selectedModuleId)) {
      setSelectedModuleId(visibleModules[0]?.id ?? '')
    }
  }, [visibleModules, selectedModuleId])

  useEffect(() => {
    if (q) setCollapsedParts({})
  }, [q])

  const selectedModule = visibleModules.find((m) => m.id === selectedModuleId) ?? null

  const togglePermission = (id: string) => {
    if (locked) return
    onToggleIds([id], 'toggle-one')
  }

  const setIds = (ids: string[], on: boolean) => {
    if (locked) return
    onToggleIds(ids, on ? 'set-all' : 'clear-all')
  }

  const modulesWithSelection = roleModules.filter(
    (mod) => countSelected(modulePermissionIds(mod), draft.permissionIds) > 0,
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <Input
          label="نام نقش"
          value={draft.name}
          error={nameError}
          onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
          disabled={locked}
        />
        <Input
          label="جستجو در ماژول، قسمت یا عملیات"
          value={moduleQuery}
          onChange={(e) => onModuleQueryChange(e.target.value)}
          placeholder="مثلاً کاربران، گزارش، مشاهده..."
        />
      </div>
      <Textarea
        label="توضیحات"
        value={draft.description}
        onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
      />

      {locked ? (
        <p className="rounded-lg bg-primary-soft px-3 py-2 text-xs text-muted">
          نقش مالک سیستمی است و همیشه تمام دسترسی‌ها را دارد. داشبورد نیاز به دسترسی جدا ندارد.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            ساختار دسترسی عین منوی سامانه است؛ با تغییر منو در درخت داده، اینجا هم به‌روز می‌شود.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
              انتخاب همه
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
              پاک‌کردن همه
            </Button>
          </div>
        </div>
      )}

      {/* در RTL ستون اول = راست */}
      <div className="grid min-h-[420px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-border bg-panel">
            <p className="border-b border-border bg-surface px-3 py-2 text-xs font-semibold text-heading">
              ماژول‌های اصلی
            </p>
            {visibleModules.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted">موردی یافت نشد.</p>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto">
                {visibleModules.map((mod) => {
                  const total = modulePermissionIds(mod).length
                  const selected = countSelected(modulePermissionIds(mod), draft.permissionIds)
                  const active = mod.id === selectedModuleId
                  return (
                    <li key={mod.id} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setSelectedModuleId(mod.id)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start text-sm transition ${
                          active
                            ? 'bg-primary-soft font-medium text-accent'
                            : 'text-ink hover:bg-primary-soft/50'
                        }`}
                      >
                        <span>{mod.label}</span>
                        {selected > 0 || locked ? (
                          <Badge variant={active ? 'info' : 'neutral'}>
                            {(locked ? total : selected).toLocaleString('fa-IR')}
                          </Badge>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 text-xs font-semibold text-heading">خلاصه دسترسی نقش</p>
            <p className="mb-2 text-xs text-muted">
              {locked
                ? `تمام ${ALL_PERMISSION_IDS.length.toLocaleString('fa-IR')} دسترسی`
                : `${draft.permissionIds.length.toLocaleString('fa-IR')} از ${grantablePermissionIds.length.toLocaleString('fa-IR')}`}
            </p>
            {locked ? (
              <p className="text-xs text-muted">مالک سامانه — پوشش کامل همه ماژول‌ها.</p>
            ) : modulesWithSelection.length === 0 ? (
              <p className="text-xs text-muted">هنوز دسترسی‌ای انتخاب نشده است.</p>
            ) : (
              <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
                {modulesWithSelection.map((mod) => {
                  const total = modulePermissionIds(mod).length
                  const selected = countSelected(modulePermissionIds(mod), draft.permissionIds)
                  return (
                    <li key={mod.id} className="flex justify-between gap-2 text-ink">
                      <span>{mod.label}</span>
                      <span className="text-muted">
                        {selected.toLocaleString('fa-IR')}/{total.toLocaleString('fa-IR')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="overflow-hidden rounded-xl border border-border bg-panel">
          {!selectedModule ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              یک ماژول از سمت راست انتخاب کنید.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3">
                <h4 className="text-sm font-semibold text-heading">{selectedModule.label}</h4>
                {!locked ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const ids = modulePermissionIds(selectedModule)
                      const allOn = ids.every((id) => draft.permissionIds.includes(id))
                      setIds(ids, !allOn)
                    }}
                  >
                    {modulePermissionIds(selectedModule).every((id) =>
                      draft.permissionIds.includes(id),
                    )
                      ? 'لغو همه ماژول'
                      : 'همه این ماژول'}
                  </Button>
                ) : null}
              </div>

              <div className="divide-y divide-border">
                {selectedModule.parts.map((part) => {
                  const collapsed = Boolean(collapsedParts[part.id]) && !q
                  const partIds = partPermissionIds(part)
                  const partSelected = countSelected(partIds, draft.permissionIds)
                  const partAllOn = partIds.every((id) => draft.permissionIds.includes(id))

                  return (
                    <div key={part.id}>
                      <div className="flex items-center gap-2 bg-surface/60 px-4 py-2.5">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-start"
                          onClick={() =>
                            setCollapsedParts((prev) => ({
                              ...prev,
                              [part.id]: !prev[part.id],
                            }))
                          }
                        >
                          <ChevronDown
                            className={`size-4 shrink-0 text-muted transition ${collapsed ? '-rotate-90' : ''}`}
                          />
                          <span className="text-sm font-medium text-heading">{part.label}</span>
                          {partSelected > 0 ? (
                            <Badge variant="neutral">
                              {partSelected.toLocaleString('fa-IR')}
                            </Badge>
                          ) : null}
                        </button>
                        {!locked ? (
                          <button
                            type="button"
                            className="shrink-0 text-[11px] text-muted hover:text-heading"
                            onClick={() => setIds(partIds, !partAllOn)}
                          >
                            {partAllOn ? 'لغو همه قسمت' : 'همه این قسمت'}
                          </button>
                        ) : null}
                      </div>

                      {!collapsed ? (
                        <ul className="space-y-4 px-4 py-3">
                          {part.entities.map((entity) => {
                            const ids = entityPermissionIds(entity)
                            const allOn = ids.every((id) => draft.permissionIds.includes(id))
                            return (
                              <li key={entity.id}>
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-ink">{entity.label}</p>
                                  {!locked ? (
                                    <button
                                      type="button"
                                      className="text-[11px] text-muted hover:text-heading"
                                      onClick={() => setIds(ids, !allOn)}
                                    >
                                      {allOn ? 'لغو همه' : 'همه'}
                                    </button>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {entity.actions.map((action) => {
                                    const id = permissionId(entity.id, action)
                                    const active =
                                      locked || draft.permissionIds.includes(id)
                                    return (
                                      <PermissionChip
                                        key={action}
                                        label={actionLabel(action)}
                                        active={active}
                                        disabled={locked}
                                        onClick={() => togglePermission(id)}
                                      />
                                    )
                                  })}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {message ? <p className="text-sm text-danger">{message}</p> : null}
    </div>
  )
}

export function RolesPage() {
  const { roles, upsertRole, deleteRole, canEditRole, grantablePermissionIds } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Role>(emptyRole())
  const [baseline, setBaseline] = useState(() => roleFormSnapshot(emptyRole()))
  const [message, setMessage] = useState('')
  const [nameError, setNameError] = useState('')
  const [moduleQuery, setModuleQuery] = useState('')

  /** نقش‌های سفارشی شرکت در صفحه پلتفرم نشان داده نمی‌شوند */
  const platformRoles = useMemo(
    () => roles.filter((r) => !r.ownerUserId),
    [roles],
  )

  const isEdit = platformRoles.some((r) => r.id === draft.id)
  const locked = draft.id === OWNER_ROLE_ID || (isEdit && !canEditRole(draft))
  const dirty =
    open && !locked && isFormDirty(roleFormSnapshot(draft), baseline)
  const { confirmAndStayOrDiscard } = useUnsavedChangesGuard(dirty)

  const openCreate = () => {
    const next = emptyRole()
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
    const allowed = ids.filter((id) => grantablePermissionIds.includes(id))
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
    setDraft((prev) => ({ ...prev, permissionIds: [...grantablePermissionIds] }))
  }

  const clearAll = () => {
    if (locked) return
    setDraft((prev) => ({ ...prev, permissionIds: [] }))
  }

  const save = () => {
    if (locked) {
      setMessage('نقش مالک سامانه‌ای است و قابل ویرایش نیست.')
      return
    }
    const result = upsertRole(draft)
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
      key: 'system',
      header: 'نوع',
      render: (r) => (
        <Badge variant={r.isSystem ? 'info' : 'neutral'}>
          {r.isSystem ? 'سیستمی' : 'قابل ویرایش'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) => {
        const editable = canEditRole(r)
        if (r.id === OWNER_ROLE_ID || r.isSystem) {
          return (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="مشاهده">
                <Pencil className="size-3.5" />
              </Button>
              <span className="self-center text-xs text-muted">سیستمی</span>
            </div>
          )
        }
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
          title={locked ? 'مشاهده نقش مالک' : isEdit ? 'ویرایش نقش' : 'نقش جدید'}
          description={
            locked
              ? 'نقش مالک سیستمی است و قابل ویرایش یا تخصیص دستی نیست'
              : 'ماژول‌ها عین منو — قسمت‌ها آکاردئونی و عملیات داخل جزئیات'
          }
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
          grantablePermissionIds={grantablePermissionIds}
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
        title="نقش‌ها و دسترسی‌ها"
        description="تعریف نقش هم‌تراز با ساختار منو — داشبورد برای همه کاربران در دسترس است"
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            نقش جدید
          </Button>
        }
      />

      {message ? <p className="mb-3 text-sm text-danger">{message}</p> : null}

      <DataTable
        rows={platformRoles}
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
          {
            key: 'system',
            label: 'نوع',
            type: 'select',
            className: 'w-40',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'system', label: 'سیستمی' },
              { value: 'editable', label: 'قابل ویرایش' },
            ],
            filterFn: (row, value) =>
              value === 'system' ? Boolean(row.isSystem) : !row.isSystem,
          },
        ]}
      />
    </div>
  )
}
