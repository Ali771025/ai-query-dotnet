import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { promptLogs } from '../../data/mock/software'

export function PromptLogsPage() {
  const [query, setQuery] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(promptLogs[0]?.id ?? null)

  const filtered = promptLogs.filter((row) => {
    const matchesQuery =
      !query ||
      [row.user, row.prompt, row.response, row.model].some((v) =>
        v.includes(query.trim()),
      )
    const matchesUser = !userFilter || row.user.includes(userFilter.trim())
    const matchesModel = !modelFilter || row.model.includes(modelFilter.trim())
    const matchesSource =
      sourceFilter === 'all' ||
      (sourceFilter === 'cached' ? row.cached : !row.cached)
    return matchesQuery && matchesUser && matchesModel && matchesSource
  })

  return (
    <div>
      <PageHeader
        title="لاگ کامل Promptها"
        description="مشاهده کامل متن درخواست و پاسخ تولیدشده"
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Input
            label="جستجوی کلی"
            placeholder="جستجو در prompt یا پاسخ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="min-w-36 flex-1">
          <Input
            label="کاربر"
            placeholder="نام کاربر..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          />
        </div>
        <div className="w-36">
          <Input
            label="مدل"
            placeholder="مدل..."
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            label="منبع"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            options={[
              { value: 'all', label: 'همه' },
              { value: 'live', label: 'مدل' },
              { value: 'cached', label: 'آرشیو' },
            ]}
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((log) => {
          const isOpen = expanded === log.id
          return (
            <div key={log.id} className="overflow-hidden rounded-xl border border-border bg-panel">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
                onClick={() => setExpanded(isOpen ? null : log.id)}
              >
                <div>
                  <p className="text-sm font-medium text-heading">{log.user}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted">{log.prompt}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={log.cached ? 'info' : 'default'}>
                    {log.cached ? 'آرشیو' : log.model}
                  </Badge>
                  <span className="text-xs text-muted">{log.timestamp}</span>
                  {isOpen ? (
                    <ChevronUp className="size-4 text-muted" />
                  ) : (
                    <ChevronDown className="size-4 text-muted" />
                  )}
                </div>
              </button>
              {isOpen ? (
                <div className="space-y-3 border-t border-border bg-primary-soft px-4 py-4 text-sm">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted">Prompt</p>
                    <p className="rounded-lg bg-panel p-3 text-ink">{log.prompt}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted">Response</p>
                    <p className="rounded-lg bg-panel p-3 font-mono text-xs leading-6 text-ink">
                      {log.response}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-border bg-panel p-8 text-center text-sm text-muted">
            موردی یافت نشد
          </p>
        ) : null}
      </div>
    </div>
  )
}
