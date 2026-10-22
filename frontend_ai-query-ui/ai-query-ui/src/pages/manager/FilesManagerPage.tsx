import { useState } from 'react'
import { Eye, Pencil, Replace } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Dialog } from '../../components/ui/Dialog'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Textarea } from '../../components/ui/Textarea'
import { knowledgeFiles } from '../../data/mock/software'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard'
import { jalaliDateIncludes } from '../../lib/jalaliDate'
import type { KnowledgeFile } from '../../types/software'

export function FilesManagerPage() {
  const [viewFile, setViewFile] = useState<KnowledgeFile | null>(null)
  const [editFile, setEditFile] = useState<KnowledgeFile | null>(null)
  const [content, setContent] = useState('')
  const [baselineContent, setBaselineContent] = useState('')

  const dirty = Boolean(editFile) && content !== baselineContent
  useUnsavedChangesGuard(dirty)

  const rows = [...knowledgeFiles].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt, 'fa'),
  )

  const columns: Column<KnowledgeFile>[] = [
    { key: 'name', header: 'نام فایل', render: (r) => r.name },
    {
      key: 'type',
      header: 'نوع',
      render: (r) => <Badge variant="neutral">{r.type}</Badge>,
    },
    { key: 'size', header: 'حجم', render: (r) => r.size },
    { key: 'updated', header: 'آخرین ویرایش', render: (r) => r.updatedAt },
    {
      key: 'actions',
      header: 'عملیات',
      render: (r) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setViewFile(r)
              setContent(`محتوای نمونه فایل ${r.name}\n\n# entities\nBuildingPermit\nViolationCase`)
            }}
          >
            <Eye className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = `محتوای قابل ویرایش ${r.name}`
              setEditFile(r)
              setContent(next)
              setBaselineContent(next)
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm">
            <Replace className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="مدیریت فایل‌های بارگذاری‌شده"
        description="مشاهده، اصلاح و ویرایش فایل‌های دانش از طریق داشبورد"
        actions={<Button variant="outline">بارگذاری فایل جدید</Button>}
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="جستجوی نام فایل..."
        searchFn={(row, q) => row.name.includes(q)}
        filters={[
          {
            key: 'name',
            label: 'نام فایل',
            type: 'text',
            placeholder: 'نام فایل...',
            className: 'min-w-40 flex-1',
            filterFn: (row, value) => row.name.includes(value),
          },
          {
            key: 'type',
            label: 'نوع',
            type: 'select',
            className: 'w-36',
            options: [
              { value: 'all', label: 'همه' },
              { value: 'JSON', label: 'JSON' },
              { value: 'Markdown', label: 'Markdown' },
              { value: 'YAML', label: 'YAML' },
              { value: 'SQL', label: 'SQL' },
            ],
            filterFn: (row, value) => row.type === value,
          },
          {
            key: 'updated',
            label: 'آخرین ویرایش',
            type: 'date',
            placeholder: '۱۴۰۳/۰۱/۰۱',
            className: 'w-40',
            filterFn: (row, value) => jalaliDateIncludes(row.updatedAt, value),
          },
        ]}
      />

      <Dialog open={Boolean(viewFile)} title={`مشاهده ${viewFile?.name ?? ''}`} onClose={() => setViewFile(null)}>
        <pre className="overflow-auto rounded-lg bg-primary-soft p-3 text-xs text-ink">{content}</pre>
      </Dialog>

      <Dialog
        open={Boolean(editFile)}
        title={`ویرایش ${editFile?.name ?? ''}`}
        form
        dirty={dirty}
        onClose={() => setEditFile(null)}
        footer={({ requestClose }) => (
          <>
            <Button variant="outline" onClick={requestClose}>
              انصراف
            </Button>
            <Button
              onClick={() => {
                setBaselineContent(content)
                setEditFile(null)
              }}
            >
              ذخیره
            </Button>
          </>
        )}
      >
        <Textarea
          label="محتوا"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-48 font-mono text-xs"
        />
      </Dialog>
    </div>
  )
}
