import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import { useDomain } from '../../context/DomainContext'
import { confirmDelete } from '../../lib/confirm'
import {
  isDatabaseInVersion,
  orderVersionsForSoftware,
} from '../../lib/databases'
import {
  isFormDirty,
  useUnsavedChangesGuard,
} from '../../hooks/useUnsavedChangesGuard'
import type { SoftwareDatabase } from '../../types/software'
import type { Status } from '../../types/common'

const emptyForm = {
  name: '',
  code: '',
  status: 'active' as Status,
  description: '',
  introducedInVersionId: '',
  removedInVersionId: '',
}

export function DatabasesPage() {
  const {
    accessibleSoftwares,
    databases,
    versions,
    upsertDatabase,
    deleteDatabase,
  } = useDomain()

  const [softwareId, setSoftwareId] = useState(accessibleSoftwares[0]?.id ?? '')
  const [editing, setEditing] = useState<SoftwareDatabase | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [baseline, setBaseline] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [previewVersionId, setPreviewVersionId] = useState('')

  const formOpen = creating || Boolean(editing)
  const dirty = formOpen && isFormDirty(form, baseline)
  useUnsavedChangesGuard(dirty)

  const softwareVersions = useMemo(
    () => orderVersionsForSoftware(versions, softwareId),
    [versions, softwareId],
  )

  const orderedVersionIds = softwareVersions.map((v) => v.id)

  const versionOptions = [
    { value: '', label: '— بدون محدودیت —' },
    ...softwareVersions.map((v) => ({
      value: v.id,
      label: `${v.version} (${v.releasedAt})`,
    })),
  ]

  const rows = databases.filter((d) => d.softwareId === softwareId)

  const versionLabel = (id?: string) => {
    if (!id) return '—'
    const v = versions.find((x) => x.id === id)
    return v ? v.version : id
  }

  const openCreate = () => {
    if (!softwareId) return
    setEditing(null)
    setForm(emptyForm)
    setBaseline(emptyForm)
    setErrors({})
    setMessage('')
    setCreating(true)
  }

  const openEdit = (db: SoftwareDatabase) => {
    setCreating(false)
    setEditing(db)
    const next = {
      name: db.name,
      code: db.code,
      status: db.status,
      description: db.description ?? '',
      introducedInVersionId: db.introducedInVersionId ?? '',
      removedInVersionId: db.removedInVersionId ?? '',
    }
    setForm(next)
    setBaseline(next)
    setErrors({})
    setMessage('')
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
    setErrors({})
    setMessage('')
  }

  const save = async () => {
    const payload: SoftwareDatabase = {
      id: editing?.id ?? '',
      softwareId,
      name: form.name,
      code: form.code,
      status: form.status,
      description: form.description,
      introducedInVersionId: form.introducedInVersionId || undefined,
      removedInVersionId: form.removedInVersionId || undefined,
    }
    const result = await upsertDatabase(payload)
    if (!result.ok) {
      setErrors(result.fields ?? {})
      setMessage(result.message)
      return
    }
    closeForm()
  }

  const columns: Column<SoftwareDatabase>[] = [
    {
      key: 'name',
      header: 'دیتابیس',
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">{r.code}</p>
        </div>
      ),
    },
    {
      key: 'from',
      header: 'از نسخه',
      render: (r) => versionLabel(r.introducedInVersionId) || 'از ابتدا',
    },
    {
      key: 'until',
      header: 'تا قبل از',
      render: (r) =>
        r.removedInVersionId ? versionLabel(r.removedInVersionId) : 'ادامه دارد',
    },
    {
      key: 'inPreview',
      header: 'در نسخه انتخابی',
      render: (r) => {
        if (!previewVersionId) return '—'
        const ok = isDatabaseInVersion(r, previewVersionId, orderedVersionIds)
        return (
          <Badge variant={ok ? 'success' : 'neutral'}>
            {ok ? 'هست' : 'نیست'}
          </Badge>
        )
      },
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
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (!(await confirmDelete(r.name))) return
              void deleteDatabase(r.id)
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
        title="دیتابیس‌ها"
        description="هر نرم‌افزار چند دیتابیس دارد؛ بازهٔ نسخه مشخص می‌کند در کدام نسخه‌ها موجود است"
        actions={
          <Button onClick={openCreate} disabled={!softwareId}>
            <Plus className="size-4" />
            دیتابیس جدید
          </Button>
        }
      />

      <div className="mb-4 grid max-w-3xl gap-4 sm:grid-cols-2">
        <Select
          label="نرم‌افزار والد"
          value={softwareId}
          onChange={(e) => {
            const nextSoftwareId = e.target.value
            setSoftwareId(nextSoftwareId)
            setPreviewVersionId((prev) => {
              if (!prev) return ''
              const belongs = versions.some(
                (v) => v.id === prev && v.softwareId === nextSoftwareId,
              )
              return belongs ? prev : ''
            })
            // فرم دیتابیس متعلق به نرم‌افزار قبلی است — ببند یا نسخه‌های نامعتبر را پاک کن
            if (editing) {
              closeForm()
            } else if (creating) {
              setForm((f) => ({
                ...f,
                introducedInVersionId: '',
                removedInVersionId: '',
              }))
            }
          }}
          options={accessibleSoftwares.map((s) => ({
            value: s.id,
            label: s.name,
          }))}
          hint="دیتابیس‌های همین نرم‌افزار نمایش داده می‌شوند"
        />
        <Select
          label="پیش‌نمایش نسخه"
          value={previewVersionId}
          onChange={(e) => setPreviewVersionId(e.target.value)}
          isSearchable
          isClearable
          placeholder="جستجو یا انتخاب نسخه..."
          emptyText={
            softwareVersions.length === 0
              ? 'نسخه‌ای برای این نرم‌افزار ثبت نشده'
              : 'نسخه‌ای یافت نشد'
          }
          options={softwareVersions.map((v) => ({
            value: v.id,
            label: `${v.version} (${v.releasedAt})`,
          }))}
          hint="ستون «در نسخه انتخابی» بر اساس این نسخه پر می‌شود"
        />
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی نام یا کد دیتابیس..."
        searchFn={(row, q) =>
          [row.name, row.code, row.description ?? ''].some((v) => v.includes(q))
        }
        filters={[
          {
            key: 'name',
            label: 'نام',
            type: 'text',
            placeholder: 'نام دیتابیس...',
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

      <Dialog
        open={formOpen}
        title={editing ? 'اصلاح دیتابیس' : 'ثبت دیتابیس'}
        form
        dirty={dirty}
        onClose={closeForm}
        footer={({ requestClose }) => (
          <>
            <Button variant="outline" onClick={requestClose}>
              انصراف
            </Button>
            <Button onClick={save}>{editing ? 'ذخیره' : 'ثبت'}</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            نرم‌افزار:{' '}
            <span className="font-medium text-heading">
              {accessibleSoftwares.find((s) => s.id === softwareId)?.name}
            </span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="نام دیتابیس"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="کد"
              value={form.code}
              error={errors.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <Select
              label="از نسخه (معرفی)"
              value={form.introducedInVersionId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  introducedInVersionId: e.target.value,
                }))
              }
              options={versionOptions}
              isSearchable
              isClearable
              placeholder="جستجو یا انتخاب نسخه..."
              emptyText={
                softwareVersions.length === 0
                  ? 'نسخه‌ای برای این نرم‌افزار ثبت نشده'
                  : 'نسخه‌ای یافت نشد'
              }
              hint="خالی = از اولین نسخه موجود"
            />
            <Select
              label="حذف از نسخه"
              value={form.removedInVersionId}
              error={errors.removedInVersionId}
              onChange={(e) =>
                setForm((f) => ({ ...f, removedInVersionId: e.target.value }))
              }
              options={versionOptions}
              isSearchable
              isClearable
              placeholder="جستجو یا انتخاب نسخه..."
              emptyText={
                softwareVersions.length === 0
                  ? 'نسخه‌ای برای این نرم‌افزار ثبت نشده'
                  : 'نسخه‌ای یافت نشد'
              }
              hint="از این نسخه به بعد دیگر وجود ندارد"
            />
            <Select
              label="وضعیت"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as Status,
                }))
              }
              options={[
                { value: 'active', label: 'فعال' },
                { value: 'inactive', label: 'غیرفعال' },
              ]}
            />
          </div>
          <Textarea
            label="توضیح"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          {message ? <p className="text-sm text-rose-500">{message}</p> : null}
        </div>
      </Dialog>
    </div>
  )
}
