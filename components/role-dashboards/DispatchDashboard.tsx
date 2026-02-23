import React, { useState } from 'react';
import { 
  Users, MapPin, Package, Calendar, Clock, Navigation, 
  Phone, Mail, MessageSquare, Filter, Search, Plus,
  Building, Truck, Route, FileText, CheckCircle, AlertCircle,
  Star, Camera, Map as MapIcon, BarChart, Download
} from 'lucide-react';
import { notify, confirmAction, promptAction, clientNotifications, deliveryNotifications } from '../../services/notifications';
import * as dataService from '../../services/dataService';

const DispatchDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  
  // Mock data - in production would come from dataService
  const clients = dataService.getClients();
  const deliveries = dataService.getDeliveries();
  const vehicles = dataService.getVehicles();

  const handleAssignDelivery = async (client: dataService.Client) => {
    const driver = await promptAction(`Assign delivery to ${client.name}. Enter driver name:`, 'John D.');
    if (driver) {
      deliveryNotifications.assigned(driver);
      notify.info(
        `Delivery assigned to ${driver} for ${client.name}\n\n` +
        `Address: ${client.address}\n` +
        `Preferred Times: ${client.preferredDeliveryTimes?.join(', ') || 'Any'}\n\n` +
        'In production, this would create a delivery assignment and notify the driver.',
        { duration: 5000 }
      );
    }
  };

  const handlePlanRoute = async (clientIds: number[]) => {
    const selected = clients.filter(c => clientIds.includes(c.id));
    if (selected.length === 0) {
      notify.info('Please select clients to plan a route.', { duration: 3000 });
      return;
    }
    
    const addresses = selected.map(c => c.address).join('\n• ');
    notify.info(
      `Route Planning for ${selected.length} Clients\n\n` +
      `Addresses:\n• ${addresses}\n\n` +
      'In production, this would:\n' +
      '• Optimize route using Google Maps API\n' +
      '• Calculate estimated travel time\n' +
      '• Assign to available vehicle\n' +
      '• Generate turn-by-turn directions',
      { duration: 6000 }
    );
  };

  const handleSendBulkMessage = async (clientIds: number[]) => {
    const selected = clients.filter(c => clientIds.includes(c.id));
    if (selected.length === 0) return;
    
    const message = await promptAction(`Send message to ${selected.length} clients:`, 'Delivery update: Your order is on the way!');
    if (message) {
      notify.info(
        `Message sent to ${selected.length} clients:\n\n"${message}"\n\n` +
        'In production, this would send SMS/email notifications to all selected clients.',
        { duration: 5000 }
      );
    }
  };

  const handleToggleClientSelection = (clientId: number) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleCreateDeliveryTemplate = async () => {
    const name = await promptAction('Enter template name:', 'Standard Restaurant Delivery');
    if (name) {
      notify.info(
        `Delivery template "${name}" created\n\n` +
        'In production, this would save a reusable delivery template with:\n' +
        '• Standard instructions\n' +
        '• Contact protocols\n' +
        '• Special requirements\n' +
        '• Preferred time windows',
        { duration: 5000 }
      );
    }
  };

  const filteredClients = searchQuery 
    ? dataService.searchClients(searchQuery)
    : clients;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dispatch Operations</h1>
            <p className="text-gray-600">Manage client deliveries, route planning, and communications</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => notify.info('Opening dispatch analytics...')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center space-x-2"
            >
              <BarChart className="h-4 w-4" />
              <span>Analytics</span>
            </button>
            <button
              onClick={() => notify.info('Exporting dispatch data...')}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex space-x-1">
          {['clients', 'deliveries', 'routing', 'templates'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                activeTab === tab
                  ? 'bg-primary-50 text-primary-600 border border-primary-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Actions */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search clients, addresses, contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePlanRoute(selectedClients)}
            disabled={selectedClients.length === 0}
            className={`px-4 py-2 rounded-lg transition flex items-center space-x-2 ${
              selectedClients.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Route className="h-4 w-4" />
            <span>Plan Route ({selectedClients.length})</span>
          </button>
          <button
            onClick={() => handleSendBulkMessage(selectedClients)}
            disabled={selectedClients.length === 0}
            className={`px-4 py-2 rounded-lg transition flex items-center space-x-2 ${
              selectedClients.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Message ({selectedClients.length})</span>
          </button>
        </div>
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={handleCreateDeliveryTemplate}
            className="px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Client Database</h2>
                <p className="text-gray-600">Manage client information and delivery preferences</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedClients.length} selected
                </span>
                <button
                  onClick={() => setSelectedClients([])}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                      onChange={() => {
                        if (selectedClients.length === filteredClients.length) {
                          setSelectedClients([]);
                        } else {
                          setSelectedClients(filteredClients.map(c => c.id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Client</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Type</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Contact</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Last Delivery</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-6">
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(client.id)}
                        onChange={() => handleToggleClientSelection(client.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="py-3 px-6">
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-sm text-gray-600">{client.address}</p>
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        client.type === 'restaurant' ? 'bg-blue-100 text-blue-800' :
                        client.type === 'hotel' ? 'bg-purple-100 text-purple-800' :
                        client.type === 'office' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {client.type}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <div>
                        <p className="text-sm text-gray-900">{client.contactPerson?.name || 'No contact'}</p>
                        <p className="text-xs text-gray-600">{client.phone || 'No phone'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <p className="text-sm text-gray-600">
                        {client.lastDeliveryDate 
                          ? new Date(client.lastDeliveryDate).toLocaleDateString()
                          : 'Never'
                        }
                      </p>
                    </td>
                    <td className="py-3 px-6">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleAssignDelivery(client)}
                          className="px-3 py-1 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => notify.info(`Opening client details for ${client.name}`)}
                          className="px-3 py-1 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Client Stats */}
          <div className="p-6 bg-gray-50 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{clients.length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Active Deliveries</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {deliveries.filter(d => d.status === 'in-transit' || d.status === 'pending').length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Available Vehicles</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {vehicles.filter(v => v.status === 'active').length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm text-gray-600">Avg. Client Rating</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {clients.length > 0 
                    ? (clients.reduce((sum, c) => sum + (c.rating || 0), 0) / clients.length).toFixed(1)
                    : '0.0'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Tab */}
      {activeTab === 'deliveries' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Assignments</h2>
          <div className="space-y-4">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="border rounded-lg p-4 hover:border-primary-300 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{delivery.customer}</h3>
                    <p className="text-sm text-gray-600">{delivery.address}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    delivery.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    delivery.status === 'in-transit' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {delivery.status}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <Truck className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{delivery.driver}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{delivery.items} items</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{delivery.progress}% complete</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Navigation className="h-4 w-4 text-gray-400" />
                    <button
                      onClick={() => notify.info(`Navigating to ${delivery.address}`)}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Navigate
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Routing Tab */}
      {activeTab === 'routing' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Route Planning</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Route Optimization</h3>
              <div className="space-y-4">
                <button
                  onClick={() => handlePlanRoute(selectedClients)}
                  className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center justify-center space-x-2"
                >
                  <Route className="h-5 w-5" />
                  <span>Optimize Selected Route</span>
                </button>
                <button
                  onClick={() => notify.info('Generating daily route plan...')}
                  className="w-full px-4 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition flex items-center justify-center space-x-2"
                >
                  <Calendar className="h-5 w-5" />
                  <span>Generate Daily Plan</span>
                </button>
                <button
                  onClick={() => notify.info('Loading traffic data...')}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center justify-center space-x-2"
                >
                  <MapIcon className="h-5 w-5" />
                  <span>Check Traffic</span>
                </button>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Route Statistics</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Distance</span>
                    <span className="font-medium">142 km</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Estimated Time</span>
                    <span className="font-medium">3h 45m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Fuel Cost</span>
                    <span className="font-medium">$68.50</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Stops</span>
                    <span className="font-medium">{selectedClients.length || 8}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {['Restaurant Delivery', 'Office Delivery', 'Hotel Delivery', 'Rush Delivery', 'After-hours Delivery'].map((template) => (
              <div key={template} className="border rounded-lg p-4 hover:border-primary-300 transition">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">{template}</h3>
                  <FileText className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Standard delivery instructions and requirements for {template.toLowerCase()}.
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => notify.info(`Applying ${template} template...`)}
                    className="flex-1 px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    Use Template
                  </button>
                  <button
                    onClick={() => notify.info(`Editing ${template} template...`)}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Tips */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Dispatch Best Practices</h4>
            <ul className="mt-2 space-y-1 text-sm text-blue-700">
              <li>• Plan routes the night before to optimize driver schedules</li>
              <li>• Use client delivery preferences to avoid missed deliveries</li>
              <li>• Communicate delays to clients proactively</li>
              <li>• Review client location photos before assigning new drivers</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispatchDashboard;