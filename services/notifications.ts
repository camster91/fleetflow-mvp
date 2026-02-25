// Notification service using react-hot-toast
import React from 'react';
import toast from 'react-hot-toast';

type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface NotificationOptions {
  duration?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  icon?: string | React.ReactElement;
  style?: React.CSSProperties;
  className?: string;
}

// Default options
const defaultOptions: NotificationOptions = {
  duration: 4000,
  position: 'top-right',
};

// Notification service
export const notify = {
  // Success notifications
  success: (message: string, options?: NotificationOptions) => {
    return toast.success(message, { ...defaultOptions, ...options });
  },

  // Error notifications
  error: (message: string, options?: NotificationOptions) => {
    return toast.error(message, { ...defaultOptions, ...options });
  },

  // Info notifications
  info: (message: string, options?: NotificationOptions) => {
    return toast(message, { 
      ...defaultOptions, 
      ...options,
      icon: 'ℹ️',
    });
  },

  // Warning notifications
  warning: (message: string, options?: NotificationOptions) => {
    return toast(message, { 
      ...defaultOptions, 
      ...options,
      icon: '⚠️',
    });
  },

  // Loading notifications
  loading: (message: string, options?: NotificationOptions) => {
    return toast.loading(message, { ...defaultOptions, ...options });
  },

  // Promise notifications
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    },
    options?: NotificationOptions
  ) => {
    return toast.promise(promise, messages, { ...defaultOptions, ...options });
  },

  // Dismiss notification
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },

  // Remove all notifications
  removeAll: () => {
    toast.remove();
  },
};

// Specific notification helpers for FleetFlow
export const vehicleNotifications = {
  added: (name: string) => notify.success(`Vehicle "${name}" added successfully!`),
  updated: (name: string) => notify.success(`Vehicle "${name}" updated!`),
  deleted: (name: string) => notify.success(`Vehicle "${name}" deleted successfully.`),
  error: (action: string, error?: string) => 
    notify.error(`Failed to ${action} vehicle. ${error ? `Error: ${error}` : 'Please try again.'}`),
};

export const deliveryNotifications = {
  added: (customer: string) => notify.success(`Delivery for "${customer}" added successfully!`),
  updated: (customer: string) => notify.success(`Delivery updated!`),
  deleted: (customer: string) => notify.success(`Delivery deleted.`),
  assigned: (driver: string) => notify.success(`Assigned ${driver} to this delivery.`),
  delivered: (customer: string) => notify.success(`Delivery to ${customer} marked as delivered!`),
  error: (action: string, error?: string) => 
    notify.error(`Failed to ${action} delivery. ${error ? `Error: ${error}` : 'Please try again.'}`),
};

export const sopNotifications = {
  categoryAdded: (name: string) => notify.success(`SOP category "${name}" added!`),
  categoryUpdated: (name: string) => notify.success(`SOP category updated!`),
  categoryDeleted: (name: string) => notify.success(`SOP category deleted.`),
  sopAdded: (title: string) => notify.success(`SOP "${title}" added!`),
  error: (action: string, error?: string) => 
    notify.error(`Failed to ${action} SOP. ${error ? `Error: ${error}` : 'Please try again.'}`),
};

export const maintenanceNotifications = {
  taskAdded: (vehicle: string) => notify.success(`Maintenance task for ${vehicle} added!`),
  taskUpdated: () => notify.success(`Maintenance task updated!`),
  taskDeleted: () => notify.success(`Maintenance task deleted.`),
  taskCompleted: () => notify.success(`Maintenance task marked as completed.`),
  taskScheduled: (date: string) => notify.success(`Maintenance task scheduled for ${date}`),
  error: (action: string, error?: string) => 
    notify.error(`Failed to ${action} maintenance task. ${error ? `Error: ${error}` : 'Please try again.'}`),
};

export const announcementNotifications = {
  sent: (recipients: string) => notify.success(`Announcement sent to ${recipients}!`),
  error: (error?: string) => notify.error(`Failed to send announcement. ${error ? `Error: ${error}` : 'Please try again.'}`),
};

export const clientNotifications = {
  added: (name: string) => notify.success(`Client "${name}" added successfully!`),
  updated: (name: string) => notify.success(`Client "${name}" updated!`),
  deleted: (name: string) => notify.success(`Client "${name}" deleted successfully.`),
  locationPhotoAdded: (location: string) => notify.success(`Location photo added for ${location}!`),
  locationPinAdded: (location: string) => notify.success(`Location pin added for ${location}!`),
  error: (action: string, error?: string) => 
    notify.error(`Failed to ${action} client. ${error ? `Error: ${error}` : 'Please try again.'}`),
};

export const vendingMachineNotifications = {
  added: (name: string) => notify.success(`Vending machine "${name}" added!`),
  updated: (name: string) => notify.success(`Vending machine "${name}" updated!`),
  deleted: (name: string) => notify.success(`Vending machine "${name}" removed.`),
  noteAdded: (machine: string) => notify.success(`Note added to "${machine}".`),
  noteResolved: () => notify.success('Note marked as resolved.'),
  noteDeleted: () => notify.success('Note deleted.'),
  error: (action: string, error?: string) =>
    notify.error(`Failed to ${action} vending machine. ${error ? `Error: ${error}` : 'Please try again.'}`),
};

export const reportNotifications = {
  generating: (type: string) => notify.loading(`Generating ${type} report...`),
  generated: (type: string) => notify.success(`${type} report generated successfully!`),
  exported: () => notify.success(`Data exported successfully!`),
  scheduled: (email: string) => notify.success(`Scheduled reports configured for ${email}`),
  error: (action: string, error?: string) => 
    notify.error(`Failed to ${action} report. ${error ? `Error: ${error}` : 'Please try again.'}`),
};

// Confirmation dialog helper (simulated for now - would use a modal in production)
export const confirmAction = async (
  message: string,
  title: string = 'Confirm Action'
): Promise<boolean> => {
  // In a real implementation, this would show a custom modal
  // For now, we'll use browser confirm but wrap it in a promise
  return new Promise((resolve) => {
    const confirmed = window.confirm(`${title}\n\n${message}\n\nAre you sure you want to continue?`);
    resolve(confirmed);
  });
};

// Prompt dialog helper
export const promptAction = async (
  message: string,
  defaultValue: string = '',
  title: string = 'Input Required'
): Promise<string | null> => {
  // In a real implementation, this would show a custom modal with form
  // For now, we'll use browser prompt but wrap it in a promise
  return new Promise((resolve) => {
    const result = window.prompt(`${title}\n\n${message}`, defaultValue);
    resolve(result);
  });
};