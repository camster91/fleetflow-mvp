import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { supabaseClient } from '../lib/supabase';

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

const defaultAuthContext: AuthContextType = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
  hasPermission: () => false,
  isAuthorized: () => false,
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return defaults during SSR/static generation instead of throwing
    return defaultAuthContext;
  }
  return context;
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

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email || '');
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadUserProfile(session.user.id, session.user.email || '');
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string, email: string) => {
    try {
      const { data: profile } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      setUser({
        id: userId,
        email: email,
        name: profile?.name || email.split('@')[0],
        role: (profile?.role as UserRole) || 'fleet_manager',
        company: profile?.company || undefined,
      });
    } catch {
      // Profile not found — use defaults from auth metadata
      setUser({
        id: userId,
        email: email,
        name: email.split('@')[0],
        role: 'fleet_manager',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await supabaseClient.auth.signOut();
    setUser(null);
    router.push('/auth/login');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
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
