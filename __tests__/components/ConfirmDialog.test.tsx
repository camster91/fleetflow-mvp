import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  ConfirmDialogProvider,
  useConfirmDialog,
} from '../../components/ui/ConfirmDialog'
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
