import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockPush = jest.fn()
const mockSignIn = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ push: mockPush, query: {}, isReady: true }) }))
jest.mock('@/lib/session', () => ({
  sendCode: jest.fn().mockResolvedValue({}),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }))
jest.mock('../../components/layouts/AuthLayout', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import LoginPage from '@/pages/auth/login'

async function reachCodeStep() {
  render(<LoginPage />)
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'driver@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send Login Code' }))
  await screen.findByLabelText('Login code digit 6')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSignIn.mockResolvedValue({ error: 'Invalid code' })
})

test('keeps every digit when several arrive before a re-render (fast typing, code autofill)', async () => {
  await reachCodeStep()
  // Inside one act() React batches the updates, so each handler runs before the previous one renders.
  act(() => {
    ;['4', '8', '1', '5', '9', '2'].forEach((digit, index) =>
      fireEvent.change(screen.getByLabelText(`Login code digit ${index + 1}`), { target: { value: digit } })
    )
  })
  await waitFor(() =>
    expect(mockSignIn).toHaveBeenCalledWith(
      'credentials',
      expect.objectContaining({ email: 'driver@example.com', code: '481592' })
    )
  )
})

test('does not pull focus back to the first digit once the user has started typing', async () => {
  jest.useFakeTimers()
  try {
    await reachCodeStep()
    fireEvent.change(screen.getByLabelText('Login code digit 1'), { target: { value: '4' } })
    expect(screen.getByLabelText('Login code digit 2')).toHaveFocus()
    act(() => jest.advanceTimersByTime(150))
    expect(screen.getByLabelText('Login code digit 2')).toHaveFocus()
  } finally {
    jest.useRealTimers()
  }
})
