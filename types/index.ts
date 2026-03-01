// Type definitions for FleetFlow
// These types mirror what would be in Prisma schema but are defined here for SQLite compatibility

// Plan types for subscription management
export type PlanType = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export const PlanType = {
  STARTER: 'STARTER' as const,
  PROFESSIONAL: 'PROFESSIONAL' as const,
  ENTERPRISE: 'ENTERPRISE' as const,
};

// User roles
export type UserRole = 'admin' | 'fleet_manager' | 'dispatch' | 'driver' | 'maintenance' | 'safety_officer' | 'finance';

export const UserRole = {
  ADMIN: 'admin' as const,
  FLEET_MANAGER: 'fleet_manager' as const,
  DISPATCH: 'dispatch' as const,
  DRIVER: 'driver' as const,
  MAINTENANCE: 'maintenance' as const,
  SAFETY_OFFICER: 'safety_officer' as const,
  FINANCE: 'finance' as const,
};

// Team roles
export type TeamRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export const TeamRole = {
  OWNER: 'OWNER' as const,
  ADMIN: 'ADMIN' as const,
  MANAGER: 'MANAGER' as const,
  MEMBER: 'MEMBER' as const,
  VIEWER: 'VIEWER' as const,
};

// Invitation status
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export const InvitationStatus = {
  PENDING: 'PENDING' as const,
  ACCEPTED: 'ACCEPTED' as const,
  DECLINED: 'DECLINED' as const,
  EXPIRED: 'EXPIRED' as const,
};

// Notification types
export type NotificationType = 
  | 'delivery_assigned'
  | 'delivery_completed'
  | 'maintenance_due'
  | 'maintenance_completed'
  | 'vehicle_alert'
  | 'announcement'
  | 'system'
  | 'invite';

export const NotificationType = {
  DELIVERY_ASSIGNED: 'delivery_assigned' as const,
  DELIVERY_COMPLETED: 'delivery_completed' as const,
  MAINTENANCE_DUE: 'maintenance_due' as const,
  MAINTENANCE_COMPLETED: 'maintenance_completed' as const,
  VEHICLE_ALERT: 'vehicle_alert' as const,
  ANNOUNCEMENT: 'announcement' as const,
  SYSTEM: 'system' as const,
  INVITE: 'invite' as const,
};

// Subscription status
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'UNPAID';

export const SubscriptionStatus = {
  TRIAL: 'TRIAL' as const,
  ACTIVE: 'ACTIVE' as const,
  CANCELLED: 'CANCELLED' as const,
  PAST_DUE: 'PAST_DUE' as const,
  UNPAID: 'UNPAID' as const,
};

// Vehicle status
export type VehicleStatus = 'active' | 'inactive' | 'maintenance' | 'retired';

export const VehicleStatus = {
  ACTIVE: 'active' as const,
  INACTIVE: 'inactive' as const,
  MAINTENANCE: 'maintenance' as const,
  RETIRED: 'retired' as const,
};

// Delivery status
export type DeliveryStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export const DeliveryStatus = {
  PENDING: 'pending' as const,
  IN_PROGRESS: 'in_progress' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  CANCELLED: 'cancelled' as const,
};

// Maintenance priority
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

export const MaintenancePriority = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
  URGENT: 'urgent' as const,
};
