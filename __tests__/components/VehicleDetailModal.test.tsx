import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import VehicleDetailModal from '../../components/VehicleDetailModal'

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  Truck: () => <span>Truck</span>,
  MapPin: () => <span>MapPin</span>,
  Battery: () => <span>Battery</span>,
  Calendar: () => <span>Calendar</span>,
  Wrench: () => <span>Wrench</span>,
  Navigation: () => <span>Navigation</span>,
  Phone: () => <span>Phone</span>,
  Mail: () => <span>Mail</span>,
  FileText: () => <span>FileText</span>,
  Loader2: () => <span>Loader2</span>,
  CheckCircle: () => <span>CheckCircle</span>,
  Clock: () => <span>Clock</span>,
}))

describe('VehicleDetailModal', () => {
  const mockVehicle = {
    id: '1',
    name: 'Ford Transit Van',
    status: 'active' as const,
    driver: 'Maria Rodriguez',
    location: 'Downtown Delivery Zone',
    eta: '10:30 AM',
    mileage: 45230,
    maintenanceDue: false,
  }

  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset fetch mock to return empty data
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ maintenanceTasks: [], driverUser: null }),
    })
  })

  test('renders nothing when not open or no vehicle', () => {
    const { container } = render(<VehicleDetailModal isOpen={false} onClose={mockOnClose} vehicle={mockVehicle} />)
    expect(container.firstChild).toBeNull()

    const { container: container2 } = render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={null} />)
    expect(container2.firstChild).toBeNull()
  })

  test('renders vehicle details when open', async () => {
    await act(async () => {
      render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />)
    })

    expect(screen.getByText('Ford Transit Van')).toBeInTheDocument()
    expect(screen.getByText(/Maria Rodriguez/)).toBeInTheDocument()
    expect(screen.getByText('Downtown Delivery Zone')).toBeInTheDocument()
    expect(screen.getByText('10:30 AM')).toBeInTheDocument()
    // Status badge shows raw status
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  test('displays tabs for different sections', async () => {
    await act(async () => {
      render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />)
    })

    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Driver Info')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
  })

  test('shows overview tab content by default', async () => {
    await act(async () => {
      render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />)
    })

    expect(screen.getByText('Current Location')).toBeInTheDocument()
    expect(screen.getByText('ETA to Destination')).toBeInTheDocument()
    expect(screen.getByText('Vehicle Mileage')).toBeInTheDocument()
    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
  })

  test('can switch to maintenance tab', async () => {
    await act(async () => {
      render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Maintenance'))
    })

    // Maintenance tab shows maintenance status
    expect(screen.getByText('Maintenance Up to Date')).toBeInTheDocument()
  })

  test('navigate button opens maps', async () => {
    window.open = jest.fn()

    await act(async () => {
      render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />)
    })

    const navigateButton = screen.getByText('Navigate To')
    fireEvent.click(navigateButton)

    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('google.com/maps'), '_blank')
  })

  test('does not show a call action without a driver phone field', async () => {
    await act(async () => {
      render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />)
    })

    expect(screen.queryByText('Call Driver')).not.toBeInTheDocument()
    expect(screen.getByText('Navigate To')).toBeInTheDocument()
  })

  test('close button calls onClose handler', async () => {
    await act(async () => {
      render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />)
    })

    // Use the Close text button in the footer
    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  test('shows maintenance required when maintenanceDue is true', async () => {
    const vehicleWithMaintenanceDue = {
      ...mockVehicle,
      maintenanceDue: true,
    }

    await act(async () => {
      render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={vehicleWithMaintenanceDue} />)
    })

    // Switch to Maintenance tab
    await act(async () => {
      fireEvent.click(screen.getByText('Maintenance'))
    })

    expect(screen.getByText('Maintenance Required')).toBeInTheDocument()
    expect(screen.getByText(/immediate attention/i)).toBeInTheDocument()
  })

  test('shows different status badges', async () => {
    const inactiveVehicle = {
      ...mockVehicle,
      status: 'inactive' as const,
    }

    let result: ReturnType<typeof render>
    await act(async () => {
      result = render(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={inactiveVehicle} />)
    })

    expect(screen.getByText('inactive')).toBeInTheDocument()

    const delayedVehicle = {
      ...mockVehicle,
      status: 'delayed' as const,
    }

    await act(async () => {
      result!.rerender(<VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={delayedVehicle} />)
    })

    expect(screen.getByText('delayed')).toBeInTheDocument()
  })
})
