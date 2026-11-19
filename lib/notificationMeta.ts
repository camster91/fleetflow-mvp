export type NotificationType = 'MAINTENANCE_DUE' | 'VEHICLE_ALERT' | 'TEAM_INVITE' | 'BILLING' | 'SYSTEM' | 'SECURITY'

export const NotificationType = {
  MAINTENANCE_DUE: 'MAINTENANCE_DUE' as const,
  VEHICLE_ALERT: 'VEHICLE_ALERT' as const,
  TEAM_INVITE: 'TEAM_INVITE' as const,
  BILLING: 'BILLING' as const,
  SYSTEM: 'SYSTEM' as const,
  SECURITY: 'SECURITY' as const,
}

// Constants for notification types (for use as values)
export const NotificationTypes = {
  MAINTENANCE_DUE: 'MAINTENANCE_DUE' as NotificationType,
  VEHICLE_ALERT: 'VEHICLE_ALERT' as NotificationType,
  TEAM_INVITE: 'TEAM_INVITE' as NotificationType,
  BILLING: 'BILLING' as NotificationType,
  SYSTEM: 'SYSTEM' as NotificationType,
  SECURITY: 'SECURITY' as NotificationType,
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
  }

  return meta[type] || meta.SYSTEM
}
