import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 
  | 'admin' 
  | 'fleet_manager' 
  | 'dispatch' 
  | 'driver' 
  | 'maintenance' 
  | 'safety_officer' 
  | 'finance';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company?: string;
}

interface RoleContextType {
  currentUser: User;
  switchRole: (role: UserRole) => void;
  isAuthorized: (allowedRoles: UserRole[]) => boolean;
}

// Default user (for demo purposes)
const defaultUser: User = {
  id: 'demo-user-1',
  name: 'Demo User',
  email: 'demo@fleetflow.com',
  role: 'fleet_manager',
  company: 'Joseph\'s Food Truck Delivery'
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

interface RoleProviderProps {
  children: ReactNode;
  initialRole?: UserRole;
}

export const RoleProvider: React.FC<RoleProviderProps> = ({ 
  children, 
  initialRole = 'fleet_manager' 
}) => {
  const [currentUser, setCurrentUser] = useState<User>({
    ...defaultUser,
    role: initialRole
  });

  const switchRole = (role: UserRole) => {
    setCurrentUser(prev => ({
      ...prev,
      role
    }));
  };

  const isAuthorized = (allowedRoles: UserRole[]) => {
    return allowedRoles.includes(currentUser.role);
  };

  return (
    <RoleContext.Provider value={{ currentUser, switchRole, isAuthorized }}>
      {children}
    </RoleContext.Provider>
  );
};

// Role descriptions for UI
export const roleDescriptions: Record<UserRole, { title: string; description: string }> = {
  admin: {
    title: 'Administrator',
    description: 'Full system access, user management, company settings'
  },
  fleet_manager: {
    title: 'Fleet Manager',
    description: 'Vehicle management, maintenance scheduling, cost analysis'
  },
  dispatch: {
    title: 'Dispatch Operator',
    description: 'Delivery assignments, route optimization, driver communication'
  },
  driver: {
    title: 'Driver',
    description: 'View assignments, navigation, check-ins, document access'
  },
  maintenance: {
    title: 'Maintenance Technician',
    description: 'Repair orders, parts inventory, vehicle inspections'
  },
  safety_officer: {
    title: 'Safety Officer',
    description: 'Compliance monitoring, incident reporting, training management'
  },
  finance: {
    title: 'Finance/HR',
    description: 'Payroll, expense tracking, compliance reporting'
  }
};

// Role-based permissions
export const rolePermissions: Record<UserRole, string[]> = {
  admin: ['*'],
  fleet_manager: [
    'view_vehicles', 'manage_vehicles', 'view_maintenance', 'schedule_maintenance',
    'view_deliveries', 'view_reports', 'send_announcements'
  ],
  dispatch: [
    'view_vehicles', 'view_drivers', 'assign_deliveries', 'optimize_routes',
    'communicate_drivers', 'track_deliveries', 'send_announcements'
  ],
  driver: [
    'view_assignments', 'check_in_out', 'report_issues', 'view_sops',
    'navigation', 'emergency_contact', 'view_vehicle_info'
  ],
  maintenance: [
    'view_vehicles', 'create_work_orders', 'update_maintenance', 'manage_parts',
    'vehicle_inspections', 'view_maintenance_history'
  ],
  safety_officer: [
    'view_incidents', 'report_incidents', 'manage_training', 'view_compliance',
    'audit_preparation', 'view_safety_docs'
  ],
  finance: [
    'view_reports', 'view_expenses', 'driver_payroll', 'compliance_reporting',
    'budget_tracking', 'document_storage'
  ]
};