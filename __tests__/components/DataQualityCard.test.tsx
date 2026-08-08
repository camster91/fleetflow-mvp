import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataQualityCard } from '@/components/intelligence/DataQualityCard'

const response = (body: unknown, ok = true) => Promise.resolve({ ok, json: async () => body })

describe('DataQualityCard', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows a labelled loading state', () => {
    global.fetch = jest.fn(() => new Promise(() => undefined)) as jest.Mock
    render(<DataQualityCard />)
    expect(screen.getByRole('status', { name: /checking fleet data quality/i })).toBeInTheDocument()
  })

  it('shows an empty success state when no issues are found', async () => {
    global.fetch = jest.fn(() => response({
      issues: [],
      summary: { total: 0, bySeverity: { high: 0, medium: 0, low: 0 }, byEntity: {}, countsComplete: true },
      coverage: { complete: true, sourceTruncated: false, issuesTruncated: false }, generatedAt: new Date().toISOString(),
    })) as jest.Mock
    render(<DataQualityCard />)
    expect(await screen.findByText(/fleet data is ready/i)).toBeInTheDocument()
  })

  it('shows prioritized issues with severity labels and direct record links', async () => {
    global.fetch = jest.fn(() => response({
      issues: [{
        id: 'delivery:d1:driver', entityType: 'delivery', entityId: 'd1',
        severity: 'high', field: 'driver', message: 'In-transit delivery needs an assigned driver.',
        actionUrl: '/deliveries?record=d1',
      }],
      summary: { total: 1, bySeverity: { high: 1, medium: 0, low: 0 }, byEntity: { delivery: 1 }, countsComplete: true },
      coverage: { complete: true, sourceTruncated: false, issuesTruncated: false }, generatedAt: new Date().toISOString(),
    })) as jest.Mock
    render(<DataQualityCard />)
    expect(await screen.findByText('High priority')).toBeInTheDocument()
    expect(screen.getByText(/needs an assigned driver/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /fix delivery record/i })).toHaveAttribute('href', '/deliveries?record=d1')
  })

  it('explains when source records were truncated and counts may be incomplete', async () => {
    global.fetch = jest.fn(() => response({
      issues: [], summary: { total: 0, bySeverity: {}, byEntity: {}, countsComplete: false },
      coverage: { complete: false, sourceTruncated: true, issuesTruncated: false }, generatedAt: new Date().toISOString(),
    })) as jest.Mock
    render(<DataQualityCard />)
    const partialMessage = await screen.findByText(/partial scan/i)
    expect(partialMessage.closest('[role="status"]')).toBeInTheDocument()
    expect(partialMessage).toHaveTextContent(/workspace scan is incomplete/i)
    expect(partialMessage).toHaveTextContent(/counts may be incomplete/i)
  })

  it('distinguishes a limited issue list from complete source counts', async () => {
    global.fetch = jest.fn(() => response({
      issues: [], summary: { total: 125, bySeverity: {}, byEntity: {}, countsComplete: true },
      coverage: { complete: false, sourceTruncated: false, issuesTruncated: true }, generatedAt: new Date().toISOString(),
    })) as jest.Mock
    render(<DataQualityCard />)
    const message = await screen.findByText(/issue list is limited/i)
    expect(message).toHaveTextContent(/counts include all scanned records/i)
    expect(message).not.toHaveTextContent(/counts may be incomplete/i)
  })

  it('explains both limits and renders only five highest-priority links', async () => {
    const issues = Array.from({ length: 8 }, (_, index) => ({
      id: `vehicle:v-${index}:mileage`, entityType: 'vehicle', entityId: `v-${index}`,
      severity: index < 2 ? 'high' : 'medium', field: 'mileage', message: `Issue ${index}`,
      actionUrl: `/vehicles?record=v-${index}`,
    }))
    global.fetch = jest.fn(() => response({
      issues, summary: { total: 200, bySeverity: { high: 2, medium: 198 }, byEntity: {}, countsComplete: false },
      coverage: { complete: false, sourceTruncated: true, issuesTruncated: true }, generatedAt: new Date().toISOString(),
    })) as jest.Mock
    render(<DataQualityCard />)
    const message = await screen.findByText(/workspace scan and issue list are limited/i)
    expect(message).toHaveTextContent(/counts may be incomplete/i)
    expect(screen.getAllByRole('link', { name: /fix vehicle record/i })).toHaveLength(5)
    expect(screen.getByText(/showing 5 of 8 returned issues/i)).toBeInTheDocument()
  })

  it('shows a safe retryable error state without raw response details', async () => {
    global.fetch = jest.fn(() => response({ error: 'postgres password secret' }, false)) as jest.Mock
    render(<DataQualityCard />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/could not check data quality/i)).toBeInTheDocument()
    expect(screen.queryByText(/postgres|secret/i)).not.toBeInTheDocument()
  })

  it('aborts the previous load on refresh and the active load on unmount', async () => {
    const signals: AbortSignal[] = []
    const complete = {
      issues: [], summary: { total: 0, bySeverity: {}, byEntity: {}, countsComplete: true },
      coverage: { complete: true, sourceTruncated: false, issuesTruncated: false }, generatedAt: new Date().toISOString(),
    }
    global.fetch = jest.fn((_url, init) => {
      signals.push((init as RequestInit).signal as AbortSignal)
      if (signals.length === 1) return response(complete)
      return new Promise(() => undefined)
    }) as jest.Mock
    const { unmount } = render(<DataQualityCard />)
    await screen.findByText(/fleet data is ready/i)

    await userEvent.click(screen.getByRole('button', { name: /check data quality again/i }))
    expect(signals).toHaveLength(2)
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)

    unmount()
    expect(signals[1].aborted).toBe(true)
  })
})
