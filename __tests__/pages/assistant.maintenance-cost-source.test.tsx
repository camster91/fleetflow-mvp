import { render, screen } from '@testing-library/react'
import MaintenanceCostSourcePage from '@/pages/assistant/sources/maintenance-cost'
jest.mock('next/router', () => ({ useRouter: () => ({ isReady: true, query: { vehicle: 'v1' } }) }))
jest.mock('@/components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
describe('maintenance cost source page', () => {
  it('visibly substantiates the authoritative total/count and contributing links', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ vehicleId: 'v1', total: 500, count: 12, contributors: [{ id: 'm1', actualCost: 100, href: '/maintenance?record=m1' }], contributorsTruncated: true }) }) as jest.Mock
    render(<MaintenanceCostSourcePage />)
    expect(await screen.findByText('$500.00')).toBeInTheDocument(); expect(screen.getByText(/12 recorded maintenance entries/i)).toBeInTheDocument(); expect(screen.getByRole('link', { name: /maintenance record m1/i })).toHaveAttribute('href', '/maintenance?record=m1'); expect(screen.getByText(/additional contributing records/i)).toBeInTheDocument()
  })
})
