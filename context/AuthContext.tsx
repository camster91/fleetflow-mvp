import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';

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
  image?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isAuthorized: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Role descriptions for UI (copied from RoleContext for compatibility)
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

// Role-based permissions (copied from RoleContext for compatibility)
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

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') {
      setIsLoading(true);
      return;
    }

    if (status === 'unauthenticated' || !session?.user) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Map NextAuth session to our User type
    const mappedUser: User = {
      id: session.user.id || '',
      name: session.user.name || '',
      email: session.user.email || '',
      role: (session.user.role as UserRole) || 'fleet_manager',
      company: session.user.company || undefined,
      image: session.user.image || undefined,
    };

    setUser(mappedUser);
    setIsLoading(false);
  }, [session, status]);

  const logout = async () => {
    await signOut({ redirect: false });
    setUser(null);
    router.push('/auth/login');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    const permissions = rolePermissions[user.role];
    return permissions.includes(permission) || permissions.includes('*');
  };

  const isAuthorized = (allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
    hasPermission,
    isAuthorized,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};