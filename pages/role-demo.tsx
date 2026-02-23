import React from 'react';
import { RoleProvider } from '../context/RoleContext';
import RoleSwitcher from '../components/RoleSwitcher';
import AdminDashboard from '../components/role-dashboards/AdminDashboard';
import DriverDashboard from '../components/role-dashboards/DriverDashboard';
import DispatchDashboard from '../components/role-dashboards/DispatchDashboard';
import { useRole } from '../context/RoleContext';

// We'll create simplified versions of other dashboards for now
const FleetManagerDashboard: React.FC = () => {
  // This would be the current dashboard from index.tsx
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fleet Manager Dashboard</h1>
              <p className="text-gray-600 mt-1">Vehicle management, maintenance scheduling, cost analysis</p>
            </div>
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Manager View
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-blue-700">
              This is the current dashboard from the main interface. As a Fleet Manager, you have access to:
            </p>
            <ul className="mt-2 text-blue-700 list-disc list-inside space-y-1">
              <li>Vehicle status and tracking</li>
              <li>Delivery progress monitoring</li>
              <li>Maintenance scheduling</li>
              <li>SOP library management</li>
              <li>Basic reporting and analytics</li>
            </ul>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-600">
            Switch to other roles using the role switcher in the header to see different interfaces.
          </p>
        </div>
      </div>
    </div>
  );
};



const MaintenanceDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Maintenance Dashboard</h1>
              <p className="text-gray-600 mt-1">Repair orders, parts inventory, vehicle inspections</p>
            </div>
            <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              Maintenance View
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SafetyOfficerDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Safety Officer Dashboard</h1>
              <p className="text-gray-600 mt-1">Compliance monitoring, incident reporting, training management</p>
            </div>
            <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              Safety View
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FinanceDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Finance/HR Dashboard</h1>
              <p className="text-gray-600 mt-1">Payroll, expense tracking, compliance reporting</p>
            </div>
            <div className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
              Finance View
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main component that uses role context
const RoleDemoContent: React.FC = () => {
  const { currentUser } = useRole();

  const renderDashboard = () => {
    switch (currentUser.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'fleet_manager':
        return <FleetManagerDashboard />;
      case 'dispatch':
        return <DispatchDashboard />;
      case 'driver':
        return <DriverDashboard />;
      case 'maintenance':
        return <MaintenanceDashboard />;
      case 'safety_officer':
        return <SafetyOfficerDashboard />;
      case 'finance':
        return <FinanceDashboard />;
      default:
        return <FleetManagerDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with role switcher */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-600 rounded-lg">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">FleetFlow Pro</h1>
                <p className="text-sm text-gray-600">Role-Based Feature Demo</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 hidden md:block">
                Current role: <span className="font-medium">{currentUser.role.replace('_', ' ')}</span>
              </div>
              <RoleSwitcher />
              <button 
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
              >
                Back to Main
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Role-specific dashboard */}
      {renderDashboard()}

      {/* Demo information footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center">
            <h3 className="font-medium text-gray-900 mb-2">Role-Based Feature Demonstration</h3>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              This demo shows how FleetFlow Pro can provide tailored interfaces for different roles within a company. 
              Each role sees only the features and information relevant to their job function, improving efficiency and reducing complexity.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Administrator: Full system control</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Fleet Manager: Vehicle & maintenance</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Dispatch: Delivery assignments</span>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">Driver: Mobile task management</span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Maintenance: Repair tracking</span>
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Safety: Compliance monitoring</span>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">Finance: Cost & payroll</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Main page component with role provider
const RoleDemoPage: React.FC = () => {
  return (
    <RoleProvider initialRole="fleet_manager">
      <RoleDemoContent />
    </RoleProvider>
  );
};

export default RoleDemoPage;