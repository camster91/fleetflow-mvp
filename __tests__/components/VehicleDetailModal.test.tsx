import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VehicleDetailModal from '../../components/VehicleDetailModal';
import { notify } from '../../services/notifications';

// Mock the notifications service
jest.mock('../../services/notifications');

describe('VehicleDetailModal', () => {
  const mockVehicle = {
    id: 1,
    name: 'Ford Transit Van',
    status: 'active' as const,
    driver: 'Maria Rodriguez',
    location: 'Downtown Delivery Zone',
    eta: '10:30 AM',
    mileage: 45230,
    maintenanceDue: false,
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing when not open or no vehicle', () => {
    const { container } = render(
      <VehicleDetailModal isOpen={false} onClose={mockOnClose} vehicle={mockVehicle} />
    );
    expect(container.firstChild).toBeNull();

    const { container: container2 } = render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={null} />
    );
    expect(container2.firstChild).toBeNull();
  });

  test('renders vehicle details when open', () => {
    render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />
    );

    // Check vehicle name is displayed
    expect(screen.getByText('Ford Transit Van')).toBeInTheDocument();
    
    // Check driver information
    expect(screen.getByText('Maria Rodriguez')).toBeInTheDocument();
    
    // Check location
    expect(screen.getByText('Downtown Delivery Zone')).toBeInTheDocument();
    
    // Check ETA
    expect(screen.getByText('10:30 AM')).toBeInTheDocument();
    
    // Check mileage
    expect(screen.getByText('45,230')).toBeInTheDocument();
    expect(screen.getByText('miles')).toBeInTheDocument();
    
    // Check status badge
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  test('displays tabs for different sections', () => {
    render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />
    );

    // Check all tabs are present
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  test('shows overview tab content by default', () => {
    render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />
    );

    // Overview tab should show key details
    expect(screen.getByText('Vehicle Details')).toBeInTheDocument();
    expect(screen.getByText('Driver Information')).toBeInTheDocument();
    expect(screen.getByText('Current Status')).toBeInTheDocument();
  });

  test('can switch between tabs', () => {
    render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />
    );

    // Click Maintenance tab
    fireEvent.click(screen.getByText('Maintenance'));
    
    // Should show maintenance content
    expect(screen.getByText('Maintenance History')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Services')).toBeInTheDocument();

    // Click Documents tab
    fireEvent.click(screen.getByText('Documents'));
    
    // Should show documents content
    expect(screen.getByText('Vehicle Documents')).toBeInTheDocument();
    expect(screen.getByText('Registration')).toBeInTheDocument();
    expect(screen.getByText('Insurance')).toBeInTheDocument();
  });

  test('Navigate button shows notification', () => {
    render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />
    );

    // Find and click Navigate button
    const navigateButton = screen.getByRole('button', { name: /navigate/i });
    fireEvent.click(navigateButton);
    
    // Check notification was called with correct info
    expect(notify.info).toHaveBeenCalledWith(
      expect.stringContaining('Navigating to Downtown Delivery Zone'),
      expect.any(Object)
    );
    expect(notify.info).toHaveBeenCalledWith(
      expect.stringContaining('Vehicle: Ford Transit Van'),
      expect.any(Object)
    );
    expect(notify.info).toHaveBeenCalledWith(
      expect.stringContaining('Driver: Maria Rodriguez'),
      expect.any(Object)
    );
  });

  test('Call Driver button shows notification', () => {
    render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />
    );

    // Find and click Call Driver button
    const callButton = screen.getByRole('button', { name: /call driver/i });
    fireEvent.click(callButton);
    
    // Check notification was called with correct info
    expect(notify.info).toHaveBeenCalledWith(
      expect.stringContaining('Calling Maria Rodriguez'),
      expect.any(Object)
    );
    expect(notify.info).toHaveBeenCalledWith(
      expect.stringContaining('Ford Transit Van'),
      expect.any(Object)
    );
  });

  test('close button calls onClose handler', () => {
    render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />
    );

    // Find and click close button (X icon)
    const closeButton = screen.getByRole('button', { name: '' }); // Empty aria-label for X button
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('shows maintenance due warning when applicable', () => {
    const vehicleWithMaintenanceDue = {
      ...mockVehicle,
      maintenanceDue: true,
    };

    render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={vehicleWithMaintenanceDue} />
    );

    // Should show maintenance warning
    expect(screen.getByText(/maintenance due/i)).toBeInTheDocument();
    expect(screen.getByText(/attention required/i)).toBeInTheDocument();
  });

  test('shows different status badges', () => {
    const inactiveVehicle = {
      ...mockVehicle,
      status: 'inactive' as const,
    };

    const { rerender } = render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={inactiveVehicle} />
    );

    expect(screen.getByText('Inactive')).toBeInTheDocument();

    const delayedVehicle = {
      ...mockVehicle,
      status: 'delayed' as const,
    };

    rerender(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={delayedVehicle} />
    );

    expect(screen.getByText('Delayed')).toBeInTheDocument();
  });

  test('displays action buttons with correct icons', () => {
    render(
      <VehicleDetailModal isOpen={true} onClose={mockOnClose} vehicle={mockVehicle} />
    );

    // Check for action buttons
    expect(screen.getByRole('button', { name: /navigate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /call driver/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view documents/i })).toBeInTheDocument();
  });
});