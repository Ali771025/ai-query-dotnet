import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { consumptionRules } from '../../data/mock/managers'
import type { ConsumptionRule } from '../../types/manager'

export function ConsumptionRulesPage() {
  const [rows, setRows] = useState(consumptionRules)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCost, setEditCost] = useState('')

  const startEdit = (row: ConsumptionRule) => {
    setEditingId(row.id)
    setEditCost(String(row.costPerUnit))
  }

  const saveEdit = () => {
    if (!editingId) return
    setRows((prev) =>
      prev.map((r) =>
        r.id === editingId ? { ...r, costPerUnit: Number(editCost) || r.costPerUnit } : r,
      ),
    )
    setEditingId(null)
  }

  const columns: Column<ConsumptionRule>[] = [
    { key: 'name', header: 'قانون', render: (r) => r.name },
    { key: 'unit', header: 'واحد', render: (r) => r.unit },
    {
      key: 'cost',
      header: 'هزینه هر واحد',
      render: (r) =>
        editingId === r.id ? (
          <Input value={editCost} onChange={(e) => setEditCost(e.target.value)} className="w-24" />
        ) : (
          r.costPerUnit.toLocaleString('fa-IR')
        ),
    },
    { key: 'desc', header: 'توضیح', render: (r) => r.description },
    {
      key: 'active',
      header: 'وضعیت',
      render: (r) => (
        <Badge variant={r.active ? 'success' : 'neutral'}>{r.active ? 'فعال' : 'غیرفعال'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) =>
        editingId === r.id ? (
          <div className="flex gap-1">
            <Button size="sm" onClick={saveEdit}>
              ذخیره
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
              انصراف
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
            تغییر هزینه
          </Button>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="قوانین محاسبه مصرف"
        description="مدیریت قوانین استاندارد مصرف و امکان تغییر هزینه واحد"
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی قانون یا توضیح..."
        searchFn={(row, q) => [row.name, row.description].some((v) => v.includes(q))}
        filters={[
          {
            key: 'name',
            label: 'قانون',
            type: 'text',
            placeholder: 'نام قانون...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.name.includes(value),
          },
          {
            key: 'unit',
            label: 'واحد',
            type: 'text',
            placeholder: 'واحد...',
            className: 'w-32',
            filterFn: (row, value) => row.unit.includes(value),
          },
          {
            key: 'active',
            label: 'وضعیت',
            type: 'select',
            className: 'w-36',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ],
            filterFn: (row, value) =>
              value === 'active' ? row.active : !row.active,
          },
          {
            key: 'desc',
            label: 'توضیح',
            type: 'text',
            placeholder: 'توضیح...',
            className: 'min-w-36 flex-1',
            filterFn: (row, value) => row.description.includes(value),
          },
        ]}
      />
    </div>
  )
}
