/**
 * Notification utilities for creating and managing notifications
 */

import { prisma } from './prisma';
// Notification types (stored as String in DB)
export type NotificationType = 
  | 'MAINTENANCE_DUE' 
  | 'VEHICLE_ALERT' 
  | 'TEAM_INVITE' 
  | 'BILLING' 
  | 'SYSTEM' 
  | 'SECURITY';

export const NotificationType = {
  MAINTENANCE_DUE: 'MAINTENANCE_DUE' as const,
  VEHICLE_ALERT: 'VEHICLE_ALERT' as const,
  TEAM_INVITE: 'TEAM_INVITE' as const,
  BILLING: 'BILLING' as const,
  SYSTEM: 'SYSTEM' as const,
  SECURITY: 'SECURITY' as const,
};

// Constants for notification types (for use as values)
export const NotificationTypes = {
  MAINTENANCE_DUE: 'MAINTENANCE_DUE' as NotificationType,
  VEHICLE_ALERT: 'VEHICLE_ALERT' as NotificationType,
  TEAM_INVITE: 'TEAM_INVITE' as NotificationType,
  BILLING: 'BILLING' as NotificationType,
  SYSTEM: 'SYSTEM' as NotificationType,
  SECURITY: 'SECURITY' as NotificationType,
};

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

/**
 * Create a new notification for a user
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  data,
}: CreateNotificationInput) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : '{}',
      },
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users
 */
export async function createBulkNotifications({
  userIds,
  type,
  title,
  message,
  data,
}: Omit<CreateNotificationInput, 'userId'> & { userIds: string[] }) {
  try {
    const notifications = await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : '{}',
      })),
    });
    return notifications;
  } catch (error) {
    console.error('Failed to create bulk notifications:', error);
    throw error;
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
    return count;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string, userId: string) {
  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
    return notification;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  try {
    await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId,
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to delete notification:', error);
    throw error;
  }
}

/**
 * Get notifications for a user with pagination
 */
export async function getNotifications(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    type?: NotificationType;
    unreadOnly?: boolean;
  } = {}
) {
  const { page = 1, limit = 20, type, unreadOnly } = options;
  const skip = (page - 1) * limit;

  try {
    const where: any = { userId };
    if (type) where.type = type;
    if (unreadOnly) where.read = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error('Failed to get notifications:', error);
    throw error;
  }
}

// Notification creation helpers for specific events

/**
 * Create a maintenance due notification
 */
export async function notifyMaintenanceDue(
  userId: string,
  vehicleName: string,
  maintenanceType: string,
  dueDate: Date
) {
  return createNotification({
    userId,
    type: NotificationTypes.MAINTENANCE_DUE,
    title: 'Maintenance Due',
    message: `${vehicleName} is due for ${maintenanceType} on ${dueDate.toLocaleDateString()}`,
    data: { vehicleName, maintenanceType, dueDate },
  });
}

/**
 * Create a vehicle alert notification
 */
export async function notifyVehicleAlert(
  userId: string,
  vehicleName: string,
  alertType: string,
  severity: 'low' | 'medium' | 'high'
) {
  return createNotification({
    userId,
    type: NotificationTypes.VEHICLE_ALERT,
    title: `Vehicle Alert: ${alertType}`,
    message: `${vehicleName} has triggered a ${severity} severity alert: ${alertType}`,
    data: { vehicleName, alertType, severity },
  });
}

/**
 * Create a team invite notification
 */
export async function notifyTeamInvite(
  userId: string,
  teamName: string,
  invitedBy: string
) {
  return createNotification({
    userId,
    type: NotificationTypes.TEAM_INVITE,
    title: 'Team Invitation',
    message: `${invitedBy} has invited you to join ${teamName}`,
    data: { teamName, invitedBy },
  });
}

/**
 * Create a billing notification
 */
export async function notifyBilling(
  userId: string,
  event: string,
  details: Record<string, any>
) {
  const titles: Record<string, string> = {
    payment_success: 'Payment Successful',
    payment_failed: 'Payment Failed',
    subscription_canceled: 'Subscription Canceled',
    subscription_renewed: 'Subscription Renewed',
    trial_ending: 'Trial Ending Soon',
  };

  return createNotification({
    userId,
    type: NotificationTypes.BILLING,
    title: titles[event] || 'Billing Update',
    message: details.message || 'There is an update regarding your billing.',
    data: { event, ...details },
  });
}

/**
 * Create a security alert notification
 */
export async function notifySecurityAlert(
  userId: string,
  event: string,
  details: Record<string, any>
) {
  const titles: Record<string, string> = {
    new_login: 'New Login Detected',
    password_changed: 'Password Changed',
    two_factor_enabled: 'Two-Factor Authentication Enabled',
    two_factor_disabled: 'Two-Factor Authentication Disabled',
    suspicious_activity: 'Suspicious Activity Detected',
  };

  return createNotification({
    userId,
    type: NotificationTypes.SECURITY,
    title: titles[event] || 'Security Alert',
    message: details.message || 'A security-related event has occurred on your account.',
    data: { event, ...details },
  });
}

/**
 * Create a system notification
 */
export async function notifySystem(
  userId: string,
  title: string,
  message: string,
  data?: Record<string, any>
) {
  return createNotification({
    userId,
    type: NotificationTypes.SYSTEM,
    title,
    message,
    data,
  });
}

/**
 * Get notification icon and color based on type
 */
export function getNotificationMeta(type: NotificationType) {
  const meta: Record<NotificationType, { icon: string; color: string; bgColor: string }> = {
    MAINTENANCE_DUE: {
      icon: 'Wrench',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    VEHICLE_ALERT: {
      icon: 'AlertTriangle',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    TEAM_INVITE: {
      icon: 'Users',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    BILLING: {
      icon: 'CreditCard',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    SYSTEM: {
      icon: 'Info',
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
    },
    SECURITY: {
      icon: 'Shield',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  };

  return meta[type] || meta.SYSTEM;
}
