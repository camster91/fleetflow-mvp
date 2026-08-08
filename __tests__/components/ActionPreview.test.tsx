import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ActionPreview } from '@/components/assistant/ActionPreview'

describe('ActionPreview', () => {
  beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ requiresConfirmation: true, token: 'signed', preview: { kind: 'write', label: 'Update delivery', before: { status: 'pending' }, after: { status: 'delivered' } } }) }) as never })
  it('shows exact before and after, then requires a separate confirmation click', async () => {
    render(<ActionPreview action={{ type: 'update_delivery_status', deliveryId: 'd1', values: { status: 'delivered' }, expectedUpdatedAt: '2026-08-08T12:00:00.000Z' }} sourceFindingId="f1" />)
    const trigger = screen.getByRole('button', { name: 'Preview suggested action' }); fireEvent.click(trigger); expect(await screen.findByText('pending')).toBeInTheDocument(); expect(screen.getByText('delivered')).toBeInTheDocument(); expect(screen.getByRole('heading', { name: 'Update delivery' })).toHaveFocus(); expect(fetch).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this change' })); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2)); expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body)).toEqual({ previewToken: 'signed', confirm: true }); await waitFor(() => expect(trigger).toHaveFocus())
  })
  it('can cancel a preview without mutation and restores trigger focus', async () => { render(<ActionPreview action={{ type: 'draft_weekly_summary' }} />); const trigger = screen.getByRole('button', { name: 'Preview suggested action' }); fireEvent.click(trigger); await screen.findByText(/Update delivery/); fireEvent.click(screen.getByRole('button', { name: 'Cancel suggested action' })); expect(screen.queryByText('pending')).not.toBeInTheDocument(); await waitFor(() => expect(trigger).toHaveFocus()); expect(fetch).toHaveBeenCalledTimes(1) })
  it('offers a copy control for non-mutating summary drafts', async () => { (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ requiresConfirmation: false, preview: { kind: 'read', label: 'Weekly draft', before: {}, after: { vehicles: 3 } } }) }); render(<ActionPreview action={{ type: 'draft_weekly_summary' }} />); fireEvent.click(screen.getByRole('button', { name: 'Preview suggested action' })); expect(await screen.findByRole('button', { name: 'Copy draft' })).toBeVisible(); expect(screen.queryByRole('button', { name: 'Confirm this change' })).not.toBeInTheDocument() })
  it('uses unique accessible dialog linkage for multiple instances', async () => {
    render(<><ActionPreview action={{ type: 'draft_weekly_summary' }} /><ActionPreview action={{ type: 'draft_weekly_summary' }} /></>)
    const triggers = screen.getAllByRole('button', { name: 'Preview suggested action' }); fireEvent.click(triggers[0]); fireEvent.click(triggers[1])
    const dialogs = await screen.findAllByRole('dialog'); const ids = dialogs.map(dialog => dialog.getAttribute('aria-labelledby'))
    expect(new Set(ids).size).toBe(2); ids.forEach(id => expect(document.getElementById(id!)).toHaveTextContent('Update delivery'))
    expect(document.body.textContent).not.toMatch(/â€¦|�/)
  })
})
