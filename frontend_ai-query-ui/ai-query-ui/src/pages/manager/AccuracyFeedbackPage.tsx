import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { accuracyFeedbacks } from '../../data/mock/software'
import { jalaliDateIncludes } from '../../lib/jalaliDate'
import type { AccuracyFeedback } from '../../types/software'

function ScoreCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary-50 text-sm font-semibold text-primary-700">
      {value.toLocaleString('fa-IR')}
    </span>
  )
}

export function AccuracyFeedbackPage() {
  const [managerScore, setManagerScore] = useState('4')

  const columns: Column<AccuracyFeedback>[] = [
    { key: 'date', header: 'تاریخ', render: (r) => r.date },
    { key: 'topic', header: 'موضوع', render: (r) => r.topic },
    {
      key: 'user',
      header: 'نظر کاربر',
      render: (r) => <ScoreCell value={r.userScore} />,
    },
    {
      key: 'system',
      header: 'نظر سامانه',
      render: (r) => <ScoreCell value={r.systemScore} />,
    },
    {
      key: 'manager',
      header: 'نظر مدیر',
      render: (r) => <ScoreCell value={r.managerScore} />,
    },
    { key: 'comment', header: 'توضیح', render: (r) => r.comment },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) =>
        r.managerScore === null ? (
          <div className="flex items-center gap-2">
            <Input
              value={managerScore}
              onChange={(e) => setManagerScore(e.target.value)}
              className="w-16"
            />
            <Button size="sm">ثبت</Button>
          </div>
        ) : (
          <span className="text-xs text-muted">ثبت‌شده</span>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="ثبت میزان دقت پاسخ"
        description="نظر کاربر، سامانه و مدیر نرم‌افزار برای آموزش مدل Local و کش پاسخ‌ها"
      />
      <DataTable
        rows={accuracyFeedbacks}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی موضوع یا توضیح..."
        searchFn={(row, q) => [row.topic, row.comment].some((v) => v.includes(q))}
        filters={[
          {
            key: 'topic',
            label: 'موضوع',
            type: 'text',
            placeholder: 'موضوع...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.topic.includes(value),
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
            key: 'manager',
            label: 'نظر مدیر',
            type: 'select',
            className: 'w-40',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'pending', label: 'بدون نظر مدیر' },
              { value: 'done', label: 'دارای نظر مدیر' },
            ],
            filterFn: (row, value) =>
              value === 'pending'
                ? row.managerScore === null
                : row.managerScore !== null,
          },
          {
            key: 'comment',
            label: 'توضیح',
            type: 'text',
            placeholder: 'توضیح...',
            className: 'min-w-36 flex-1',
            filterFn: (row, value) => row.comment.includes(value),
          },
        ]}
      />
    </div>
  )
}
