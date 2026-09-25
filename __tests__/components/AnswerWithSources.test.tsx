import { render, screen } from '@testing-library/react'
import { AnswerWithSources } from '@/components/assistant/AnswerWithSources'

describe('AnswerWithSources', () => {
  it('renders every claim with visible, accessible internal source links', () => {
    render(
      <AnswerWithSources
        claims={[{ text: 'Delivery d1 is late.', citationIds: ['delivery:d1'] }]}
        sources={[
          { id: 'delivery:d1', type: 'delivery', recordId: 'd1', label: 'Delivery d1', href: '/deliveries?record=d1' },
        ]}
      />
    )
    expect(screen.getByText('Delivery d1 is late.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /source: delivery d1/i })).toHaveAttribute('href', '/deliveries?record=d1')
  })

  it('does not render missing or unsafe citation targets', () => {
    render(
      <AnswerWithSources
        claims={[{ text: 'Claim.', citationIds: ['x'] }]}
        sources={[{ id: 'x', type: 'delivery', recordId: 'x', label: 'Unsafe', href: 'https://evil.test' }]}
      />
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('Claim.')).not.toBeInTheDocument()
  })
})
