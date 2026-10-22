import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column, type DataTableFilter } from '../../components/ui/DataTable'
import { useAuth, userHasOwnerRole } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import type { TokenLedgerEntry } from '../../types/software'

export function UserTokenChargeHistoryPage() {
  const { user, activeSoftwareId, setActiveSoftwareId } = useAuth()
  const {
    softwares,
    ownedSoftwares,
    usersOfKindForSoftware,
    tokenLedger,
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

  const onSoftwareChange = (id: string) => {
    setSoftwareId(id)
    setActiveSoftwareId(id || null)
  }

  const historyRows = useMemo(
    () =>
      tokenLedger
        .filter((e) => {
          if (e.purpose !== 'end_user') return false
          if (!softwareId) return false
          if (e.softwareId === softwareId) return true
          return endUsers.some((u) => u.id === e.userId)
        })
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date, 'fa')),
    [tokenLedger, softwareId, endUsers],
  )

  const historyFilters: DataTableFilter<TokenLedgerEntry>[] = useMemo(
    () => [
      {
        key: 'user',
        label: 'کاربر',
        type: 'text',
        placeholder: 'نام کاربر...',
        className: 'min-w-40 flex-1',
        filterFn: (row, value) => row.userName.includes(value),
      },
      {
        key: 'type',
        label: 'نوع',
        type: 'select',
        className: 'w-36',
        options: [
          { value: 'all', label: 'همه' },
          { value: 'charge', label: 'شارژ' },
          { value: 'allocate', label: 'اختصاص' },
          { value: 'consume', label: 'مصرف' },
        ],
        filterFn: (row, value) => row.type === value,
      },
      {
        key: 'note',
        label: 'توضیح',
        type: 'text',
        placeholder: 'جستجوی توضیح...',
        className: 'min-w-40 flex-1',
        filterFn: (row, value) => row.note.includes(value),
      },
    ],
    [],
  )

  const historyColumns: Column<TokenLedgerEntry>[] = [
    { key: 'date', header: 'تاریخ', render: (r) => r.date },
    { key: 'user', header: 'کاربر', render: (r) => r.userName },
    {
      key: 'type',
      header: 'نوع',
      render: (r) => (
        <Badge variant={r.type === 'charge' ? 'success' : 'warning'}>
          {r.type === 'charge' ? 'شارژ' : r.type === 'allocate' ? 'اختصاص' : 'مصرف'}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'مقدار',
      render: (r) => r.amount.toLocaleString('fa-IR'),
    },
    { key: 'note', header: 'توضیح', render: (r) => r.note },
  ]

  return (
    <div>
      <PageHeader
        title="تاریخچه شارژ کاربران"
        description="سوابق شارژ و مصرف توکن کاربران نهایی نرم‌افزار انتخاب‌شده"
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
              ? `تاریخچه «${software.name}»`
              : 'ابتدا نرم‌افزار را انتخاب کنید'
          }
        />
      </div>

      <DataTable
        rows={historyRows}
        columns={historyColumns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی کاربر یا توضیح..."
        searchFn={(row, q) =>
          [row.userName, row.note, row.date].some((v) => v.includes(q))
        }
        filters={historyFilters}
        emptyMessage="موردی یافت نشد"
      />
    </div>
  )
}
