import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { PAGE_SIZE_OPTIONS } from '../../hooks/usePaginatedList'

export interface PaginationProps {
  /** Plural noun for the records, e.g. "vehicles". */
  label: string
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  /** Disable the controls while a page is loading. */
  disabled?: boolean
  className?: string
}

const buttonClass =
  'min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 ' +
  'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-900 disabled:opacity-40 disabled:cursor-not-allowed ' +
  'dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200'

/**
 * Accessible pagination footer for server-side paginated lists: a range and
 * total summary (announced politely), a page-size selector and first /
 * previous / next / last controls (44px targets).
 */
export function Pagination({
  label,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  className = '',
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount)
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1
  const end = Math.min(total, current * pageSize)
  const atStart = current <= 1
  const atEnd = current >= pageCount
  const selectId = `page-size-${label.replace(/\W+/g, '-').toLowerCase()}`

  return (
    <nav
      aria-label={`${label.charAt(0).toUpperCase()}${label.slice(1)} pagination`}
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
    >
      <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite" aria-atomic="true">
        {total === 0
          ? `No ${label}`
          : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()} ${label}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="text-sm text-slate-600 dark:text-slate-300">
          Rows per page
        </label>
        <select
          id={selectId}
          value={pageSize}
          disabled={disabled}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="min-h-11 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-900 dark:bg-slate-900 dark:border-slate-600"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={buttonClass}
          aria-label="First page"
          disabled={disabled || atStart}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={buttonClass}
          aria-label="Previous page"
          disabled={disabled || atStart}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="text-sm text-slate-700 dark:text-slate-200 px-1" aria-current="page">
          Page {current.toLocaleString()} of {pageCount.toLocaleString()}
        </span>
        <button
          type="button"
          className={buttonClass}
          aria-label="Next page"
          disabled={disabled || atEnd}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={buttonClass}
          aria-label="Last page"
          disabled={disabled || atEnd}
          onClick={() => onPageChange(pageCount)}
        >
          <ChevronsRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}

export interface SortOption {
  value: string
  label: string
  order?: 'asc' | 'desc'
}

/** "Sort by" select bound to the paginated list sort state (`value|order`). */
export function SortSelect({
  id,
  options,
  sort,
  order,
  onChange,
}: {
  id: string
  options: SortOption[]
  sort: string
  order: '' | 'asc' | 'desc'
  onChange: (sort: string, order?: 'asc' | 'desc') => void
}) {
  const selected =
    options.find((option) => option.value === sort && (option.order ?? '') === order) ??
    options.find((option) => option.value === sort) ??
    options[0]
  const key = (option: SortOption) => `${option.value}|${option.order ?? ''}`
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-slate-600 whitespace-nowrap dark:text-slate-300">
        Sort by
      </label>
      <select
        id={id}
        value={key(selected)}
        onChange={(event) => {
          const option = options.find((candidate) => key(candidate) === event.target.value) ?? options[0]
          onChange(option.value, option.order)
        }}
        className="min-h-11 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-900 dark:bg-slate-900 dark:border-slate-600"
      >
        {options.map((option) => (
          <option key={key(option)} value={key(option)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
