import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { DatePicker } from './DatePicker'
import { Input } from './Input'
import { Select } from './Select'
import { Pagination } from './Pagination'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

type FilterOption = { value: string; label: string }

export type DataTableFilter<T> = {
  key: string
  label: string
  type: 'text' | 'select' | 'date'
  placeholder?: string
  options?: FilterOption[]
  filterFn: (row: T, value: string) => boolean
  className?: string
}

type DataTableProps<T> = {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  /** فیلتر مجزا برای هر فیلد داده */
  filters?: DataTableFilter<T>[]
  /** سازگاری با حالت قبلی: جستجوی کلی */
  searchPlaceholder?: string
  searchFn?: (row: T, query: string) => boolean
  filterLabel?: string
  filterOptions?: FilterOption[]
  filterFn?: (row: T, value: string) => boolean
  pageSize?: number
  emptyMessage?: string
  toolbar?: ReactNode
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  filters,
  searchPlaceholder = 'جستجو...',
  searchFn,
  filterLabel = 'فیلتر',
  filterOptions,
  filterFn,
  pageSize = 5,
  emptyMessage = 'موردی یافت نشد',
  toolbar,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(filterOptions?.[0]?.value ?? 'all')
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((filters ?? []).map((f) => [f.key, f.type === 'select' ? 'all' : ''])),
  )
  const [page, setPage] = useState(1)

  const hasColumnFilters = Boolean(filters && filters.length > 0)
  const hasLegacyToolbar = Boolean(searchFn || (filterOptions && filterFn))
  const showToolbar = hasColumnFilters || hasLegacyToolbar || Boolean(toolbar)

  const filtered = useMemo(() => {
    let result = rows

    if (hasColumnFilters && filters) {
      for (const f of filters) {
        const value = (filterValues[f.key] ?? '').trim()
        if (!value || value === 'all') continue
        result = result.filter((row) => f.filterFn(row, value))
      }
    }

    if (query && searchFn) {
      result = result.filter((row) => searchFn(row, query.trim()))
    }

    // فیلتر تکی قدیمی فقط وقتی فیلتر ستونی نداریم
    if (!hasColumnFilters && filterOptions && filterFn && filter !== 'all') {
      result = result.filter((row) => filterFn(row, filter))
    }
    return result
  }, [
    rows,
    hasColumnFilters,
    filters,
    filterValues,
    query,
    searchFn,
    filter,
    filterOptions,
    filterFn,
  ])

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const setColumnFilter = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-[var(--shadow)] backdrop-blur">
      {showToolbar ? (
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          {hasColumnFilters
            ? filters!.map((f) =>
                f.type === 'select' ? (
                  <div key={f.key} className={f.className ?? 'w-44'}>
                    <Select
                      label={f.label}
                      value={filterValues[f.key] ?? 'all'}
                      onChange={(e) => setColumnFilter(f.key, e.target.value)}
                      options={f.options ?? [{ value: 'all', label: 'همه' }]}
                    />
                  </div>
                ) : f.type === 'date' ? (
                  <div key={f.key} className={f.className ?? 'w-40'}>
                    <DatePicker
                      label={f.label}
                      value={filterValues[f.key] ?? ''}
                      onChange={(v) => setColumnFilter(f.key, v)}
                      placeholder={f.placeholder ?? '۱۴۰۳/۰۱/۰۱'}
                    />
                  </div>
                ) : (
                  <div key={f.key} className={`relative ${f.className ?? 'min-w-44 flex-1'}`}>
                    <Search className="pointer-events-none absolute top-9 right-3 size-4 -translate-y-0 text-muted" />
                    <Input
                      label={f.label}
                      value={filterValues[f.key] ?? ''}
                      onChange={(e) => setColumnFilter(f.key, e.target.value)}
                      placeholder={f.placeholder ?? `فیلتر ${f.label}...`}
                      className="pr-9"
                    />
                  </div>
                ),
              )
            : null}

          {searchFn ? (
            <div className="relative min-w-56 flex-1">
              <Search
                className={`pointer-events-none absolute right-3 size-4 text-muted ${
                  hasColumnFilters ? 'top-9' : 'top-1/2 -translate-y-1/2'
                }`}
              />
              <Input
                label={hasColumnFilters ? 'جستجوی کلی' : undefined}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder={searchPlaceholder}
                className="pr-9"
              />
            </div>
          ) : null}

          {!hasColumnFilters && filterOptions && filterFn ? (
            <div className="w-44">
              <Select
                label={filterLabel}
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value)
                  setPage(1)
                }}
                options={filterOptions}
              />
            </div>
          ) : null}

          {toolbar ? <div className="ms-auto flex items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-primary-soft text-muted">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-right font-medium ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-border hover:bg-primary-soft/60">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-ink ${col.className ?? ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
      />
    </div>
  )
}
