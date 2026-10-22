import { useEffect, useMemo, useState } from 'react'
import { Coins } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Dialog } from '../../components/ui/Dialog'
import { DataTable, type Column, type DataTableFilter } from '../../components/ui/DataTable'
import { useAuth, userHasOwnerRole } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import type { SystemUser } from '../../types/rbac'

export function UserTokenChargesPage() {
  const { user, activeSoftwareId, setActiveSoftwareId } = useAuth()
  const {
    softwares,
    ownedSoftwares,
    usersOfKindForSoftware,
    chargeSoftwareEndUser,
  } = useDomain()

  const mySoftwares = useMemo(() => {
    if (!user) return []
    if (userHasOwnerRole(user)) return softwares
    return ownedSoftwares(user.id)
  }, [user, softwares, ownedSoftwares])

  const [softwareId, setSoftwareId] = useState(
    () =>
      (activeSoftwareId && mySoftwares.some((s) => s.id === activeSoftwareId)
        ? activeSoftwareId
        : mySoftwares[0]?.id) ?? '',
  )

  useEffect(() => {
    if (!softwareId && mySoftwares[0]) {
      setSoftwareId(mySoftwares[0].id)
      return
    }
    if (softwareId && !mySoftwares.some((s) => s.id === softwareId)) {
      setSoftwareId(mySoftwares[0]?.id ?? '')
    }
  }, [mySoftwares, softwareId])

  const software = mySoftwares.find((s) => s.id === softwareId)
  const endUsers = useMemo(
    () => usersOfKindForSoftware(softwareId, 'end_user'),
    [usersOfKindForSoftware, softwareId],
  )

  const [chargeUser, setChargeUser] = useState<SystemUser | null>(null)
  const [amount, setAmount] = useState('1000')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [dialogError, setDialogError] = useState('')

  const chargeDirty =
    Boolean(chargeUser) && (amount !== '1000' || note.trim() !== '')

  const onSoftwareChange = (id: string) => {
    setSoftwareId(id)
    setActiveSoftwareId(id || null)
    setMessage('')
    setDialogError('')
    setChargeUser(null)
  }

  const openCharge = (u: SystemUser) => {
    setChargeUser(u)
    setAmount('1000')
    setNote('')
    setFieldErrors({})
    setDialogError('')
  }

  const closeCharge = () => {
    setChargeUser(null)
    setAmount('1000')
    setNote('')
    setFieldErrors({})
    setDialogError('')
  }

  const submitCharge = () => {
    if (!chargeUser) return
    const result = chargeSoftwareEndUser(
      softwareId,
      chargeUser.id,
      Number(amount),
      note,
    )
    if (!result.ok) {
      setFieldErrors(result.fields ?? {})
      setDialogError(result.message)
      return
    }
    setMessage(`شارژ «${chargeUser.name}» با موفقیت ثبت شد.`)
    closeCharge()
  }

  const userFilters: DataTableFilter<SystemUser>[] = useMemo(
    () => [
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
    ],
    [],
  )

  const userColumns: Column<SystemUser>[] = [
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
    { key: 'mobile', header: 'موبایل', render: (r) => r.mobile },
    {
      key: 'org',
      header: 'سازمان',
      render: (r) => r.organizationName ?? '—',
    },
    {
      key: 'balance',
      header: 'موجودی',
      render: (r) => (r.endUserTokenBalance ?? 0).toLocaleString('fa-IR'),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) => (
        <Button size="sm" onClick={() => openCharge(r)}>
          <Coins className="size-3.5" />
          ثبت شارژ
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="شارژ کاربران نرم‌افزار"
        description="نرم‌افزار را انتخاب کنید، سپس از لیست کاربران با دکمهٔ ثبت شارژ کیف را شارژ کنید"
      />

      <div className="mb-4 max-w-md">
        <Select
          label="نرم‌افزار"
          value={softwareId}
          onChange={(e) => onSoftwareChange(e.target.value)}
          options={
            mySoftwares.length
              ? mySoftwares.map((s) => ({ value: s.id, label: s.name }))
              : [{ value: '', label: 'نرم‌افزاری تحت مالکیت شما نیست' }]
          }
          hint={
            software
              ? `کاربران نهایی «${software.name}»`
              : 'ابتدا نرم‌افزار را انتخاب کنید'
          }
        />
      </div>

      {message ? <p className="mb-4 text-sm text-muted">{message}</p> : null}

      <DataTable
        rows={endUsers}
        columns={userColumns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی نام، موبایل، سازمان..."
        searchFn={(row, q) =>
          [row.name, row.username, row.mobile ?? '', row.organizationName ?? ''].some(
            (v) => v.includes(q),
          )
        }
        filters={userFilters}
        emptyMessage="کاربر نهایی برای این نرم‌افزار یافت نشد"
      />

      <Dialog
        open={Boolean(chargeUser)}
        title={`ثبت شارژ — ${chargeUser?.name ?? ''}`}
        form
        dirty={chargeDirty}
        onClose={closeCharge}
        footer={({ requestClose }) => (
          <>
            <Button variant="outline" onClick={requestClose}>
              انصراف
            </Button>
            <Button onClick={submitCharge}>ثبت شارژ</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            موجودی فعلی:{' '}
            <span className="font-medium text-heading">
              {(chargeUser?.endUserTokenBalance ?? 0).toLocaleString('fa-IR')}
            </span>
            {software ? (
              <>
                {' '}
                — نرم‌افزار «{software.name}»
              </>
            ) : null}
          </p>
          <Input
            label="مقدار شارژ"
            value={amount}
            error={fieldErrors.amount}
            onChange={(e) => setAmount(e.target.value)}
            hint="عددی بزرگ‌تر از صفر"
          />
          <Input
            label="توضیح"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="اختیاری"
          />
          {dialogError ? (
            <p className="text-sm text-rose-500">{dialogError}</p>
          ) : null}
        </div>
      </Dialog>
    </div>
  )
}
