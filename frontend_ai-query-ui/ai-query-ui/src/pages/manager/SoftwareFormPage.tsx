import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import {
  isFormDirty,
  useUnsavedChangesGuard,
} from '../../hooks/useUnsavedChangesGuard'
import type { Software } from '../../types/software'

export function SoftwareFormPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { softwares, upsertSoftware } = useDomain()
  const existing = softwares.find((s) => s.id === id)
  const isEdit = Boolean(existing)

  const initial = useMemo(
    () => ({
      name: existing?.name ?? '',
      code: existing?.code ?? '',
      status: existing?.status ?? ('active' as const),
    }),
    [existing],
  )

  const [name, setName] = useState(initial.name)
  const [code, setCode] = useState(initial.code)
  const [status, setStatus] = useState(initial.status)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  const dirty = isFormDirty({ name, code, status }, initial)
  const { bypassAndLeave, confirmAndLeave } = useUnsavedChangesGuard(dirty)

  const save = async () => {
    if (!user) return
    const payload: Software = {
      id: existing?.id ?? '',
      name,
      code,
      status,
      versionCount: existing?.versionCount ?? 0,
      ownerUserId: existing?.ownerUserId ?? user.id,
    }
    const result = await upsertSoftware(payload)
    if (!result.ok) {
      setErrors(result.fields ?? {})
      setMessage(result.message)
      return
    }
    bypassAndLeave('/app/software')
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'اصلاح نرم‌افزار' : 'تعریف نرم‌افزار'}
        description="ثبت نرم‌افزار — دیتابیس‌ها از منوی جداگانه تعریف می‌شوند"
        actions={
          <Button variant="outline" onClick={() => void confirmAndLeave('/app/software')}>
            بازگشت
          </Button>
        }
      />

      <form
        className="max-w-2xl space-y-4 rounded-xl border border-border bg-panel p-6"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="نام نرم‌افزار"
            value={name}
            error={errors.name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="کد"
            value={code}
            error={errors.code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Select
            label="وضعیت"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
            options={[
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ]}
          />
        </div>
        {message ? <p className="text-sm text-rose-500">{message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void confirmAndLeave('/app/software')}
          >
            انصراف
          </Button>
          <Button type="submit">{isEdit ? 'ذخیره' : 'ثبت'}</Button>
        </div>
      </form>
    </div>
  )
}
