import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
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
import {
  allowedReferenceVersionNumbers,
  canonicalizeVersionReference,
  resolveReferenceRoot,
} from '../../lib/versionReferences'
import type { SoftwareVersion } from '../../types/software'

export function VersionFormPage() {
  const { id } = useParams()
  const { user, activeSoftwareId } = useAuth()
  const { ownedSoftwares, versions, upsertVersion } = useDomain()

  /** فقط نرم‌افزارهایی که مالکشان کاربر جاری است */
  const mySoftwares = useMemo(
    () => (user ? ownedSoftwares(user.id) : []),
    [ownedSoftwares, user],
  )

  const mySoftwareIds = useMemo(
    () => new Set(mySoftwares.map((s) => s.id)),
    [mySoftwares],
  )

  const existing = versions.find((v) => v.id === id)
  const isEdit = Boolean(existing)
  const forbidden =
    isEdit && Boolean(existing) && !mySoftwareIds.has(existing!.softwareId)

  const defaultSoftwareId = useMemo(() => {
    if (existing && mySoftwareIds.has(existing.softwareId)) {
      return existing.softwareId
    }
    if (activeSoftwareId && mySoftwareIds.has(activeSoftwareId)) {
      return activeSoftwareId
    }
    return mySoftwares[0]?.id ?? ''
  }, [existing, mySoftwareIds, activeSoftwareId, mySoftwares])

  const initial = useMemo(
    () => ({
      softwareId: defaultSoftwareId,
      version: existing?.version ?? '',
      status: existing?.status ?? ('active' as const),
      refVersion: existing?.referencedVersions[0] ?? '',
    }),
    [defaultSoftwareId, existing],
  )

  const [softwareId, setSoftwareId] = useState(initial.softwareId)
  const [version, setVersion] = useState(initial.version)
  const [status, setStatus] = useState(initial.status)
  const [refVersion, setRefVersion] = useState(initial.refVersion)
  /** نسخهٔ میانی انتخاب‌شده قبل از canonicalize (برای راهنما) */
  const [pickedRefVersion, setPickedRefVersion] = useState('')
  const [message, setMessage] = useState('')

  /** گزینه‌های ارجاع بدون هدف‌های حلقه‌ساز */
  const siblingVersionOptions = useMemo(() => {
    const allowed = new Set(
      allowedReferenceVersionNumbers(
        versions,
        softwareId,
        version,
        existing?.id,
      ),
    )
    return versions
      .filter(
        (v) =>
          v.softwareId === softwareId &&
          allowed.has(v.version.trim()) &&
          (!existing || v.id !== existing.id),
      )
      .slice()
      .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt, 'fa'))
      .map((v) => {
        const num = v.version.trim()
        const root = resolveReferenceRoot(versions, softwareId, num, version)
        const label =
          root && root !== num
            ? `${v.version} (${v.releasedAt}) → ریشه ${root}`
            : `${v.version} (${v.releasedAt})`
        return { value: v.version, label }
      })
  }, [versions, softwareId, version, existing])

  const refStackHint = useMemo(() => {
    if (!pickedRefVersion.trim() || !refVersion.trim()) return undefined
    if (pickedRefVersion.trim() === refVersion.trim()) return undefined
    return `نسخهٔ ${pickedRefVersion.trim()} به ریشهٔ پشته تبدیل شد؛ ارجاع ذخیره‌شده: ${refVersion.trim()}.`
  }, [pickedRefVersion, refVersion])

  useEffect(() => {
    if (softwareId && !mySoftwareIds.has(softwareId)) {
      setSoftwareId(defaultSoftwareId)
    }
  }, [softwareId, mySoftwareIds, defaultSoftwareId])

  useEffect(() => {
    if (
      refVersion &&
      !siblingVersionOptions.some((o) => o.value === refVersion)
    ) {
      setRefVersion('')
      setPickedRefVersion('')
    }
  }, [siblingVersionOptions, refVersion])

  const dirty =
    !forbidden && isFormDirty({ softwareId, version, status, refVersion }, initial)
  const { bypassAndLeave, confirmAndLeave } = useUnsavedChangesGuard(dirty)

  if (forbidden) {
    return <Navigate to="/app/versions" replace />
  }

  const applyReferenceSelection = (selected: string) => {
    const trimmed = selected.trim()
    if (!trimmed) {
      setRefVersion('')
      setPickedRefVersion('')
      return true
    }
    const canon = canonicalizeVersionReference(
      versions,
      softwareId,
      version,
      trimmed,
    )
    if (!canon.ok) {
      setMessage(canon.message)
      return false
    }
    setPickedRefVersion(trimmed)
    setRefVersion(canon.root)
    setMessage('')
    return true
  }

  const save = async () => {
    if (!softwareId || !mySoftwareIds.has(softwareId)) {
      setMessage('فقط برای نرم‌افزارهای تحت مالکیت خودتان می‌توانید نسخه تعریف کنید.')
      return
    }
    if (!version.trim()) {
      setMessage('شماره نسخه الزامی است.')
      return
    }
    let storedRef = ''
    if (refVersion.trim()) {
      const canon = canonicalizeVersionReference(
        versions,
        softwareId,
        version,
        refVersion,
      )
      if (!canon.ok) {
        setMessage(canon.message)
        return
      }
      storedRef = canon.root
      if (storedRef !== refVersion.trim()) {
        setRefVersion(storedRef)
      }
    }
    const sw = mySoftwares.find((s) => s.id === softwareId)
    const payload: SoftwareVersion = {
      id: existing?.id ?? '',
      softwareId,
      softwareName: sw?.name ?? existing?.softwareName ?? '',
      version: version.trim(),
      status,
      knowledgeStatus: existing?.knowledgeStatus ?? 'empty',
      referencedVersions: storedRef ? [storedRef] : [],
      releasedAt: existing?.releasedAt ?? '',
    }
    const result = await upsertVersion(payload)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setMessage('')
    bypassAndLeave('/app/versions')
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'اصلاح نسخه' : 'تعریف نسخه'}
        description="فقط برای نرم‌افزارهای تحت مالکیت خودتان"
        actions={
          <Button variant="outline" onClick={() => void confirmAndLeave('/app/versions')}>
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
          <Select
            label="نرم‌افزار"
            value={softwareId}
            onChange={(e) => {
              const nextSoftwareId = e.target.value
              setSoftwareId(nextSoftwareId)
              setRefVersion('')
              setPickedRefVersion('')
            }}
            options={mySoftwares.map((s) => ({ value: s.id, label: s.name }))}
            disabled={!mySoftwares.length || isEdit}
            hint={
              mySoftwares.length
                ? isEdit
                  ? 'نرم‌افزار نسخه قابل تغییر نیست'
                  : undefined
                : 'نرم‌افزاری تحت مالکیت شما یافت نشد — ابتدا نرم‌افزار تعریف کنید'
            }
          />
          <Input label="شماره نسخه" value={version} onChange={(e) => setVersion(e.target.value)} />
          <Select
            label="وضعیت"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
            options={[
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ]}
          />
          <Select
            label="ارجاع به نسخه"
            value={refVersion}
            onChange={(e) => {
              applyReferenceSelection(e.target.value)
            }}
            options={[
              { value: '', label: '— بدون ارجاع —' },
              ...siblingVersionOptions,
            ]}
            isSearchable
            isClearable
            placeholder="جستجو یا انتخاب نسخه..."
            emptyText={
              siblingVersionOptions.length === 0
                ? 'نسخهٔ دیگری برای این نرم‌افزار نیست'
                : 'نسخه‌ای یافت نشد'
            }
            hint={
              refStackHint ??
              'فقط نسخه‌های همین نرم‌افزار — ارجاع مثل پشته به ریشه canonicalize می‌شود'
            }
          />
        </div>
        {message ? <p className="text-sm text-rose-500">{message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void confirmAndLeave('/app/versions')}
          >
            انصراف
          </Button>
          <Button type="submit" disabled={!softwareId || !mySoftwares.length}>
            {isEdit ? 'ذخیره' : 'ثبت نسخه'}
          </Button>
        </div>
      </form>
    </div>
  )
}
