import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TeamWorkspaceSetup } from '@/components/team/TeamWorkspaceSetup'

const reload = jest.fn()
beforeEach(() => jest.clearAllMocks())

test('creates a team and reloads into it', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ team: { id: 't1' } }) }) as jest.Mock
  render(<TeamWorkspaceSetup workspaces={[]} onDone={reload} />)
  expect(screen.getByRole('heading', { name: 'Work with your team' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Northside' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create team' }))
  await waitFor(() => expect(reload).toHaveBeenCalled())
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/team/create',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Northside' }) })
  )
})

test('shows the server error on the field', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: false, json: async () => ({ error: 'You already own a team workspace' }) }) as jest.Mock
  render(<TeamWorkspaceSetup workspaces={[{ id: 'j1', name: 'Joined Co', role: 'MEMBER' }]} onDone={reload} />)
  fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Mine' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create team' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('already own a team')
  expect(screen.getByLabelText('Team name')).toHaveAttribute('aria-invalid', 'true')
  expect(reload).not.toHaveBeenCalled()
})

test('an owner in their personal workspace is offered a switch, not a second team', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as jest.Mock
  render(<TeamWorkspaceSetup workspaces={[{ id: 'own', name: 'Northside', role: 'OWNER' }]} onDone={reload} />)
  expect(screen.queryByLabelText('Team name')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open Northside' }))
  await waitFor(() => expect(reload).toHaveBeenCalled())
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/team/workspaces',
    expect.objectContaining({ body: JSON.stringify({ teamId: 'own' }) })
  )
})
