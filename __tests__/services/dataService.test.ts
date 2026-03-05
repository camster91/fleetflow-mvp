import * as dataService from '../../services/dataServiceWithSync';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    length: 0,
    key: jest.fn((index: number) => ''),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('DataService', () => {
  beforeEach(() => {
    // Clear all mocks and localStorage
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Reset data version
    localStorageMock.setItem('fleetflow-data-version', '1.0.0');
  });

  describe('Vehicle Operations', () => {
    const testVehicle = {
      name: 'Test Vehicle',
      status: 'active' as const,
      driver: 'Test Driver',
      location: 'Test Location',
      eta: '12:00 PM',
      mileage: 10000,
      maintenanceDue: false,
    };

    test('addVehicle creates new vehicle with unique ID', () => {
      // Initially no vehicles
      localStorageMock.setItem('fleetflow-vehicles', JSON.stringify([]));
      
      const result = dataService.addVehicle(testVehicle);
      
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Vehicle');
      expect(result.lastUpdated).toBeDefined();
      
      // Check it was saved to localStorage
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls.find(call => call[0] === 'fleetflow-vehicles')?.[1] || '[]');
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe(1);
    });

    test('getVehicles returns all vehicles', () => {
      const vehicles = [
        { ...testVehicle, id: 1, lastUpdated: '2026-03-05T10:00:00.000Z' },
        { ...testVehicle, id: 2, name: 'Vehicle 2', lastUpdated: '2026-03-05T10:00:00.000Z' },
      ];
      localStorageMock.setItem('fleetflow-vehicles', JSON.stringify(vehicles));
      
      const result = dataService.getVehicles();
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Vehicle');
      expect(result[1].name).toBe('Vehicle 2');
    });

    test('updateVehicle modifies existing vehicle', () => {
      const vehicles = [
        { ...testVehicle, id: 1, lastUpdated: '2026-03-05T10:00:00.000Z' },
      ];
      localStorageMock.setItem('fleetflow-vehicles', JSON.stringify(vehicles));
      
      const updates = { name: 'Updated Vehicle', mileage: 15000 };
      const result = dataService.updateVehicle(1, updates);
      
      expect(result?.name).toBe('Updated Vehicle');
      expect(result?.mileage).toBe(15000);
      expect(result?.lastUpdated).not.toBe('2026-03-05T10:00:00.000Z');
      
      // Verify the update was saved
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls.find(call => call[0] === 'fleetflow-vehicles')?.[1] || '[]');
      expect(savedData[0].name).toBe('Updated Vehicle');
    });

    test('deleteVehicle removes vehicle', () => {
      const vehicles = [
        { ...testVehicle, id: 1, lastUpdated: '2026-03-05T10:00:00.000Z' },
        { ...testVehicle, id: 2, name: 'Vehicle 2', lastUpdated: '2026-03-05T10:00:00.000Z' },
      ];
      localStorageMock.setItem('fleetflow-vehicles', JSON.stringify(vehicles));
      
      const result = dataService.deleteVehicle(1);
      
      expect(result).toBe(true);
      
      // Verify only vehicle 2 remains
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls.find(call => call[0] === 'fleetflow-vehicles')?.[1] || '[]');
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe(2);
    });
  });

  describe('Delivery Operations', () => {
    const testDelivery = {
      address: '123 Test St',
      customer: 'Test Customer',
      status: 'pending' as const,
      driver: 'Test Driver',
      items: 10,
      progress: 0,
    };

    test('getDeliveries returns all deliveries', () => {
      const deliveries = [
        { ...testDelivery, id: 1 },
        { ...testDelivery, id: 2, customer: 'Customer 2' },
      ];
      localStorageMock.setItem('fleetflow-deliveries', JSON.stringify(deliveries));
      
      const result = dataService.getDeliveries();
      
      expect(result).toHaveLength(2);
      expect(result[0].customer).toBe('Test Customer');
      expect(result[1].customer).toBe('Customer 2');
    });

    test('addDelivery creates new delivery with unique ID', () => {
      localStorageMock.setItem('fleetflow-deliveries', JSON.stringify([]));
      
      const result = dataService.addDelivery(testDelivery);
      
      expect(result.id).toBe(1);
      expect(result.customer).toBe('Test Customer');
    });

    test('updateDelivery modifies existing delivery', () => {
      const deliveries = [
        { ...testDelivery, id: 1 },
      ];
      localStorageMock.setItem('fleetflow-deliveries', JSON.stringify(deliveries));
      
      const updates = { status: 'in-transit' as const, progress: 50 };
      const result = dataService.updateDelivery(1, updates);
      
      expect(result?.status).toBe('in-transit');
      expect(result?.progress).toBe(50);
    });
  });

  describe('Maintenance Task Operations', () => {
    const testTask = {
      vehicle: 'Test Vehicle',
      type: 'Oil Change',
      dueDate: '2026-03-10',
      priority: 'high' as const,
      completed: false,
    };

    test('getMaintenanceTasks returns all tasks', () => {
      const tasks = [
        { ...testTask, id: 1 },
        { ...testTask, id: 2, type: 'Tire Rotation' },
      ];
      localStorageMock.setItem('fleetflow-maintenance-tasks', JSON.stringify(tasks));
      
      const result = dataService.getMaintenanceTasks();
      
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('Oil Change');
      expect(result[1].type).toBe('Tire Rotation');
    });

    test('addMaintenanceTask creates new task', () => {
      localStorageMock.setItem('fleetflow-maintenance-tasks', JSON.stringify([]));
      
      const result = dataService.addMaintenanceTask(testTask);
      
      expect(result.id).toBe(1);
      expect(result.type).toBe('Oil Change');
    });

    test('completeMaintenanceTask marks task as completed', () => {
      const tasks = [
        { ...testTask, id: 1 },
      ];
      localStorageMock.setItem('fleetflow-maintenance-tasks', JSON.stringify(tasks));
      
      const result = dataService.completeMaintenanceTask(1);
      
      expect(result?.completed).toBe(true);
      expect(result?.completedDate).toBeDefined();
    });
  });

  describe('SOP Category Operations', () => {
    const testCategory = {
      name: 'Test Category',
      count: 5,
    };

    test('getSOPCategories returns all categories', () => {
      const categories = [
        { ...testCategory, id: 1 },
        { ...testCategory, id: 2, name: 'Category 2' },
      ];
      localStorageMock.setItem('fleetflow-sop-categories', JSON.stringify(categories));
      
      const result = dataService.getSOPCategories();
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Category');
      expect(result[1].name).toBe('Category 2');
    });

    test('addSOPCategory creates new category', () => {
      localStorageMock.setItem('fleetflow-sop-categories', JSON.stringify([]));
      
      const result = dataService.addSOPCategory(testCategory);
      
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Category');
    });

    test('updateSOPCategory modifies category', () => {
      const categories = [
        { ...testCategory, id: 1 },
      ];
      localStorageMock.setItem('fleetflow-sop-categories', JSON.stringify(categories));
      
      const updates = { count: 10 };
      const result = dataService.updateSOPCategory(1, updates);
      
      expect(result?.count).toBe(10);
    });
  });

  describe('Client Operations', () => {
    const testClient = {
      name: 'Test Client',
      location: '123 Test St',
      contactPerson: 'Test Contact',
      phone: '(555) 123-4567',
      email: 'test@client.com',
      deliveriesCompleted: 0,
    };

    test('getClients returns all clients', () => {
      const clients = [
        { ...testClient, id: 1 },
        { ...testClient, id: 2, name: 'Client 2' },
      ];
      localStorageMock.setItem('fleetflow-clients', JSON.stringify(clients));
      
      const result = dataService.getClients();
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Client');
      expect(result[1].name).toBe('Client 2');
    });

    test('addClient creates new client', () => {
      localStorageMock.setItem('fleetflow-clients', JSON.stringify([]));
      
      const result = dataService.addClient(testClient);
      
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Client');
    });

    test('updateClient modifies client', () => {
      const clients = [
        { ...testClient, id: 1 },
      ];
      localStorageMock.setItem('fleetflow-clients', JSON.stringify(clients));
      
      const updates = { deliveriesCompleted: 10 };
      const result = dataService.updateClient(1, updates);
      
      expect(result?.deliveriesCompleted).toBe(10);
    });
  });

  describe('Data Initialization', () => {
    test('initializes data when version changes', () => {
      // Clear mock calls first
      localStorageMock.removeItem.mockClear();
      localStorageMock.setItem.mockClear();
      
      // Set old version
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'fleetflow-data-version') return '0.9.0';
        return null;
      });
      
      // Call getVehicles which triggers initialization
      dataService.getVehicles();
      
      // Check that version was updated
      expect(localStorageMock.setItem).toHaveBeenCalledWith('fleetflow-data-version', '1.0.0');
      
      // Check seed data was initialized (vehicles key was set)
      const vehiclesCall = localStorageMock.setItem.mock.calls.find(call => call[0] === 'fleetflow-vehicles');
      expect(vehiclesCall).toBeDefined();
      const savedVehicles = JSON.parse(vehiclesCall?.[1] || '[]');
      expect(savedVehicles).toBeInstanceOf(Array);
    });

    test('preserves existing data when version matches', () => {
      // Clear mock calls
      localStorageMock.removeItem.mockClear();
      localStorageMock.setItem.mockClear();
      
      // Set current version and existing data
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'fleetflow-data-version') return '1.0.0';
        if (key === 'fleetflow-vehicles') return JSON.stringify([{ id: 1, name: 'Existing Vehicle' }]);
        return null;
      });
      
      // Call getVehicles
      const result = dataService.getVehicles();
      
      // Data should not be cleared
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 1, name: 'Existing Vehicle' }]);
    });
  });
});