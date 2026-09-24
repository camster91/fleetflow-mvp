import { fireEvent, render, screen } from '@testing-library/react'
import AutocompleteInput, { highlightMatches } from '../../components/AutocompleteInput'

const payload = '<img src=x onerror=alert(1)>'

function renderInput(props: Partial<React.ComponentProps<typeof AutocompleteInput>> = {}) {
  return render(
    <AutocompleteInput
      value=""
      onChange={() => {}}
      recentItems={[]}
      label="Vehicle"
      {...props}
    />
  )
}

describe('AutocompleteInput highlighting', () => {
  it('renders a malicious vehicle name as text, not markup', () => {
    const { container } = renderInput({ recentItems: [payload], suggestions: [`Van ${payload}`] })
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'img' } })

    expect(container.querySelector('img')).toBeNull()
    const marks = container.querySelectorAll('mark')
    expect(marks.length).toBeGreaterThan(0)
    marks.forEach((mark) => {
      expect(mark.textContent).toBe('img')
      expect(mark.className).toBe('bg-primary-200 text-primary-900')
    })
    expect(screen.getAllByRole('button').some((button) => button.textContent === payload)).toBe(true)
  })

  it('does not throw when the query contains regex metacharacters', () => {
    const { container } = renderInput({ recentItems: ['Truck (north)', 'Van [A]'], suggestions: ['a+b', 'c.*d'] })
    const input = screen.getByRole('combobox')

    for (const value of ['(', '[', '+', '.*', '\\', ')(']) {
      expect(() => fireEvent.change(input, { target: { value } })).not.toThrow()
    }

    fireEvent.change(input, { target: { value: '(' } })
    const mark = container.querySelector('mark')
    expect(mark?.textContent).toBe('(')
  })

  it('highlights every case-insensitive match and preserves original casing', () => {
    const { container } = render(<span>{highlightMatches('Van VAN van', 'van')}</span>)
    const marks = Array.from(container.querySelectorAll('mark')).map((mark) => mark.textContent)
    expect(marks).toEqual(['Van', 'VAN', 'van'])
    expect(container.textContent).toBe('Van VAN van')
  })

  it('returns the text untouched for an empty query', () => {
    expect(highlightMatches('Truck', '')).toEqual(['Truck'])
  })
})
