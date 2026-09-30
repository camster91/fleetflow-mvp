import { fireEvent, render, screen } from '@testing-library/react'
import InviteCustomerForm from '@/components/admin/InviteCustomerForm'

test('invites a customer and reports the result', async () => {
  const onInvited = jest.fn()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ emailSent: true }) }) as jest.Mock
  render(<InviteCustomerForm onInvited={onInvited} />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'riley@acme.test' } })
  fireEvent.change(screen.getByLabelText('Company (optional)'), { target: { value: 'Acme' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Invitation sent to riley@acme.test.')
  expect(onInvited).toHaveBeenCalled()
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/admin/users',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'riley@acme.test', company: 'Acme' }) })
  )
})

test('names the field on a conflict', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'An account with this email already exists' }),
  }) as jest.Mock
  render(<InviteCustomerForm onInvited={jest.fn()} />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'riley@acme.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
})
