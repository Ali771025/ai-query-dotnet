import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Star, PlugZap } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useDomain } from '../../context/DomainContext'
import { confirmDelete } from '../../lib/confirm'
import {
  isFormDirty,
  useUnsavedChangesGuard,
} from '../../hooks/useUnsavedChangesGuard'
import {
  AI_PROVIDER_KIND_LABELS,
  type AiProviderConfig,
  type AiProviderKind,
} from '../../types/aiProvider'

const KIND_OPTIONS = (
  Object.entries(AI_PROVIDER_KIND_LABELS) as [AiProviderKind, string][]
).map(([value, label]) => ({ value, label }))

type FormState = {
  name: string
  providerKind: AiProviderKind
  baseUrl: string
  apiKey: string
  modelName: string
  isActive: boolean
  isDefault: boolean
}

const emptyForm: FormState = {
  name: '',
  providerKind: 'openai_compatible',
  baseUrl: '',
  apiKey: '',
  modelName: '',
  isActive: true,
  isDefault: false,
}

function maskKey(key: string) {
  const t = key.trim()
  if (!t) return '—'
  if (t.length <= 8) return '••••'
  return `${t.slice(0, 4)}…${t.slice(-4)}`
}

export function AiProvidersPage() {
  const {
    aiProviders,
    upsertAiProvider,
    deleteAiProvider,
    setDefaultAiProvider,
    setAiProviderConnectionStatus,
  } = useDomain()

  const [editing, setEditing] = useState<AiProviderConfig | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [baseline, setBaseline] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)

  const formOpen = creating || Boolean(editing)
  const dirty = formOpen && isFormDirty(form, baseline)
  useUnsavedChangesGuard(dirty)

  const rows = useMemo(
    () =>
      aiProviders
        .slice()
        .sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
          return (b.updatedAt ?? b.createdAt ?? '').localeCompare(
            a.updatedAt ?? a.createdAt ?? '',
          )
        }),
    [aiProviders],
  )

  const openCreate = () => {
    setEditing(null)
    const next = {
      ...emptyForm,
      isDefault: aiProviders.length === 0,
    }
    setForm(next)
    setBaseline(next)
    setErrors({})
    setMessage('')
    setCreating(true)
  }

  const openEdit = (row: AiProviderConfig) => {
    setCreating(false)
    setEditing(row)
    const next: FormState = {
      name: row.name,
      providerKind: row.providerKind,
      baseUrl: row.baseUrl,
      apiKey: row.apiKey,
      modelName: row.modelName,
      isActive: row.isActive,
      isDefault: row.isDefault,
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

  const save = () => {
    const payload: AiProviderConfig = {
      id: editing?.id ?? `aip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: form.name,
      providerKind: form.providerKind,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
      modelName: form.modelName,
      isActive: form.isActive,
      isDefault: form.isDefault,
      status: editing?.status ?? 'unknown',
      createdAt: editing?.createdAt,
    }
    const result = upsertAiProvider(payload)
    if (!result.ok) {
      setErrors(result.fields ?? {})
      setMessage(result.message)
      return
    }
    closeForm()
  }

  const onDelete = async (row: AiProviderConfig) => {
    if (!(await confirmDelete(row.name))) return
    const result = deleteAiProvider(row.id)
    if (!result.ok) setMessage(result.message)
  }

  const onSetDefault = (row: AiProviderConfig) => {
    const result = setDefaultAiProvider(row.id)
    if (!result.ok) setMessage(result.message)
  }

  const onToggleActive = (row: AiProviderConfig) => {
    const result = upsertAiProvider({
      ...row,
      isActive: !row.isActive,
      // اگر غیرفعال می‌شود و پیش‌فرض بوده، upsert منطق پیش‌فرض را حفظ/ترمیم می‌کند
      isDefault: row.isDefault,
    })
    if (!result.ok) setMessage(result.message)
  }

  const onTestConnection = (row: AiProviderConfig) => {
    setTestingId(row.id)
    setMessage('')
    // mock: موفقیت اگر baseUrl و modelName پر باشند و apiKey خالی نباشد (به جز local)
    window.setTimeout(() => {
      const ok =
        Boolean(row.baseUrl.trim()) &&
        Boolean(row.modelName.trim()) &&
        (row.providerKind === 'local' || Boolean(row.apiKey.trim())) &&
        !row.baseUrl.includes('fail')
      const result = setAiProviderConnectionStatus(row.id, ok ? 'ok' : 'failed')
      if (!result.ok) setMessage(result.message)
      else {
        setMessage(
          ok
            ? `اتصال به «${row.name}» موفق بود (شبیه‌سازی).`
            : `اتصال به «${row.name}» ناموفق بود (شبیه‌سازی).`,
        )
      }
      setTestingId(null)
    }, 600)
  }

  const columns: Column<AiProviderConfig>[] = [
    {
      key: 'name',
      header: 'نام',
      render: (r) => (
        <div>
          <p className="font-medium text-heading">{r.name}</p>
          <p className="text-xs text-muted">{r.modelName}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'نوع',
      render: (r) => AI_PROVIDER_KIND_LABELS[r.providerKind],
    },
    {
      key: 'baseUrl',
      header: 'آدرس پایه',
      render: (r) => (
        <code className="break-all text-xs text-muted">{r.baseUrl || '—'}</code>
      ),
    },
    {
      key: 'key',
      header: 'کلید',
      render: (r) => (
        <code className="rounded bg-primary-soft px-1.5 py-0.5 text-xs">
          {maskKey(r.apiKey)}
        </code>
      ),
    },
    {
      key: 'flags',
      header: 'وضعیت',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={r.isActive ? 'success' : 'neutral'}>
            {r.isActive ? 'فعال' : 'غیرفعال'}
          </Badge>
          {r.isDefault ? <Badge variant="info">پیش‌فرض</Badge> : null}
          {r.status === 'ok' ? <Badge variant="success">اتصال OK</Badge> : null}
          {r.status === 'failed' ? (
            <Badge variant="danger">اتصال ناموفق</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={r.isDefault || !r.isActive}
            onClick={() => onSetDefault(r)}
            title="تنظیم به‌عنوان پیش‌فرض"
          >
            <Star className="size-3.5" />
            پیش‌فرض
          </Button>
          <Button size="sm" variant="outline" onClick={() => onToggleActive(r)}>
            {r.isActive ? 'غیرفعال' : 'فعال'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={testingId === r.id}
            onClick={() => onTestConnection(r)}
          >
            <PlugZap className="size-3.5" />
            {testingId === r.id ? '...' : 'تست اتصال'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
            <Pencil className="size-3.5" />
            ویرایش
          </Button>
          <Button size="sm" variant="outline" onClick={() => void onDelete(r)}>
            <Trash2 className="size-3.5" />
            حذف
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="مدل‌های AI پلتفرم"
        description="پیکربندی ارائه‌دهندگان خارجی یا محلی؛ همهٔ درخواست‌ها فقط از مدل پیش‌فرض پلتفرم استفاده می‌کنند"
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            ارائه‌دهنده جدید
          </Button>
        }
      />

      {message ? (
        <p className="mb-3 text-sm text-muted" role="status">
          {message}
        </p>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی نام، مدل یا آدرس..."
        searchFn={(row, q) =>
          [row.name, row.modelName, row.baseUrl, AI_PROVIDER_KIND_LABELS[row.providerKind]].some(
            (v) => v.toLowerCase().includes(q.toLowerCase()),
          )
        }
        emptyMessage="هنوز ارائه‌دهنده‌ای تعریف نشده است."
      />

      <Dialog
        open={formOpen}
        title={editing ? 'ویرایش ارائه‌دهنده AI' : 'ثبت ارائه‌دهنده AI'}
        onClose={closeForm}
        form
        dirty={dirty}
        panelClassName="max-w-xl"
        footer={(api) => (
          <>
            <Button variant="outline" onClick={api.requestClose}>
              انصراف
            </Button>
            <Button onClick={save}>{editing ? 'ذخیره' : 'ثبت'}</Button>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="نام نمایشی"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <Select
            label="نوع ارائه‌دهنده"
            options={KIND_OPTIONS}
            value={form.providerKind}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                providerKind: e.target.value as AiProviderKind,
              }))
            }
          />
          <Input
            label="نام مدل"
            value={form.modelName}
            error={errors.modelName}
            placeholder="مثلاً gpt-4o-mini"
            onChange={(e) =>
              setForm((f) => ({ ...f, modelName: e.target.value }))
            }
          />
          <div className="sm:col-span-2">
            <Input
              label="آدرس پایه (Base URL)"
              value={form.baseUrl}
              error={errors.baseUrl}
              placeholder="https://api.openai.com/v1"
              onChange={(e) =>
                setForm((f) => ({ ...f, baseUrl: e.target.value }))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="کلید API"
              type="password"
              value={form.apiKey}
              hint={
                form.providerKind === 'local'
                  ? 'برای مدل محلی اختیاری است'
                  : undefined
              }
              onChange={(e) =>
                setForm((f) => ({ ...f, apiKey: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            فعال
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) =>
                setForm((f) => ({ ...f, isDefault: e.target.checked }))
              }
            />
            پیش‌فرض پلتفرم
          </label>
        </div>
        {message && formOpen ? (
          <p className="mt-3 text-sm text-danger">{message}</p>
        ) : null}
      </Dialog>
    </div>
  )
}
