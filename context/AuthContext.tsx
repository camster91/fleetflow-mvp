/**
 * AuthContext — lightweight provider for role utilities.
 * Authentication is handled by NextAuth (useSession from next-auth/react).
 * This context is retained for rolePermissions / roleDescriptions exports
 * and as a compatibility shim for any future consumers.
 */
import React, { createContext, useContext, ReactNode } from 'react';

export type UserRole =
  | 'admin'
  | 'fleet_manager'
  | 'dispatch'
  | 'driver'
  | 'maintenance'
  | 'safety_officer'
  | 'finance';

interface AuthContextType {
  hasPermission: (permission: string, role?: UserRole | null) => boolean;
  isAuthorized: (allowedRoles: UserRole[], role?: UserRole | null) => boolean;
}

// Role descriptions for UI
export const roleDescriptions: Record<UserRole, { title: string; description: string }> = {
  admin: { title: 'Administrator', description: 'Full system access, user management, company settings' },
  fleet_manager: { title: 'Fleet Manager', description: 'Vehicle management, maintenance scheduling, cost analysis' },
  dispatch: { title: 'Dispatch Operator', description: 'Delivery assignments, route optimization, driver communication' },
  driver: { title: 'Driver', description: 'View assignments, navigation, check-ins, document access' },
  maintenance: { title: 'Maintenance Technician', description: 'Repair orders, parts inventory, vehicle inspections' },
  safety_officer: { title: 'Safety Officer', description: 'Compliance monitoring, incident reporting, training management' },
  finance: { title: 'Finance/HR', description: 'Payroll, expense tracking, compliance reporting' },
};

// Role-based permissions
export const rolePermissions: Record<UserRole, string[]> = {
  admin: ['*'],
  fleet_manager: ['view_vehicles', 'manage_vehicles', 'view_maintenance', 'schedule_maintenance', 'view_deliveries', 'view_reports', 'send_announcements'],
  dispatch: ['view_vehicles', 'view_drivers', 'assign_deliveries', 'optimize_routes', 'communicate_drivers', 'track_deliveries', 'send_announcements'],
  driver: ['view_assignments', 'check_in_out', 'report_issues', 'view_sops', 'navigation', 'emergency_contact', 'view_vehicle_info'],
  maintenance: ['view_vehicles', 'create_work_orders', 'update_maintenance', 'manage_parts', 'vehicle_inspections', 'view_maintenance_history'],
  safety_officer: ['view_incidents', 'report_incidents', 'manage_training', 'view_compliance', 'audit_preparation', 'view_safety_docs'],
  finance: ['view_reports', 'view_expenses', 'driver_payroll', 'compliance_reporting', 'budget_tracking', 'document_storage'],
};

const AuthContext = createContext<AuthContextType>({
  hasPermission: () => false,
  isAuthorized: () => false,
});

export const useAuth = () => useContext(AuthContext);

const hasPermission = (permission: string, role?: UserRole | null): boolean => {
  if (!role) return false;
  if (role === 'admin') return true;
  return rolePermissions[role]?.includes(permission) ?? false;
};

const isAuthorized = (allowedRoles: UserRole[], role?: UserRole | null): boolean => {
  if (!role) return false;
  return allowedRoles.includes(role);
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={{ hasPermission, isAuthorized }}>
    {children}
  </AuthContext.Provider>
);
