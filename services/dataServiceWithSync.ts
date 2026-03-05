// Enhanced data service with cloud sync
// Wraps the original dataService and adds synchronization

import * as originalDataService from './dataService';
import { getDataSync } from './dataSync';

// Re-export all types
export * from './dataService';

// Helper function to trigger sync after data modification
async function syncAfterOperation(dataType: 'vehicles' | 'deliveries' | 'maintenance' | 'clients' | 'sop' | 'vending-machines') {
  // Get current data from localStorage
  const storageKey = `fleetflow-${dataType}`;
  const localData = localStorage.getItem(storageKey);
  const data = localData ? JSON.parse(localData) : [];
  
  // Sync in background (don't wait for it)
  try {
    const dataSync = getDataSync();
    dataSync.saveToServer(dataType, data).catch(error => {
      console.error(`Background sync failed for ${dataType}:`, error);
    });
  } catch (error) {
    // dataSync not available (server-side rendering)
    console.warn(`DataSync not available for ${dataType} sync`);
  }
}

// Override vehicle operations
export const addVehicle = (vehicle: Omit<originalDataService.Vehicle, 'id'>): originalDataService.Vehicle => {
  const result = originalDataService.addVehicle(vehicle);
  syncAfterOperation('vehicles');
  return result;
};

export const updateVehicle = (id: number, updates: Partial<originalDataService.Vehicle>): originalDataService.Vehicle | null => {
  const result = originalDataService.updateVehicle(id, updates);
  if (result) {
    syncAfterOperation('vehicles');
  }
  return result;
};

export const deleteVehicle = (id: number): boolean => {
  const result = originalDataService.deleteVehicle(id);
  if (result) {
    syncAfterOperation('vehicles');
  }
  return result;
};

// Override delivery operations
export const addDelivery = (delivery: Omit<originalDataService.Delivery, 'id'>): originalDataService.Delivery => {
  const result = originalDataService.addDelivery(delivery);
  syncAfterOperation('deliveries');
  return result;
};

export const updateDelivery = (id: number, updates: Partial<originalDataService.Delivery>): originalDataService.Delivery | null => {
  const result = originalDataService.updateDelivery(id, updates);
  if (result) {
    syncAfterOperation('deliveries');
  }
  return result;
};

export const deleteDelivery = (id: number): boolean => {
  const result = originalDataService.deleteDelivery(id);
  if (result) {
    syncAfterOperation('deliveries');
  }
  return result;
};

// Override maintenance operations
export const addMaintenanceTask = (task: Omit<originalDataService.MaintenanceTask, 'id'>): originalDataService.MaintenanceTask => {
  const result = originalDataService.addMaintenanceTask(task);
  syncAfterOperation('maintenance');
  return result;
};

export const updateMaintenanceTask = (id: number, updates: Partial<originalDataService.MaintenanceTask>): originalDataService.MaintenanceTask | null => {
  const result = originalDataService.updateMaintenanceTask(id, updates);
  if (result) {
    syncAfterOperation('maintenance');
  }
  return result;
};

export const deleteMaintenanceTask = (id: number): boolean => {
  const result = originalDataService.deleteMaintenanceTask(id);
  if (result) {
    syncAfterOperation('maintenance');
  }
  return result;
};

// Override client operations
export const addClient = (client: Omit<originalDataService.Client, 'id' | 'created' | 'updated'>): originalDataService.Client => {
  const result = originalDataService.addClient(client);
  syncAfterOperation('clients');
  return result;
};

export const updateClient = (id: number, updates: Partial<Omit<originalDataService.Client, 'id' | 'created'>>): originalDataService.Client | null => {
  const result = originalDataService.updateClient(id, updates);
  if (result) {
    syncAfterOperation('clients');
  }
  return result;
};

export const deleteClient = (id: number): boolean => {
  const result = originalDataService.deleteClient(id);
  if (result) {
    syncAfterOperation('clients');
  }
  return result;
};

// Override SOP operations
export const addSOPCategory = (category: Omit<originalDataService.SOPCategory, 'id'>): originalDataService.SOPCategory => {
  const result = originalDataService.addSOPCategory(category);
  syncAfterOperation('sop');
  return result;
};

export const updateSOPCategory = (id: number, updates: Partial<originalDataService.SOPCategory>): originalDataService.SOPCategory | null => {
  const result = originalDataService.updateSOPCategory(id, updates);
  if (result) {
    syncAfterOperation('sop');
  }
  return result;
};

export const deleteSOPCategory = (id: number): boolean => {
  const result = originalDataService.deleteSOPCategory(id);
  if (result) {
    syncAfterOperation('sop');
  }
  return result;
};

// Override vending machine operations
export const addVendingMachine = (machine: Omit<originalDataService.VendingMachine, 'id' | 'notes' | 'created' | 'updated'>): originalDataService.VendingMachine => {
  const result = originalDataService.addVendingMachine(machine);
  syncAfterOperation('vending-machines');
  return result;
};

export const updateVendingMachine = (id: number, updates: Partial<Omit<originalDataService.VendingMachine, 'id' | 'created'>>): originalDataService.VendingMachine | null => {
  const result = originalDataService.updateVendingMachine(id, updates);
  if (result) {
    syncAfterOperation('vending-machines');
  }
  return result;
};

export const deleteVendingMachine = (id: number): boolean => {
  const result = originalDataService.deleteVendingMachine(id);
  if (result) {
    syncAfterOperation('vending-machines');
  }
  return result;
};

// Override vending machine note operations
export const addVendingMachineNote = (machineId: number, note: Omit<originalDataService.VendingMachineNote, 'id' | 'timestamp' | 'resolved'>): originalDataService.VendingMachine | null => {
  const result = originalDataService.addVendingMachineNote(machineId, note);
  if (result) {
    syncAfterOperation('vending-machines');
  }
  return result;
};

export const resolveVendingMachineNote = (machineId: number, noteId: number): originalDataService.VendingMachine | null => {
  const result = originalDataService.resolveVendingMachineNote(machineId, noteId);
  if (result) {
    syncAfterOperation('vending-machines');
  }
  return result;
};

export const deleteVendingMachineNote = (machineId: number, noteId: number): originalDataService.VendingMachine | null => {
  const result = originalDataService.deleteVendingMachineNote(machineId, noteId);
  if (result) {
    syncAfterOperation('vending-machines');
  }
  return result;
};

// Re-export all getter functions unchanged
export const getVehicles = originalDataService.getVehicles;
export const getDeliveries = originalDataService.getDeliveries;
export const getMaintenanceTasks = originalDataService.getMaintenanceTasks;
export const getClients = originalDataService.getClients;
export const getSOPCategories = originalDataService.getSOPCategories;
export const getAnnouncements = originalDataService.getAnnouncements;
export const getVendingMachines = originalDataService.getVendingMachines;
export const searchClients = originalDataService.searchClients;
export const getClientById = originalDataService.getClientById;
export const getStats = originalDataService.getStats;
export const resetToDefault = originalDataService.resetToDefault;

// Initialize sync on module load (client side only)
if (typeof window !== 'undefined') {
  // Load data from server on startup
  setTimeout(() => {
    try {
      const dataSync = getDataSync();
      dataSync.loadAllFromServer().catch(console.error);
    } catch (error) {
      console.warn('DataSync initialization failed:', error);
    }
  }, 1000);
  
  // Add manual sync to window for debugging
  (window as any).manualSync = () => {
    try {
      const dataSync = getDataSync();
      dataSync.manualSync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };
}