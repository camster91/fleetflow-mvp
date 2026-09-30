import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockPush = jest.fn()
const mockUpdate = jest.fn()
const mockToastError = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { name: 'Riley Stone' } }, update: mockUpdate }),
}))
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: (m: string) => mockToastError(m), success: jest.fn() },
}))
jest.mock('@/components/onboarding/FtueWizard', () => ({
  FtueWizard: ({ onComplete, firstName }: { onComplete: () => void; firstName: string }) => (
    <button onClick={() => void onComplete()}>Finish setup for {firstName}</button>
  ),
}))

import OnboardingPage from '@/pages/onboarding'

beforeEach(() => jest.clearAllMocks())

test('refreshes the session before leaving so the onboarding guard does not bounce the user back', async () => {
  const order: string[] = []
  mockUpdate.mockImplementation(async () => {
    order.push('update')
  })
  mockPush.mockImplementation(() => order.push('push'))
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }) as jest.Mock
  render(<OnboardingPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Finish setup for Riley' }))
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
  expect(global.fetch).toHaveBeenCalledWith('/api/auth/complete-onboarding', { method: 'POST' })
  expect(order).toEqual(['update', 'push'])
})

test('stays on the page and says so when setup cannot be saved', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as jest.Mock
  render(<OnboardingPage />)
  fireEvent.click(screen.getByRole('button', { name: /Finish setup/ }))
  await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Setup could not be saved. Please try again.'))
  expect(mockUpdate).not.toHaveBeenCalled()
  expect(mockPush).not.toHaveBeenCalled()
})
