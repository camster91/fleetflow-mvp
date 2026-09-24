import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FtueWizard } from '../../components/onboarding/FtueWizard'

describe('FtueWizard', () => {
  test('walks three steps and completes on skip', async () => {
    const onComplete = jest.fn()
    render(<FtueWizard firstName="Cam" dryRun onComplete={onComplete} />)

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Welcome, Cam/i })).toBeInTheDocument()
    expect(screen.getByText('Fleetvera')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('Vehicles')).toBeInTheDocument()
    expect(screen.getByText('Deliveries')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Step 3 of 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Skip and open dashboard/i }))
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })
})
