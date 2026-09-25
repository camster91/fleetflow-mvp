import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfirmDialogProvider, useConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Button } from '../../components/ui/Button'

function ConfirmHarness() {
  const { openConfirm, openPrompt } = useConfirmDialog()
  return (
    <div>
      <Button
        onClick={async () => {
          const ok = await openConfirm({
            title: 'Remove member',
            message: 'They will lose access.',
            confirmLabel: 'Remove',
          })
          if (ok) document.body.setAttribute('data-confirm-result', 'yes')
          else document.body.setAttribute('data-confirm-result', 'no')
        }}
      >
        Open confirm
      </Button>
      <Button
        onClick={async () => {
          const value = await openPrompt({
            title: 'Report issue',
            message: 'Describe the issue',
            promptDefault: '',
            confirmLabel: 'Submit',
          })
          document.body.setAttribute('data-prompt-result', value ?? 'cancelled')
        }}
      >
        Open prompt
      </Button>
    </div>
  )
}

describe('ConfirmDialog', () => {
  test('confirm flow resolves true when confirmed', async () => {
    render(
      <ConfirmDialogProvider>
        <ConfirmHarness />
      </ConfirmDialogProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Remove member')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(document.body.getAttribute('data-confirm-result')).toBe('yes')
    })
  })

  test('prompt flow returns entered text', async () => {
    render(
      <ConfirmDialogProvider>
        <ConfirmHarness />
      </ConfirmDialogProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open prompt' }))
    const dialog = await screen.findByRole('alertdialog')
    const input = dialog.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Late delivery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(document.body.getAttribute('data-prompt-result')).toBe('Late delivery')
    })
  })
})

describe('ConfirmDialog async onConfirm', () => {
  function AsyncHarness({ action }: { action: () => Promise<void> }) {
    const { openConfirm } = useConfirmDialog()
    return (
      <Button
        onClick={async () => {
          const ok = await openConfirm({ title: 'Archive', message: 'Archive it?', onConfirm: action })
          document.body.setAttribute('data-async-result', ok ? 'yes' : 'no')
        }}
      >
        Open async
      </Button>
    )
  }

  beforeEach(() => document.body.removeAttribute('data-async-result'))

  test('stays open and re-enables controls when the action throws', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const action = jest.fn().mockRejectedValue(new Error('boom'))
    render(
      <ConfirmDialogProvider>
        <AsyncHarness action={action} />
      </ConfirmDialogProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open async' }))
    await screen.findByRole('alertdialog')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled())
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(action).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(document.body.getAttribute('data-async-result')).toBe('no'))
    errorSpy.mockRestore()
  })

  test('traps Tab focus inside the dialog', async () => {
    render(
      <ConfirmDialogProvider>
        <AsyncHarness action={jest.fn().mockResolvedValue(undefined)} />
      </ConfirmDialogProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open async' }))
    await screen.findByRole('alertdialog')
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    confirm.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(cancel).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()
  })
})
