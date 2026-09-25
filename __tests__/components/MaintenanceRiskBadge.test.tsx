import { fireEvent, render, screen } from '@testing-library/react'
import { MaintenanceRiskBadge } from '@/components/intelligence/MaintenanceRiskBadge'

const risk = {
  vehicleId: 'v1',
  vehicleName: 'Van 1',
  score: 55,
  band: 'high' as const,
  wording: 'High maintenance attention based on recorded operational indicators.',
  factors: [
    {
      code: 'overdue-maintenance',
      label: 'Overdue maintenance',
      points: 30,
      evidence: 'One task is 31 days overdue.',
      sourceIds: ['t1'],
      links: ['/maintenance?record=t1'],
    },
  ],
  missingData: ['Valid mileage at last service is unavailable.'],
  completeness: { available: 6, expected: 7, percent: 86 },
  rubricVersion: 'maintenance-risk-v1',
  generatedAt: '2026-08-08T00:00:00.000Z',
  sourceComplete: true,
}

it('discloses evidence and missing data with an accessible button', () => {
  render(<MaintenanceRiskBadge risk={risk} />)
  const button = screen.getByRole('button', { name: /Van 1.*55 points.*high/i })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('One task is 31 days overdue.')).not.toBeInTheDocument()
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('One task is 31 days overdue.')).toBeVisible()
  expect(screen.getByRole('link', { name: /source 1/i })).toHaveAttribute('href', '/maintenance?record=t1')
  expect(screen.getByText(/not a failure prediction/i)).toBeVisible()
  expect(JSON.stringify(risk)).not.toMatch(/probability|failure chance/i)
})

it('captures consented helpfulness and operational outcomes without predictive labels', async () => {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => ({ feedback: { id: 'f1' } }) } as Response)
  render(<MaintenanceRiskBadge risk={risk} />)
  fireEvent.click(screen.getByRole('button', { name: /Van 1.*55 points/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Helpful' }))
  expect(screen.getByRole('button', { name: 'Save pilot feedback' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /I consent/i }))
  fireEvent.click(screen.getByRole('checkbox', { name: /I took an action/i }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Operational outcome' }), {
    target: { value: 'SERVICE_SCHEDULED' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Optional pilot notes' }), {
    target: { value: 'Booked for Monday.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save pilot feedback' }))
  expect(await screen.findByText('Pilot feedback saved.')).toBeVisible()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/intelligence/maintenance-risk-feedback',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': expect.stringMatching(/^pilot_/) }),
      body: JSON.stringify({
        vehicleId: 'v1',
        helpful: true,
        actionTaken: true,
        outcomeCategory: 'SERVICE_SCHEDULED',
        notes: 'Booked for Monday.',
        consent: true,
      }),
    })
  )
  expect(document.body.textContent).not.toMatch(/probability|predicted failure/i)
  fetchMock.mockRestore()
})

it('reuses the idempotency key after an unknown save result and allows withdrawal', async () => {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockRejectedValueOnce(new Error('lost response'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ feedback: { id: 'f1' } }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ withdrawn: true }) } as Response)
  render(<MaintenanceRiskBadge risk={risk} />)
  fireEvent.click(screen.getByRole('button', { name: /Van 1.*55 points/i }))
  fireEvent.click(screen.getByRole('button', { name: /^Helpful$/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /I consent/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Save pilot feedback' }))
  expect(await screen.findByText(/Save status unknown/i)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Save pilot feedback' }))
  expect(await screen.findByText('Pilot feedback saved.')).toBeVisible()
  const firstKey = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
  const secondKey = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>
  expect(firstKey['Idempotency-Key']).toBe(secondKey['Idempotency-Key'])
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw pilot feedback' }))
  expect(await screen.findByText('Pilot feedback withdrawn.')).toBeVisible()
  expect(fetchMock.mock.calls[2]).toEqual([
    '/api/intelligence/maintenance-risk-feedback',
    expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ id: 'f1' }) }),
  ])
  fetchMock.mockRestore()
})

it('reports an idempotency conflict truthfully and offers a new submission', async () => {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'conflict' }) } as Response)
  render(<MaintenanceRiskBadge risk={risk} />)
  fireEvent.click(screen.getByRole('button', { name: /Van 1.*55 points/i }))
  fireEvent.click(screen.getByRole('button', { name: /^Helpful$/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /I consent/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Save pilot feedback' }))
  expect(await screen.findByText(/submission key was already used for different feedback/i)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Start new feedback' })).toBeVisible()
  fetchMock.mockRestore()
})

it('uses a compact wrapping layout suitable for narrow screens', () => {
  render(<MaintenanceRiskBadge risk={{ ...risk, band: 'watch', score: 25 }} />)
  expect(screen.getByTestId('maintenance-risk-badge')).toHaveClass('w-full')
  expect(screen.getByRole('button')).toHaveClass('min-h-11')
})
