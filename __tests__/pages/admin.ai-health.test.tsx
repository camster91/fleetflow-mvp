import { render, screen } from '@testing-library/react'
jest.mock('@/lib/session', () => ({ useSession: () => ({ status: 'authenticated', data: { user: { role: 'admin' } } }) }))
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
import AiHealthPage from '@/pages/admin/ai-health'

test('AI health page exposes accessible status, usage, fallback, errors, and evaluation landmarks', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: 'enabled', provider: 'openai', modelVersion: 'gpt@v1', configVersion: 2, requests: 3, averageLatencyMs: 200, fallbackRate: 1 / 3, inputTokens: 20, outputTokens: 10, errors: [{ code: 'timeout', count: 1 }], evaluation: { version: 'fixtures@v1', passed: true, runAt: '2026-08-08T01:00:00.000Z' } }) })) as jest.Mock
  const { container } = render(<AiHealthPage />)
  expect(await screen.findByRole('heading', { name: 'AI health' })).toBeInTheDocument(); expect(screen.getByText('Enabled')).toBeInTheDocument(); expect(screen.getByText(/fixtures@v1/)).toBeInTheDocument(); expect(screen.getByRole('table', { name: 'AI errors' })).toBeInTheDocument(); expect(screen.getByRole('checkbox', { name: 'Enable AI for this workspace' })).toBeChecked(); expect(screen.getByRole('button', { name: 'Save AI controls' })).toBeInTheDocument()
  expect(screen.getByText('openai / gpt@v1 / config v2')).toBeInTheDocument()
  expect(container.textContent).not.toMatch(/(?:\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u0080-\u00bf]{2}|\ufffd)/u)
})
