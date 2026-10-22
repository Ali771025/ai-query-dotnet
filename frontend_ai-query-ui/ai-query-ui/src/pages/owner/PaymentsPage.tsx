import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { paymentTransactions } from '../../data/mock/managers'
import type { PaymentTransaction } from '../../types/manager'
import { useDomain } from '../../context/DomainContext'

const packages = [
  { id: 'p1', name: 'بسته پایه ۲۰ هزار', price: 1800000, tokens: 20000 },
  { id: 'p2', name: 'بسته سازمانی ۵۰ هزار', price: 4500000, tokens: 50000 },
  { id: 'p3', name: 'بسته حرفه‌ای ۱۰۰ هزار', price: 8200000, tokens: 100000 },
]

export function PaymentsPage() {
  const { softwareManagers, allocateManagerTokens } = useDomain()
  const assignees = softwareManagers
  const [userId, setUserId] = useState(assignees[0]?.id ?? '')
  const [pkg, setPkg] = useState(packages[0]?.id ?? '')
  const [message, setMessage] = useState('')

  const pay = () => {
    const selected = packages.find((p) => p.id === pkg)
    if (!selected || !userId) {
      setMessage('مدیر و بسته را انتخاب کنید.')
      return
    }
    const result = allocateManagerTokens(
      userId,
      selected.tokens,
      `خرید ${selected.name}`,
    )
    setMessage(result.ok ? 'پرداخت دمو و تخصیص توکن انجام شد.' : result.message)
  }

  const columns: Column<PaymentTransaction>[] = [
    { key: 'date', header: 'تاریخ', render: (r) => r.date },
    { key: 'manager', header: 'کاربر', render: (r) => r.managerName },
    { key: 'pkg', header: 'بسته', render: (r) => r.packageName },
    {
      key: 'amount',
      header: 'مبلغ (ریال)',
      render: (r) => r.amount.toLocaleString('fa-IR'),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => (
        <Badge
          variant={
            r.status === 'success' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'
          }
        >
          {r.status === 'success' ? 'موفق' : r.status === 'pending' ? 'در انتظار' : 'ناموفق'}
        </Badge>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="مدیریت پرداخت آنلاین"
        description="شارژ حساب و خرید اعتبار برای کاربران سیستم"
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {packages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPkg(p.id)}
            className={`rounded-xl border p-5 text-right transition ${
              pkg === p.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-border bg-panel hover:border-primary-200'
            }`}
          >
            <p className="font-semibold text-heading">{p.name}</p>
            <p className="mt-2 text-sm text-muted">
              {p.tokens.toLocaleString('fa-IR')} توکن
            </p>
            <p className="mt-3 text-lg font-bold text-primary-700">
              {p.price.toLocaleString('fa-IR')} ریال
            </p>
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-panel p-5">
        <div className="w-56">
          <Select
            label="کاربر"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            options={
              assignees.length
                ? assignees.map((u) => ({ value: u.id, label: u.name }))
                : [{ value: '', label: 'مدیری با نرم‌افزار تعریف‌شده نیست' }]
            }
          />
        </div>
        <Button onClick={pay}>پرداخت و شارژ حساب</Button>
      </div>

      {message ? <p className="mb-4 text-sm text-muted">{message}</p> : null}

      <DataTable
        rows={paymentTransactions}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی کاربر یا بسته..."
        searchFn={(row, q) => [row.managerName, row.packageName].some((v) => v.includes(q))}
        filters={[
          {
            key: 'manager',
            label: 'کاربر',
            type: 'text',
            placeholder: 'نام کاربر...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.managerName.includes(value),
          },
          {
            key: 'pkg',
            label: 'بسته',
            type: 'text',
            placeholder: 'نام بسته...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.packageName.includes(value),
          },
          {
            key: 'status',
            label: 'وضعیت',
            type: 'select',
            className: 'w-36',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'success', label: 'موفق' },
              { value: 'pending', label: 'در انتظار' },
              { value: 'failed', label: 'ناموفق' },
            ],
            filterFn: (row, value) => row.status === value,
          },
        ]}
      />
    </div>
  )
}
