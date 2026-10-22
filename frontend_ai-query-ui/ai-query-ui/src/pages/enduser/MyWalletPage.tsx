import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { KpiCard } from '../../components/ui/KpiCard'
import { Wallet } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import { jalaliDateIncludes } from '../../lib/jalaliDate'
import type { TokenLedgerEntry } from '../../types/software'

export function MyWalletPage() {
  const { user } = useAuth()
  const { selfChargeEndUser, endUserLedgerFor } = useDomain()
  const [amount, setAmount] = useState('5000')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const rows = user
    ? endUserLedgerFor(user.id)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date, 'fa'))
    : []

  const columns: Column<TokenLedgerEntry>[] = [
    { key: 'date', header: 'تاریخ', render: (r) => r.date },
    {
      key: 'type',
      header: 'نوع',
      render: (r) => (
        <Badge
          variant={
            r.type === 'charge' ? 'success' : r.type === 'allocate' ? 'info' : 'warning'
          }
        >
          {r.type === 'charge' ? 'شارژ' : r.type === 'allocate' ? 'اختصاص به Key' : 'مصرف'}
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
    const result = selfChargeEndUser(Number(amount), note)
    if (!result.ok) {
      setErrors(result.fields ?? {})
      setMessage(result.message)
      return
    }
    setErrors({})
    setMessage('پرداخت دمو موفق بود و کیف شما شارژ شد.')
    setNote('')
  }

  return (
    <div>
      <PageHeader
        title="شارژ توکن"
        description="از درگاه دمو توکن بخرید و بعد به API Key اختصاص دهید"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <KpiCard
          title="موجودی کیف کاربر نهایی"
          value={(user?.endUserTokenBalance ?? 0).toLocaleString('fa-IR')}
          icon={<Wallet className="size-5" />}
        />
        <KpiCard
          title="موجودی کیف مدیر (در صورت داشتن)"
          value={(user?.managerTokenBalance ?? 0).toLocaleString('fa-IR')}
          hint="فقط در workspace مدیر معنا دارد"
        />
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border border-border bg-panel p-5 sm:grid-cols-3">
        <Input
          label="مقدار شارژ"
          value={amount}
          error={errors.amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input label="توضیح" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex items-end">
          <Button className="w-full" onClick={submit}>
            پرداخت و شارژ (دمو)
          </Button>
        </div>
      </div>

      {message ? <p className="mb-4 text-sm text-emerald-600">{message}</p> : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجو در توضیح..."
        searchFn={(row, q) => row.note.includes(q)}
        filters={[
          {
            key: 'date',
            label: 'تاریخ',
            type: 'date',
            placeholder: '۱۴۰۳/۰۱/۰۱',
            className: 'w-40',
            filterFn: (row, value) => jalaliDateIncludes(row.date, value),
          },
          {
            key: 'type',
            label: 'نوع',
            type: 'select',
            className: 'w-40',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'charge', label: 'شارژ' },
              { value: 'allocate', label: 'اختصاص به Key' },
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
        ]}
      />
    </div>
  )
}
