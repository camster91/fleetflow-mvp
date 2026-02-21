import React, { useState } from 'react';
import { Users, ChevronDown, Check, Shield, Truck, Package, Wrench, AlertTriangle, BarChart, DollarSign } from 'lucide-react';
import { useRole, UserRole, roleDescriptions } from '../context/RoleContext';

const RoleSwitcher: React.FC = () => {
  const { currentUser, switchRole, isAuthorized } = useRole();
  const [isOpen, setIsOpen] = useState(false);

  const roleIcons: Record<UserRole, React.ReactNode> = {
    admin: <Shield className="h-4 w-4" />,
    fleet_manager: <Truck className="h-4 w-4" />,
    dispatch: <Package className="h-4 w-4" />,
    driver: <Users className="h-4 w-4" />,
    maintenance: <Wrench className="h-4 w-4" />,
    safety_officer: <AlertTriangle className="h-4 w-4" />,
    finance: <DollarSign className="h-4 w-4" />
  };

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    fleet_manager: 'bg-blue-100 text-blue-800 border-blue-200',
    dispatch: 'bg-green-100 text-green-800 border-green-200',
    driver: 'bg-orange-100 text-orange-800 border-orange-200',
    maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    safety_officer: 'bg-red-100 text-red-800 border-red-200',
    finance: 'bg-indigo-100 text-indigo-800 border-indigo-200'
  };

  const allRoles: UserRole[] = ['admin', 'fleet_manager', 'dispatch', 'driver', 'maintenance', 'safety_officer', 'finance'];

  const handleRoleSelect = (role: UserRole) => {
    switchRole(role);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${roleColors[currentUser.role]} hover:opacity-90 transition`}
      >
        <div className="flex items-center space-x-2">
          {roleIcons[currentUser.role]}
          <span className="font-medium text-sm">{roleDescriptions[currentUser.role].title}</span>
        </div>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-50 overflow-hidden">
            <div className="p-4 border-b">
              <p className="text-sm font-medium text-gray-900">Switch Role (Demo)</p>
              <p className="text-xs text-gray-600 mt-1">Preview different interfaces</p>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {allRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSelect(role)}
                  className={`w-full flex items-start justify-between p-3 text-left hover:bg-gray-50 transition ${currentUser.role === role ? 'bg-gray-50' : ''}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${roleColors[role].split(' ')[0]} ${roleColors[role].split(' ')[1]}`}>
                      {roleIcons[role]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{roleDescriptions[role].title}</p>
                      <p className="text-xs text-gray-600 mt-1">{roleDescriptions[role].description}</p>
                    </div>
                  </div>
                  {currentUser.role === role && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <p className="text-xs text-gray-600">
                <strong>Note:</strong> This is a demo mode showing how different roles would see different interfaces. In production, users would have fixed roles with proper authentication.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RoleSwitcher;