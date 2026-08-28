/**
 * Permission utilities for team-based access control
 */

import { TeamRole } from '../types';

/**
 * Check if a role can manage vehicles (add, edit, delete, assign)
 */
export function canManageVehicles(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
}

/**
 * Check if a role can view vehicles
 */
export function canViewVehicles(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER', 'MEMBER', 'VIEWER'].includes(role);
}

const OPERATIONAL_MANAGERS: TeamRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const BUSINESS_READERS: TeamRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];

export function canViewBusinessData(role: TeamRole): boolean {
  return BUSINESS_READERS.includes(role);
}

export function canManageClients(role: TeamRole): boolean {
  return OPERATIONAL_MANAGERS.includes(role);
}

export function canManageSOP(role: TeamRole): boolean {
  return OPERATIONAL_MANAGERS.includes(role);
}

export function canManageVendingMachines(role: TeamRole): boolean {
  return OPERATIONAL_MANAGERS.includes(role);
}

export function canManageAnnouncements(role: TeamRole): boolean {
  return OPERATIONAL_MANAGERS.includes(role);
}

/**
 * Check if a role can manage team members (invite, change roles, remove)
 */
export function canManageTeam(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN'].includes(role);
}

/**
 * Check if a role can view team members
 */
export function canViewTeam(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'].includes(role);
}

/**
 * Check if a role can view reports and analytics
 */
export function canViewReports(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(role);
}

/**
 * Check if a role can manage billing and subscriptions
 */
export function canManageBilling(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN'].includes(role);
}

/**
 * Check if a role can view billing information
 */
export function canViewBilling(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
}

/**
 * Check if a role can manage settings
 */
export function canManageSettings(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN'].includes(role);
}

/**
 * Check if a role can manage maintenance schedules
 */
export function canManageMaintenance(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN'].includes(role);
}

/**
 * Check if a role can view maintenance schedules
 */
export function canViewMaintenance(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER'].includes(role);
}

/**
 * Check if a role can manage deliveries
 */
export function canManageDeliveries(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER'].includes(role);
}

/**
 * Check if a role can view deliveries
 */
export function canViewDeliveries(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER', 'MEMBER', 'VIEWER'].includes(role);
}

/**
 * Check if a role can manage drivers
 */
export function canManageDrivers(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
}
export function canViewClients(role: TeamRole): boolean { return [...BUSINESS_READERS, 'DISPATCHER'].includes(role) }
export function canViewSOP(role: TeamRole): boolean { return [...BUSINESS_READERS, 'TECHNICIAN', 'DRIVER'].includes(role) }

/** Assignment is narrower than general operational write access. */
export function canAssignDrivers(role: TeamRole | 'DISPATCH' | 'MAINTENANCE'): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'DISPATCH'].includes(role);
}

/**
 * Check if a role can view drivers
 */
export function canViewDrivers(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'MEMBER', 'VIEWER'].includes(role);
}

/**
 * Check if a role can export data
 */
export function canExportData(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
}

/**
 * Check if a role can access API
 */
export function canAccessApi(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
}

/**
 * Check if a role can manage integrations
 */
export function canManageIntegrations(role: TeamRole): boolean {
  return ['OWNER', 'ADMIN'].includes(role);
}

/**
 * Check if a role can delete the team/organization
 */
export function canDeleteTeam(role: TeamRole): boolean {
  return role === 'OWNER';
}

/**
 * Get the display name for a role
 */
export function getRoleDisplayName(role: TeamRole): string {
  const names: Record<TeamRole, string> = {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    DISPATCHER: 'Dispatcher',
    TECHNICIAN: 'Technician',
    DRIVER: 'Driver',
    MEMBER: 'Member',
    VIEWER: 'Viewer',
  };
  return names[role] || role;
}

/**
 * Get the description for a role
 */
export function getRoleDescription(role: TeamRole): string {
  const descriptions: Record<TeamRole, string> = {
    OWNER: 'Full access to everything including team deletion',
    ADMIN: 'Can manage everything except team deletion',
    MANAGER: 'Can manage vehicles, drivers, and maintenance',
    DISPATCHER: 'Can coordinate and update deliveries',
    TECHNICIAN: 'Can review and update maintenance work',
    DRIVER: 'Can view assigned operational work',
    MEMBER: 'Can view and update assigned items',
    VIEWER: 'View-only access to all data',
  };
  return descriptions[role] || '';
}

/**
 * Get the color for a role badge
 */
export function getRoleColor(role: TeamRole): string {
  const colors: Record<TeamRole, string> = {
    OWNER: 'bg-purple-100 text-purple-800 border-purple-200',
    ADMIN: 'bg-red-100 text-red-800 border-red-200',
    MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
    DISPATCHER: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    TECHNICIAN: 'bg-amber-100 text-amber-800 border-amber-200',
    DRIVER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    MEMBER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    VIEWER: 'bg-slate-100 text-slate-800 border-slate-200',
  };
  return colors[role] || 'bg-slate-100 text-slate-800';
}

/**
 * Get all available roles with their metadata
 */
export function getAllRoles(): Array<{
  value: TeamRole;
  label: string;
  description: string;
  color: string;
}> {
  return [
    { value: 'OWNER', label: 'Owner', description: getRoleDescription('OWNER'), color: getRoleColor('OWNER') },
    { value: 'ADMIN', label: 'Admin', description: getRoleDescription('ADMIN'), color: getRoleColor('ADMIN') },
    { value: 'MANAGER', label: 'Manager', description: getRoleDescription('MANAGER'), color: getRoleColor('MANAGER') },
    { value: 'DISPATCHER', label: 'Dispatcher', description: getRoleDescription('DISPATCHER'), color: getRoleColor('DISPATCHER') },
    { value: 'TECHNICIAN', label: 'Technician', description: getRoleDescription('TECHNICIAN'), color: getRoleColor('TECHNICIAN') },
    { value: 'DRIVER', label: 'Driver', description: getRoleDescription('DRIVER'), color: getRoleColor('DRIVER') },
    { value: 'MEMBER', label: 'Member', description: getRoleDescription('MEMBER'), color: getRoleColor('MEMBER') },
    { value: 'VIEWER', label: 'Viewer', description: getRoleDescription('VIEWER'), color: getRoleColor('VIEWER') },
  ];
}

/**
 * Check if a role can be assigned by another role
 */
export function canAssignRole(assignerRole: TeamRole, targetRole: TeamRole): boolean {
  // Ownership is represented by Team.ownerId and requires a dedicated transfer.
  // Ordinary role changes may assign every non-owner role.
  if (assignerRole === 'OWNER') return targetRole !== 'OWNER';
  
  // Admin can assign Manager, Member, and Viewer roles
  if (assignerRole === 'ADMIN') {
    return ['MANAGER', 'DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER'].includes(targetRole);
  }
  
  // Others cannot assign roles
  return false;
}

/**
 * Get assignable roles for a given role
 */
export function getAssignableRoles(assignerRole: TeamRole): TeamRole[] {
  if (assignerRole === 'OWNER') {
    return ['ADMIN', 'MANAGER', 'DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER'];
  }
  if (assignerRole === 'ADMIN') {
    return ['MANAGER', 'DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER'];
  }
  return [];
}
