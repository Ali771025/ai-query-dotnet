import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from './Button'

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const [draft, setDraft] = useState(String(page))

  useEffect(() => {
    setDraft(String(page))
  }, [page])

  const commitPage = () => {
    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ''), 10)
    if (Number.isNaN(parsed)) {
      setDraft(String(page))
      return
    }
    const next = Math.min(totalPages, Math.max(1, parsed))
    setDraft(String(next))
    if (next !== page) onPageChange(next)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    commitPage()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setDraft(String(page))
      e.currentTarget.blur()
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted">
      <span>
        نمایش {from} تا {to} از {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          قبلی
        </Button>
        <form className="flex items-center gap-1.5" onSubmit={onSubmit}>
          <input
            type="text"
            inputMode="numeric"
            aria-label="شماره صفحه"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitPage}
            onKeyDown={onKeyDown}
            className="h-8 w-12 rounded-md border border-border bg-input px-2 text-center text-ink outline-none focus:border-accent focus:ring-2 focus:ring-primary-soft"
          />
          <span className="text-ink">/ {totalPages}</span>
        </form>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          بعدی
        </Button>
      </div>
    </div>
  )
}
