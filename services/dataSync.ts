// Data synchronization service
// Syncs localStorage data with backend API

import { notify } from './notifications';

const API_BASE = '/api';

// Data type mapping
type DataType = 'vehicles' | 'deliveries' | 'maintenance' | 'clients' | 'sop' | 'vending-machines';

interface SyncResult {
  success: boolean;
  dataType: DataType;
  error?: string;
  timestamp: Date;
}

interface SyncStatus {
  [key: string]: {
    lastSync: Date | null;
    syncing: boolean;
    error: string | null;
  };
}

class DataSync {
  private status: SyncStatus = {};
  private syncQueue: Array<{ dataType: DataType; data: any[] }> = [];
  private isProcessingQueue = false;
  private syncInProgress = false;

  constructor() {
    // Initialize status for all data types
    const dataTypes: DataType[] = ['vehicles', 'deliveries', 'maintenance', 'clients', 'sop', 'vending-machines'];
    dataTypes.forEach(type => {
      this.status[type] = {
        lastSync: null,
        syncing: false,
        error: null
      };
    });

    // Set up periodic sync
    this.setupPeriodicSync();
    
    // Set up beforeunload sync
    this.setupBeforeUnloadSync();
  }

  private setupPeriodicSync() {
    // Sync every 30 seconds
    setInterval(() => {
      this.syncAll().catch(console.error);
    }, 30000);

    // Initial sync after 2 seconds (let app load first)
    setTimeout(() => {
      this.loadAllFromServer().catch(console.error);
    }, 2000);
  }

  private setupBeforeUnloadSync() {
    window.addEventListener('beforeunload', () => {
      if (this.syncInProgress) {
        // Don't navigate away while syncing
        return 'Data is being saved. Please wait...';
      }
      
      // Try a quick sync before leaving
      this.syncAll(true).catch(console.error);
    });
  }

  async loadFromServer(dataType: DataType): Promise<any[]> {
    try {
      this.status[dataType].syncing = true;
      
      const response = await fetch(`${API_BASE}/sync-data?dataType=${dataType}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${dataType}: ${response.statusText}`);
      }
      
      const result = await response.json();
      const data = result.data || [];
      
      // Update localStorage
      localStorage.setItem(`fleetflow-${dataType}`, JSON.stringify(data));
      
      this.status[dataType].lastSync = new Date();
      this.status[dataType].error = null;
      
      console.log(`Loaded ${data.length} ${dataType} from server`);
      return data;
    } catch (error) {
      console.error(`Failed to load ${dataType} from server:`, error);
      this.status[dataType].error = error instanceof Error ? error.message : 'Unknown error';
      
      // Return localStorage data as fallback
      const localData = localStorage.getItem(`fleetflow-${dataType}`);
      return localData ? JSON.parse(localData) : [];
    } finally {
      this.status[dataType].syncing = false;
    }
  }

  async loadAllFromServer(): Promise<void> {
    const dataTypes: DataType[] = ['vehicles', 'deliveries', 'maintenance', 'clients', 'sop', 'vending-machines'];
    
    for (const dataType of dataTypes) {
      try {
        await this.loadFromServer(dataType);
      } catch (error) {
        console.error(`Failed to load ${dataType}:`, error);
      }
    }
    
    notify.success('Data loaded from cloud');
  }

  async saveToServer(dataType: DataType, data: any[]): Promise<boolean> {
    try {
      this.status[dataType].syncing = true;
      
      const response = await fetch(`${API_BASE}/sync-data?dataType=${dataType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save ${dataType}: ${response.statusText}`);
      }
      
      this.status[dataType].lastSync = new Date();
      this.status[dataType].error = null;
      
      console.log(`Saved ${data.length} ${dataType} to server`);
      return true;
    } catch (error) {
      console.error(`Failed to save ${dataType} to server:`, error);
      this.status[dataType].error = error instanceof Error ? error.message : 'Unknown error';
      
      // Queue for retry
      this.queueForSync(dataType, data);
      return false;
    } finally {
      this.status[dataType].syncing = false;
    }
  }

  async sync(dataType: DataType): Promise<SyncResult> {
    try {
      // Get current data from localStorage
      const localData = localStorage.getItem(`fleetflow-${dataType}`);
      const data = localData ? JSON.parse(localData) : [];
      
      const success = await this.saveToServer(dataType, data);
      
      return {
        success,
        dataType,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        dataType,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  async syncAll(quiet = false): Promise<SyncResult[]> {
    if (this.syncInProgress) {
      return [];
    }
    
    this.syncInProgress = true;
    
    try {
      const dataTypes: DataType[] = ['vehicles', 'deliveries', 'maintenance', 'clients', 'sop', 'vending-machines'];
      const results: SyncResult[] = [];
      
      for (const dataType of dataTypes) {
        const result = await this.sync(dataType);
        results.push(result);
      }
      
      // Process any queued syncs
      await this.processSyncQueue();
      
      if (!quiet) {
        const failed = results.filter(r => !r.success);
        if (failed.length === 0) {
          notify.success('All data synced to cloud');
        } else {
          notify.warning(`${failed.length} data types failed to sync`);
        }
      }
      
      return results;
    } finally {
      this.syncInProgress = false;
    }
  }

  private queueForSync(dataType: DataType, data: any[]) {
    this.syncQueue.push({ dataType, data });
    
    if (!this.isProcessingQueue) {
      this.processSyncQueue();
    }
  }

  private async processSyncQueue() {
    if (this.isProcessingQueue || this.syncQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.syncQueue.length > 0) {
        const { dataType, data } = this.syncQueue[0];
        
        try {
          await this.saveToServer(dataType, data);
          this.syncQueue.shift(); // Remove successful sync
        } catch (error) {
          console.error(`Failed to sync queued ${dataType}:`, error);
          // Keep in queue for next retry
          break;
        }
        
        // Small delay between syncs
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  getStatus(dataType: DataType) {
    return this.status[dataType];
  }

  getAllStatus() {
    return this.status;
  }

  // Manual sync trigger (e.g., from UI)
  async manualSync(): Promise<void> {
    notify.info('Syncing data to cloud...');
    await this.syncAll();
  }

  // Check if any sync is in progress
  isSyncing(): boolean {
    return Object.values(this.status).some(s => s.syncing) || 
           this.syncInProgress || 
           this.isProcessingQueue;
  }
}

// Create singleton instance - only on client side
let dataSync: DataSync | null = null;

export function getDataSync(): DataSync {
  if (typeof window === 'undefined') {
    // Return a mock or throw error on server side
    throw new Error('DataSync is only available on the client side');
  }
  
  if (!dataSync) {
    dataSync = new DataSync();
    // Export for manual control
    (window as any).dataSync = dataSync;
  }
  
  return dataSync;
}