import { fireEvent, render, screen, within } from '@testing-library/react'
import { Pagination, SortSelect } from '@/components/ui/Pagination'

const renderPagination = (props: Partial<React.ComponentProps<typeof Pagination>> = {}) => {
  const onPageChange = jest.fn()
  const onPageSizeChange = jest.fn()
  render(
    <Pagination
      label="vehicles"
      page={2}
      pageSize={25}
      total={60}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...props}
    />
  )
  return { onPageChange, onPageSizeChange }
}

describe('Pagination', () => {
  it('is a labelled navigation landmark with a polite range summary', () => {
    renderPagination()
    const nav = screen.getByRole('navigation', { name: 'Vehicles pagination' })
    expect(within(nav).getByText('Showing 26–50 of 60 vehicles')).toHaveAttribute('aria-live', 'polite')
    expect(within(nav).getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('moves between pages with labelled 44px controls', () => {
    const { onPageChange } = renderPagination()
    for (const name of ['First page', 'Previous page', 'Next page', 'Last page']) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-11', 'min-w-11')
    }
    fireEvent.click(screen.getByRole('button', { name: 'First page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Last page' }))
    expect(onPageChange.mock.calls).toEqual([[1], [1], [3], [3]])
  })

  it('disables controls at the ends and while loading', () => {
    renderPagination({ page: 1 })
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  })

  it('handles the last page, a single page and an empty list', () => {
    renderPagination({ page: 3 })
    expect(screen.getByText('Showing 51–60 of 60 vehicles')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('shows "No vehicles" for an empty list with every control disabled', () => {
    renderPagination({ page: 1, total: 0 })
    expect(screen.getByText('No vehicles')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
    for (const name of ['First page', 'Previous page', 'Next page', 'Last page'])
      expect(screen.getByRole('button', { name })).toBeDisabled()
  })

  it('disables everything while a page is loading', () => {
    renderPagination({ disabled: true })
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toBeDisabled()
  })

  it('offers 25/50/100 rows per page', () => {
    const { onPageSizeChange } = renderPagination()
    const select = screen.getByRole('combobox', { name: 'Rows per page' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['25', '50', '100'])
    fireEvent.change(select, { target: { value: '100' } })
    expect(onPageSizeChange).toHaveBeenCalledWith(100)
  })
})

describe('SortSelect', () => {
  const options = [
    { value: '', label: 'Date added' },
    { value: 'name', label: 'Name (A–Z)', order: 'asc' as const },
    { value: 'name', label: 'Name (Z–A)', order: 'desc' as const },
  ]

  it('reflects the current sort and reports sort + order changes', () => {
    const onChange = jest.fn()
    render(<SortSelect id="s" options={options} sort="name" order="desc" onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: 'Sort by' })
    expect((select as HTMLSelectElement).selectedOptions[0].textContent).toBe('Name (Z–A)')
    fireEvent.change(select, { target: { value: 'name|asc' } })
    expect(onChange).toHaveBeenLastCalledWith('name', 'asc')
    fireEvent.change(select, { target: { value: '|' } })
    expect(onChange).toHaveBeenLastCalledWith('', undefined)
  })
})
