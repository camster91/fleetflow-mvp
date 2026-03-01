/**
 * Table Component
 * 
 * A comprehensive data table with sortable headers, row hover states,
 * empty state handling, and pagination support.
 * 
 * @example
 * ```tsx
 * <Table
 *   columns={[
 *     { key: 'name', header: 'Name', sortable: true },
 *     { key: 'email', header: 'Email' },
 *   ]}
 *   data={users}
 *   onSort={(key, direction) => console.log(key, direction)}
 * />
 * ```
 */

import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';

/**
 * Sort direction type
 */
export type SortDirection = 'asc' | 'desc' | null;

/**
 * Column definition interface
 */
export interface Column<T = any> {
  /** Unique key for the column (should match data property) */
  key: string;
  /** Display header text */
  header: React.ReactNode;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Custom cell renderer */
  render?: (row: T, index: number) => React.ReactNode;
  /** Column width (CSS value) */
  width?: string;
  /** Column alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether the column should be hidden on mobile */
  hideOnMobile?: boolean;
}

/**
 * Pagination info interface
 */
export interface PaginationInfo {
  /** Current page number (1-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Items per page */
  itemsPerPage: number;
}

/**
 * Table component props
 */
export interface TableProps<T = any> extends React.HTMLAttributes<HTMLTableElement> {
  /** Column definitions */
  columns: Column<T>[];
  /** Table data */
  data: T[];
  /** Callback when a sortable column header is clicked */
  onSort?: (key: string, direction: SortDirection) => void;
  /** Current sort key */
  sortKey?: string | null;
  /** Current sort direction */
  sortDirection?: SortDirection;
  /** Message to display when data is empty */
  emptyMessage?: string;
  /** Custom empty state content */
  emptyContent?: React.ReactNode;
  /** Whether the table is loading */
  loading?: boolean;
  /** Number of skeleton rows to show when loading */
  loadingRows?: number;
  /** Click handler for row */
  onRowClick?: (row: T, index: number) => void;
  /** Function to determine if a row should be highlighted */
  rowHighlight?: (row: T, index: number) => boolean;
  /** Custom class for rows */
  rowClassName?: (row: T, index: number) => string;
  /** Pagination info */
  pagination?: PaginationInfo;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Enable zebra striping */
  striped?: boolean;
  /** Enable hover effect on rows */
  hoverable?: boolean;
  /** Compact table style */
  compact?: boolean;
}

/**
 * Table component for data display
 * 
 * @param props - Table props
 * @returns React component
 */
export function Table<T extends Record<string, any> = any>({
  columns,
  data,
  onSort,
  sortKey,
  sortDirection,
  emptyMessage = 'No data available',
  emptyContent,
  loading = false,
  loadingRows = 5,
  onRowClick,
  rowHighlight,
  rowClassName,
  pagination,
  onPageChange,
  striped = false,
  hoverable = true,
  compact = false,
  className = '',
  ...props
}: TableProps<T>) {
  // Handle sort click
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return;

    let newDirection: SortDirection = 'asc';
    if (sortKey === column.key) {
      if (sortDirection === 'asc') newDirection = 'desc';
      else if (sortDirection === 'desc') newDirection = null;
      else newDirection = 'asc';
    }

    onSort(column.key, newDirection);
  };

  // Get cell alignment class
  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  // Cell padding based on compact mode
  const cellPadding = compact ? 'px-3 py-2' : 'px-6 py-4';

  return (
    <div className="w-full overflow-hidden">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table 
          className={`w-full text-left border-collapse ${className}`}
          {...props}
        >
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`
                    ${cellPadding}
                    text-xs font-semibold text-slate-500 uppercase tracking-wider
                    ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}
                    ${getAlignClass(column.align)}
                    ${column.sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''}
                  `}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                >
                  <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                    <span>{column.header}</span>
                    {column.sortable && (
                      <span className="inline-flex flex-col">
                        <ChevronUp 
                          size={12} 
                          className={sortKey === column.key && sortDirection === 'asc' ? 'text-blue-900' : 'text-slate-300'}
                        />
                        <ChevronDown 
                          size={12} 
                          className={`-mt-1 ${sortKey === column.key && sortDirection === 'desc' ? 'text-blue-900' : 'text-slate-300'}`}
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              // Loading skeleton rows
              Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {columns.map((column, colIndex) => (
                    <td 
                      key={`skeleton-${rowIndex}-${colIndex}`}
                      className={`${cellPadding} ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                    >
                      <Skeleton 
                        variant="text" 
                        width={colIndex === 0 ? '70%' : '90%'} 
                        height={compact ? 16 : 20}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty state
              <tr>
                <td 
                  colSpan={columns.length}
                  className="px-6 py-12 text-center"
                >
                  {emptyContent || (
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <svg 
                        className="w-12 h-12 mb-3 text-slate-300" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={1.5} 
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                        />
                      </svg>
                      <p className="text-sm">{emptyMessage}</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              // Data rows
              data.map((row, rowIndex) => {
                const isHighlighted = rowHighlight?.(row, rowIndex);
                const customRowClass = rowClassName?.(row, rowIndex);

                return (
                  <tr
                    key={rowIndex}
                    onClick={() => onRowClick?.(row, rowIndex)}
                    className={`
                      ${striped && rowIndex % 2 === 1 ? 'bg-slate-50/50' : ''}
                      ${hoverable && !onRowClick ? 'hover:bg-slate-50' : ''}
                      ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}
                      ${isHighlighted ? 'bg-blue-50 hover:bg-blue-100' : ''}
                      ${customRowClass || ''}
                      transition-colors duration-150
                    `}
                  >
                    {columns.map((column) => {
                      const cellValue = row[column.key as keyof T];
                      const content = column.render 
                        ? column.render(row, rowIndex)
                        : String(cellValue ?? '');

                      return (
                        <td
                          key={`${rowIndex}-${column.key}`}
                          className={`
                            ${cellPadding}
                            text-sm text-slate-900
                            ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}
                            ${getAlignClass(column.align)}
                          `}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && onPageChange && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-4 border-t border-slate-200 bg-white">
          <div className="text-sm text-slate-500">
            Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
            {pagination.totalItems} results
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              iconLeft={<ChevronLeft size={16} />}
            >
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first, last, current, and adjacent pages
                  return page === 1 || 
                         page === pagination.totalPages || 
                         Math.abs(page - pagination.currentPage) <= 1;
                })
                .reduce((acc: (number | string)[], page, index, arr) => {
                  if (index > 0) {
                    const prev = arr[index - 1] as number;
                    if (page - prev > 1) {
                      acc.push('...');
                    }
                  }
                  acc.push(page);
                  return acc;
                }, [])
                .map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
                      <MoreHorizontal size={16} />
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={pagination.currentPage === page ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => onPageChange(page as number)}
                      className="min-w-[36px]"
                    >
                      {page}
                    </Button>
                  )
                ))}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              iconRight={<ChevronRight size={16} />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sortable Table Hook - Helper for managing table sort state
 */
export function useTableSort<T>(
  data: T[],
  defaultSortKey?: string,
  defaultDirection: SortDirection = 'asc'
) {
  const [sortKey, setSortKey] = React.useState<string | null>(defaultSortKey ?? null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(defaultDirection);

  const handleSort = React.useCallback((key: string, direction: SortDirection) => {
    setSortKey(key);
    setSortDirection(direction);
  }, []);

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey as keyof T];
      const bValue = b[sortKey as keyof T];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  return {
    sortKey,
    sortDirection,
    handleSort,
    sortedData,
  };
}

/**
 * Pagination Hook - Helper for managing table pagination
 */
export function usePagination(
  totalItems: number,
  itemsPerPage: number = 10,
  initialPage: number = 1
) {
  const [currentPage, setCurrentPage] = React.useState(initialPage);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const pagination: PaginationInfo = {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
  };

  const handlePageChange = React.useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const paginatedData = React.useCallback(<T,>(data: T[]): T[] => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [currentPage, itemsPerPage]);

  return {
    pagination,
    handlePageChange,
    paginatedData,
    setPage: setCurrentPage,
  };
}

export default Table;
