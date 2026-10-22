import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { KpiCard } from '../../components/ui/KpiCard'
import { Coins } from 'lucide-react'
import { useDomain } from '../../context/DomainContext'
import { jalaliDateIncludes } from '../../lib/jalaliDate'
import type { TokenLedgerEntry } from '../../types/software'

export function TokenChargesPage() {
  const { softwareManagers, allocateManagerTokens, managerLedger } = useDomain()
  const [userId, setUserId] = useState(softwareManagers[0]?.id ?? '')
  const [amount, setAmount] = useState('10000')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const ledgerRows = useMemo(
    () =>
      [...managerLedger].sort((a, b) => b.date.localeCompare(a.date, 'fa')),
    [managerLedger],
  )

  const totals = useMemo(() => {
    const charged = managerLedger
      .filter((e) => e.type === 'charge')
      .reduce((s, e) => s + e.amount, 0)
    const balances = softwareManagers.reduce((s, u) => s + (u.managerTokenBalance ?? 0), 0)
    return { charged, balances, count: softwareManagers.length }
  }, [managerLedger, softwareManagers])

  const columns: Column<TokenLedgerEntry>[] = [
    { key: 'date', header: 'تاریخ', render: (r) => r.date },
    { key: 'manager', header: 'مدیر', render: (r) => r.userName },
    {
      key: 'type',
      header: 'نوع',
      render: (r) => (
        <Badge
          variant={
            r.type === 'charge' ? 'success' : r.type === 'consume' ? 'warning' : 'info'
          }
        >
          {r.type === 'charge' ? 'شارژ' : r.type === 'consume' ? 'مصرف' : r.type}
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

  const submit = () => {
    const result = allocateManagerTokens(userId, Number(amount), note)
    if (!result.ok) {
      setFieldErrors(result.fields ?? {})
      setMessage(result.message)
      return
    }
    setFieldErrors({})
    setMessage('تخصیص با موفقیت ثبت شد.')
    setNote('')
  }

  return (
    <div>
      <PageHeader
        title="تخصیص توکن به شرکت‌های نرم‌افزاری"
        description="فقط شرکت‌هایی که حداقل یک نرم‌افزار تعریف کرده‌اند"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="موجودی کیف مدیران"
          value={totals.balances.toLocaleString('fa-IR')}
          icon={<Coins className="size-5" />}
        />
        <KpiCard
          title="تعداد مدیران"
          value={totals.count.toLocaleString('fa-IR')}
        />
        <KpiCard
          title="مجموع تخصیص‌ها"
          value={totals.charged.toLocaleString('fa-IR')}
        />
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border border-border bg-panel p-5 lg:grid-cols-4">
        <Select
          label="مدیر نرم‌افزار"
          value={userId}
          error={fieldErrors.userId}
          onChange={(e) => setUserId(e.target.value)}
          options={
            softwareManagers.length
              ? softwareManagers.map((u) => ({
                  value: u.id,
                  label: `${u.name} (${(u.managerTokenBalance ?? 0).toLocaleString('fa-IR')})`,
                }))
              : [{ value: '', label: 'مدیری با نرم‌افزار تعریف‌شده نیست' }]
          }
        />
        <Input
          label="مقدار شارژ"
          value={amount}
          error={fieldErrors.amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input label="توضیح" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex items-end">
          <Button className="w-full" onClick={submit}>
            ثبت تخصیص
          </Button>
        </div>
      </div>

      {message ? <p className="mb-4 text-sm text-muted">{message}</p> : null}

      <DataTable
        rows={ledgerRows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی مدیر یا توضیح..."
        searchFn={(row, q) => [row.userName, row.note].some((v) => v.includes(q))}
        filters={[
          {
            key: 'user',
            label: 'مدیر',
            type: 'text',
            placeholder: 'نام مدیر...',
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
              { value: 'consume', label: 'مصرف' },
              { value: 'allocate', label: 'اختصاص' },
            ],
            filterFn: (row, value) => row.type === value,
          },
          {
            key: 'date',
            label: 'تاریخ',
            type: 'date',
            placeholder: '۱۴۰۳/۰۱/۰۱',
            className: 'w-40',
            filterFn: (row, value) => jalaliDateIncludes(row.date, value),
          },
          {
            key: 'note',
            label: 'توضیح',
            type: 'text',
            placeholder: 'توضیح...',
            className: 'min-w-36 flex-1',
            filterFn: (row, value) => row.note.includes(value),
          },
        ]}
      />
    </div>
  )
}
