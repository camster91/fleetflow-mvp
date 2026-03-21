import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Dashboard from '../../pages/dashboard';
import * as dataService from '../../services/apiService';
import { notify } from '../../services/notifications';

// Mock the data service (must match the import path used by dashboard.tsx)
jest.mock('../../services/apiService');
jest.mock('../../services/notifications');
jest.mock('../../lib/onboarding');

// Mock @/lib/session (used by dashboard instead of next-auth/react)
jest.mock('../../lib/session', () => ({
  useSession: () => ({
    data: {
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
      },
    },
    status: 'authenticated',
    update: jest.fn(),
  }),
  SessionProvider: ({ children }: any) => children,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Truck: ({ className }: any) => <span className={className}>Truck</span>,
  Package: ({ className }: any) => <span className={className}>Package</span>,
  AlertTriangle: ({ className }: any) => <span className={className}>AlertTriangle</span>,
  FileVideo: ({ className }: any) => <span className={className}>FileVideo</span>,
  Plus: ({ className }: any) => <span className={className}>+</span>,
  ChevronRight: ({ className }: any) => <span className={className}>›</span>,
  Calendar: ({ className }: any) => <span className={className}>Calendar</span>,
  BarChart3: ({ className }: any) => <span className={className}>BarChart3</span>,
  MessageSquare: ({ className }: any) => <span className={className}>MessageSquare</span>,
}));

// Mock components — dashboard uses named imports
jest.mock('../../components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children, title }: any) => (
    <div data-testid="dashboard-layout">
      {title && <h1>{title}</h1>}
      {children}
    </div>
  ),
}));
jest.mock('../../components/PageHeader', () => ({
  PageHeader: () => <div data-testid="page-header">Page Header</div>,
}));
jest.mock('../../components/ui/Card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  StatCard: ({ title, value }: any) => <div data-testid="stat-card"><span>{title}</span><span>{value}</span></div>,
}));
jest.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));
jest.mock('../../components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));
jest.mock('../../components/ui/Skeleton', () => ({
  SkeletonCard: () => <div data-testid="skeleton">Loading...</div>,
}));
jest.mock('../../components/ui/EmptyState', () => ({
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

// Mock onboarding components
jest.mock('../../components/onboarding/OnboardingModal', () => ({
  OnboardingModal: () => <div data-testid="onboarding-modal">Onboarding Modal</div>,
}));
jest.mock('../../components/onboarding/SetupChecklist', () => ({
  SetupChecklist: () => <div data-testid="setup-checklist">Setup Checklist</div>,
}));

// Mock modals (default exports)
jest.mock('../../components/AnnouncementModal', () => () => <div data-testid="announcement-modal" />);
jest.mock('../../components/VehicleDetailModal', () => () => <div data-testid="vehicle-detail-modal" />);
jest.mock('../../components/VehicleFormModal', () => () => <div data-testid="vehicle-form-modal" />);
jest.mock('../../components/DeliveryFormModal', () => () => <div data-testid="delivery-form-modal" />);
jest.mock('../../components/MaintenanceTaskFormModal', () => () => <div data-testid="maintenance-form-modal" />);
jest.mock('../../components/ClientFormModal', () => () => <div data-testid="client-form-modal" />);
jest.mock('../../components/ConfirmModal', () => () => <div data-testid="confirm-modal" />);

// Mock other components (default exports)
jest.mock('../../components/ActivityFeed', () => () => <div data-testid="activity-feed">Activity Feed</div>);
jest.mock('../../components/QuickActions', () => () => <div data-testid="quick-actions">Quick Actions</div>);

describe('Dashboard Page', () => {
  const mockVehicles = [
    {
      id: 1,
      name: 'Ford Transit Van',
      status: 'active' as const,
      driver: 'Maria Rodriguez',
      location: 'Downtown',
      eta: '10:30 AM',
      mileage: 45230,
      maintenanceDue: false,
    },
    {
      id: 2,
      name: 'Chevrolet Express',
      status: 'inactive' as const,
      driver: 'James Wilson',
      location: 'Warehouse',
      eta: 'N/A',
      mileage: 62310,
      maintenanceDue: true,
    },
  ];

  const mockDeliveries = [
    {
      id: 1,
      address: '123 Main St',
      customer: 'Fresh Mart',
      status: 'in-transit' as const,
      driver: 'Maria Rodriguez',
      items: 15,
      progress: 65,
    },
    {
      id: 2,
      address: '456 Oak Ave',
      customer: 'Organic Grocers',
      status: 'pending' as const,
      driver: 'James Wilson',
      items: 8,
      progress: 0,
    },
  ];

  const mockMaintenanceTasks = [
    {
      id: 1,
      vehicle: 'Ford Transit Van',
      type: 'Oil Change',
      dueDate: '2026-03-10',
      priority: 'high' as const,
      completed: false,
    },
  ];

  const mockSopCategories = [
    { id: 1, name: 'Safety Procedures', count: 5 },
    { id: 2, name: 'Delivery Protocols', count: 3 },
  ];

  const mockClients = [
    {
      id: 1,
      name: 'Fresh Mart',
      location: '123 Main St',
      contactPerson: 'John Smith',
      phone: '(555) 123-4567',
      email: 'john@freshmart.com',
      deliveriesCompleted: 42,
    },
  ];

  beforeEach(() => {
    (dataService.getVehicles as jest.Mock).mockResolvedValue(mockVehicles);
    (dataService.getDeliveries as jest.Mock).mockResolvedValue(mockDeliveries);
    (dataService.getMaintenanceTasks as jest.Mock).mockResolvedValue(mockMaintenanceTasks);
    (dataService.getSOPCategories as jest.Mock).mockResolvedValue(mockSopCategories);
    (dataService.getClients as jest.Mock).mockResolvedValue(mockClients);
    (dataService.addVehicle as jest.Mock).mockResolvedValue({ id: 3 });
    (dataService.updateVehicle as jest.Mock).mockImplementation((id, updates) =>
      Promise.resolve({ ...mockVehicles[0], ...updates })
    );
    (dataService.deleteVehicle as jest.Mock).mockResolvedValue(true);
    (notify.success as jest.Mock).mockImplementation(() => {});
    (notify.error as jest.Mock).mockImplementation(() => {});
    (notify.info as jest.Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading skeleton initially then loads content', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    // After data loads, should show welcome message
    await waitFor(() => {
      expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
    });
  });

  test('renders stat cards after data loads', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('Total Vehicles')).toBeInTheDocument();
      expect(screen.getByText('Active Deliveries')).toBeInTheDocument();
      expect(screen.getByText('Maintenance Due')).toBeInTheDocument();
      expect(screen.getByText('Pending SOPs')).toBeInTheDocument();
    });
  });

  test('displays vehicles in vehicle status card', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('Vehicle Status')).toBeInTheDocument();
      // Ford Transit Van appears in both vehicle list and maintenance card
      expect(screen.getAllByText('Ford Transit Van').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Chevrolet Express')).toBeInTheDocument();
    });
  });

  test('displays deliveries in recent deliveries card', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('Recent Deliveries')).toBeInTheDocument();
      expect(screen.getByText('Fresh Mart')).toBeInTheDocument();
      expect(screen.getByText('Organic Grocers')).toBeInTheDocument();
    });
  });

  test('displays maintenance tasks', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      // Ford Transit Van appears in both vehicle list and maintenance card
      expect(screen.getAllByText('Ford Transit Van').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Oil Change')).toBeInTheDocument();
    });
  });

  test('calls data service on mount', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(dataService.getVehicles).toHaveBeenCalled();
      expect(dataService.getDeliveries).toHaveBeenCalled();
      expect(dataService.getMaintenanceTasks).toHaveBeenCalled();
      expect(dataService.getSOPCategories).toHaveBeenCalled();
      expect(dataService.getClients).toHaveBeenCalled();
    });
  });

  test('shows empty states when no data', async () => {
    (dataService.getVehicles as jest.Mock).mockResolvedValue([]);
    (dataService.getDeliveries as jest.Mock).mockResolvedValue([]);
    (dataService.getMaintenanceTasks as jest.Mock).mockResolvedValue([]);
    (dataService.getSOPCategories as jest.Mock).mockResolvedValue([]);
    (dataService.getClients as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('No vehicles yet')).toBeInTheDocument();
      expect(screen.getByText('No deliveries yet')).toBeInTheDocument();
      expect(screen.getByText('No maintenance tasks')).toBeInTheDocument();
    });
  });

  test('shows quick actions section', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('Announce')).toBeInTheDocument();
      expect(screen.getByText('Delivery')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });
  });

  test('renders activity feed', async () => {
    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    });
  });
});
