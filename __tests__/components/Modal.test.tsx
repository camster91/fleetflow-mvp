import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from '../../components/ui/Modal'

describe('Modal', () => {
  test('renders custom header and footer content', () => {
    render(
      <Modal isOpen onClose={jest.fn()} header={<h2>Custom heading</h2>} footer={<button>Continue</button>}>
        Modal body
      </Modal>
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Custom heading')).toBeInTheDocument()
    expect(screen.getByText('Modal body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  test('respects disabled escape and backdrop closing', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen onClose={onClose} title="Locked modal" closeOnEsc={false} closeOnBackdropClick={false}>
        Modal body
      </Modal>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('modal-backdrop'))

    expect(onClose).not.toHaveBeenCalled()
  })
})
