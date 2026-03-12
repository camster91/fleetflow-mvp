import React, { useState } from 'react';
import { 
  Users, Shield, BarChart, Settings, DollarSign, 
  FileText, Bell, TrendingUp, TrendingDown, 
  CheckCircle, AlertTriangle, Clock, Download,
  Edit, Trash2, Plus, Search, Filter
} from 'lucide-react';
import { notify, confirmAction, promptAction } from '../../services/notifications';

interface User { id: string; name: string; email: string; role: string; status: 'active' | 'inactive' | 'pending'; lastLogin: string; }
interface SystemMetric { label: string; value: string; change: number; trend: 'up' | 'down'; icon: React.ReactNode; }

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  const users: User[] = [
    { id: '1', name: 'John Smith', email: 'john@fleetflow.com', role: 'Fleet Manager', status: 'active', lastLogin: '2 hours ago' },
    { id: '2', name: 'Sarah Johnson', email: 'sarah@fleetflow.com', role: 'Dispatch', status: 'active', lastLogin: '30 minutes ago' },
    { id: '3', name: 'Mike Chen', email: 'mike@fleetflow.com', role: 'Driver', status: 'active', lastLogin: '5 minutes ago' },
    { id: '4', name: 'Alex Rodriguez', email: 'alex@fleetflow.com', role: 'Maintenance', status: 'inactive', lastLogin: '3 days ago' },
    { id: '5', name: 'Taylor Wilson', email: 'taylor@fleetflow.com', role: 'Safety Officer', status: 'pending', lastLogin: 'Never' },
  ];

  const systemMetrics: SystemMetric[] = [
    { label: 'Active Users', value: '42', change: 12, trend: 'up', icon: <Users className="h-5 w-5" /> },
    { label: 'System Uptime', value: '99.9%', change: 0.1, trend: 'up', icon: <CheckCircle className="h-5 w-5" /> },
    { label: 'Monthly Revenue', value: '$24,580', change: 8.5, trend: 'up', icon: <DollarSign className="h-5 w-5" /> },
    { label: 'Pending Tasks', value: '7', change: -3, trend: 'down', icon: <Clock className="h-5 w-5" /> },
  ];

  const recentActivities = [
    { id: 1, action: 'User role changed', user: 'John Smith', time: '10:30 AM', details: 'Changed from Driver to Fleet Manager' },
    { id: 2, action: 'System backup completed', user: 'System', time: '09:15 AM', details: 'Daily backup successful' },
    { id: 3, action: 'New user added', user: 'Admin', time: 'Yesterday', details: 'Added Taylor Wilson as Safety Officer' },
    { id: 4, action: 'Billing updated', user: 'System', time: 'Yesterday', details: 'Monthly subscription processed' },
    { id: 5, action: 'Security audit', user: 'Admin', time: '2 days ago', details: 'Completed quarterly security review' },
  ];

  const handleAddUser = async () => {
    const name = await promptAction('Enter user name:');
    const email = await promptAction('Enter user email:');
    const role = await promptAction('Enter role (admin, fleet_manager, dispatch, driver, maintenance, safety_officer, finance):');
    if (name && email && role) notify.info(`User ${name} added successfully!\n\nEmail: ${email}\nRole: ${role}\n\nIn production, this would create a user account and send invitation email.`, { duration: 5000 });
  };

  const handleEditUser = async (user: User) => {
    const newRole = await promptAction(`Edit role for ${user.name}:`, user.role);
    if (newRole) notify.info(`Updated ${user.name}'s role to ${newRole}`, { duration: 3000 });
  };

  const handleDeleteUser = async (user: User) => {
    const confirmed = await confirmAction(`Are you sure you want to delete ${user.name}? This action cannot be undone.`, 'Delete User');
    if (confirmed) notify.info(`User ${user.name} deleted successfully.`, { duration: 3000 });
  };

  const handleSystemSettings = () => {
    notify.info('System Settings Panel\n\nThis would include:\n• Company information\n• Billing settings\n• API configuration\n• Integration settings\n• Security settings\n• Notification preferences', { duration: 5000 });
  };

  const handleExportData = (type: string) => {
    notify.info(`Exporting ${type} data...\n\nPreparing CSV file with all ${type} records.\n\nIn production, this would generate and download a CSV/Excel file.`, { duration: 5000 });
  };

  const handleRunBackup = () => {
    notify.info('Starting system backup...\n\nBackup process initiated. This may take several minutes.\n\n• Database backup ✓\n• File storage backup ✓\n• Configuration backup ✓\n\nBackup completed successfully!', { duration: 5000 });
  };

  const filteredUsers = searchQuery
    ? users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    : users;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Administrator Dashboard</h1>
            <p className="text-gray-600 mt-1">Full system control and monitoring</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">Super Admin</div>
            <button
              onClick={handleSystemSettings}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" /><span>Settings</span>
            </button>
          </div>
        </div>

        {/* Tabs — horizontal scroll */}
        <div className="flex space-x-1 mt-6 overflow-x-auto pb-1 -mx-2 px-2">
          {['overview', 'users', 'billing', 'reports', 'audit', 'system'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                activeTab === tab
                  ? 'bg-purple-50 text-purple-600 border border-purple-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              style={{ touchAction: 'manipulation' }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* System Metrics */}
      <div className="mb-6">
        {/* Mobile: horizontal scroll row */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x md:hidden">
          {systemMetrics.map((metric) => (
            <div key={metric.label} className="bg-white rounded-xl shadow-sm p-4 snap-start shrink-0 w-44">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-1.5 rounded-lg ${metric.trend === 'up' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {metric.icon}
                </div>
                <span className={`text-xs font-medium ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                  {metric.change > 0 ? '+' : ''}{metric.change}%
                </span>
              </div>
              <p className="text-xl font-bold text-gray-900">{metric.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{metric.label}</p>
            </div>
          ))}
        </div>
        {/* Desktop: grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemMetrics.map((metric) => (
            <div key={metric.label} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${metric.trend === 'up' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {metric.icon}
                </div>
                <div className="flex items-center space-x-1">
                  {metric.trend === 'up' ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                  <span className={`text-sm font-medium ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </span>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              <p className="text-sm text-gray-600 mt-1">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* User Management */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                  <p className="text-sm text-gray-600 mt-1 hidden sm:block">Manage user accounts and permissions</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="search"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-base"
                    />
                  </div>
                  <button
                    onClick={handleAddUser}
                    className="hidden md:flex px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" /><span>Add User</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile user cards */}
            <div className="md:hidden divide-y">
              {filteredUsers.map((user) => (
                <div key={user.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <span className="text-purple-700 font-medium">{user.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 truncate">{user.name}</p>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' :
                          user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {user.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{user.role} • {user.lastLogin}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center"
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="text-purple-700 text-sm font-medium">{user.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{user.role}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' :
                          user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4"><span className="text-sm text-gray-600">{user.lastLogin}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => handleEditUser(user)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteUser(user)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* System Health */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Database</span><span className="text-sm font-medium text-green-600">Healthy</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-600">API Server</span><span className="text-sm font-medium text-green-600">Operational</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-600">File Storage</span><span className="text-sm font-medium text-green-600">Online</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Email Service</span><span className="text-sm font-medium text-yellow-600">Degraded</span></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={handleRunBackup} className="py-2 min-h-[40px] bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">Run Backup</button>
              <button onClick={() => handleExportData('system')} className="py-2 min-h-[40px] bg-purple-600 text-white hover:bg-purple-700 rounded-lg font-medium text-sm">System Logs</button>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activities</h2>
              <Bell className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="pb-4 border-b last:border-0 last:pb-0">
                  <div className="flex justify-between">
                    <p className="font-medium text-gray-900 text-sm">{activity.action}</p>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">{activity.time}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{activity.details}</p>
                  <p className="text-xs text-gray-500 mt-2">By: {activity.user}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-3 min-h-[64px] border rounded-lg hover:border-purple-300 hover:bg-purple-50 transition flex flex-col items-center justify-center">
                <FileText className="h-5 w-5 text-purple-600 mb-2" />
                <span className="text-sm font-medium">Audit Logs</span>
              </button>
              <button className="p-3 min-h-[64px] border rounded-lg hover:border-purple-300 hover:bg-purple-50 transition flex flex-col items-center justify-center">
                <BarChart className="h-5 w-5 text-purple-600 mb-2" />
                <span className="text-sm font-medium">Analytics</span>
              </button>
              <button className="p-3 min-h-[64px] border rounded-lg hover:border-purple-300 hover:bg-purple-50 transition flex flex-col items-center justify-center">
                <Shield className="h-5 w-5 text-purple-600 mb-2" />
                <span className="text-sm font-medium">Security</span>
              </button>
              <button className="p-3 min-h-[64px] border rounded-lg hover:border-purple-300 hover:bg-purple-50 transition flex flex-col items-center justify-center">
                <DollarSign className="h-5 w-5 text-purple-600 mb-2" />
                <span className="text-sm font-medium">Billing</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 p-4 bg-white rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-3 md:space-y-0">
          <div className="text-sm text-gray-600">
            <p>FleetFlow Pro Admin Dashboard • System Version 2.1.4</p>
            <p className="mt-1">Last updated: Today at 11:30 AM • Next maintenance: Sunday, 2:00 AM</p>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-sm text-gray-600 hover:text-gray-900">Documentation</button>
            <button className="text-sm text-gray-600 hover:text-gray-900">Support</button>
            <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">View API</button>
          </div>
        </div>
      </div>

      {/* FAB — mobile only, Add User */}
      <button
        onClick={handleAddUser}
        className="fixed bottom-20 right-4 z-30 lg:hidden flex items-center justify-center w-14 h-14 bg-purple-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"
        aria-label="Add user"
        style={{ touchAction: 'manipulation' }}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
};

export default AdminDashboard;
