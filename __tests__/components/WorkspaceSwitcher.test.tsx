import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'

const mockReload = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ reload: mockReload }) }))

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          activeTeamId: 'team-1',
          workspaces: [
            { id: 'team-1', name: 'North Fleet', role: 'OWNER' },
            { id: 'team-2', name: 'South Fleet', role: 'MEMBER' },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true }) as jest.Mock
  })

  it('persists a selected workspace and reloads scoped data', async () => {
    render(<WorkspaceSwitcher />)
    const select = await screen.findByRole('combobox', { name: /workspace/i })

    await userEvent.selectOptions(select, 'team-2')

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/team/workspaces',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ teamId: 'team-2' }) })
    ))
    expect(mockReload).toHaveBeenCalled()
  })
})
