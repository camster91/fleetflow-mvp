import React, { useState } from 'react';
import { 
  Users, MapPin, Package, Calendar, Clock, Navigation, 
  Phone, Mail, MessageSquare, Filter, Search, Plus,
  Building, Truck, Route, FileText, CheckCircle, AlertCircle,
  Star, Camera, Map as MapIcon, BarChart, Download
} from 'lucide-react';
import { notify, confirmAction, promptAction, clientNotifications, deliveryNotifications } from '../../services/notifications';
import * as dataService from '../../services/dataServiceWithSync';

const DispatchDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  
  const clients = dataService.getClients();
  const deliveries = dataService.getDeliveries();
  const vehicles = dataService.getVehicles();

  const handleAssignDelivery = async (client: dataService.Client) => {
    const driver = await promptAction(`Assign delivery to ${client.name}. Enter driver name:`, 'John D.');
    if (driver) {
      deliveryNotifications.assigned(driver);
      notify.info(
        `Delivery assigned to ${driver} for ${client.name}\n\nAddress: ${client.address}\nPreferred Times: ${client.preferredDeliveryTimes?.join(', ') || 'Any'}\n\nIn production, this would create a delivery assignment and notify the driver.`,
        { duration: 5000 }
      );
    }
  };

  const handlePlanRoute = async (clientIds: number[]) => {
    const selected = clients.filter(c => clientIds.includes(c.id));
    if (selected.length === 0) { notify.info('Please select clients to plan a route.', { duration: 3000 }); return; }
    const addresses = selected.map(c => c.address).join('\n• ');
    notify.info(
      `Route Planning for ${selected.length} Clients\n\nAddresses:\n• ${addresses}\n\nIn production, this would:\n• Optimize route using Google Maps API\n• Calculate estimated travel time\n• Assign to available vehicle\n• Generate turn-by-turn directions`,
      { duration: 6000 }
    );
  };

  const handleSendBulkMessage = async (clientIds: number[]) => {
    const selected = clients.filter(c => clientIds.includes(c.id));
    if (selected.length === 0) return;
    const message = await promptAction(`Send message to ${selected.length} clients:`, 'Delivery update: Your order is on the way!');
    if (message) notify.info(`Message sent to ${selected.length} clients:\n\n"${message}"\n\nIn production, this would send SMS/email notifications to all selected clients.`, { duration: 5000 });
  };

  const handleToggleClientSelection = (clientId: number) => {
    setSelectedClients(prev => prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]);
  };

  const handleCreateDeliveryTemplate = async () => {
    const name = await promptAction('Enter template name:', 'Standard Restaurant Delivery');
    if (name) notify.info(`Delivery template "${name}" created\n\nIn production, this would save a reusable delivery template.`, { duration: 5000 });
  };

  const filteredClients = searchQuery ? dataService.searchClients(searchQuery) : clients;

  return (
    <div className="min-h-screen bg-gray-50 p-4">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dispatch Operations</h1>
            <p className="text-gray-600 hidden sm:block">Manage client deliveries, route planning, and communications</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => notify.info('Opening dispatch analytics...')}
              className="p-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center sm:space-x-2"
            >
              <BarChart className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </button>
            <button
              onClick={() => notify.info('Exporting dispatch data...')}
              className="p-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center sm:space-x-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Tabs — horizontal scroll on mobile */}
        <div className="mt-4 flex space-x-1 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {['clients', 'deliveries', 'routing', 'templates'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              style={{ touchAction: 'manipulation' }}
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
            placeholder="Search clients, addresses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-base"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePlanRoute(selectedClients)}
            disabled={selectedClients.length === 0}
            className={`flex-1 sm:flex-none px-3 py-2 rounded-lg transition flex items-center justify-center space-x-2 ${
              selectedClients.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Route className="h-4 w-4 shrink-0" />
            <span className="text-sm">Route ({selectedClients.length})</span>
          </button>
          <button
            onClick={() => handleSendBulkMessage(selectedClients)}
            disabled={selectedClients.length === 0}
            className={`flex-1 sm:flex-none px-3 py-2 rounded-lg transition flex items-center justify-center space-x-2 ${
              selectedClients.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="text-sm">Msg ({selectedClients.length})</span>
          </button>
        </div>
        <div className="hidden md:flex items-center justify-end space-x-2">
          <button
            onClick={handleCreateDeliveryTemplate}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Client Database</h2>
                <p className="text-gray-600 text-sm hidden sm:block">Manage client information and delivery preferences</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{selectedClients.length} selected</span>
                <button onClick={() => setSelectedClients([])} className="text-sm text-blue-600 hover:text-blue-700">Clear</button>
              </div>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className={`p-4 ${selectedClients.includes(client.id) ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.id)}
                    onChange={() => handleToggleClientSelection(client.id)}
                    className="rounded border-gray-300 shrink-0 h-4 w-4"
                  />
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-blue-700 font-medium">{client.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{client.name}</p>
                    <p className="text-xs text-gray-500 truncate">{client.address}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 shrink-0">
                    {client.type}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleAssignDelivery(client)}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium min-h-[40px]"
                    style={{ touchAction: 'manipulation' }}
                  >
                    Assign Delivery
                  </button>
                  <button
                    onClick={() => notify.info(`Viewing details for ${client.name}`)}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium min-h-[40px]"
                    style={{ touchAction: 'manipulation' }}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                      onChange={() => {
                        if (selectedClients.length === filteredClients.length) setSelectedClients([]);
                        else setSelectedClients(filteredClients.map(c => c.id));
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
                  <tr key={client.id} className={`border-b last:border-0 hover:bg-gray-50 ${selectedClients.includes(client.id) ? 'bg-blue-50' : ''}`}>
                    <td className="py-4 px-6">
                      <input type="checkbox" checked={selectedClients.includes(client.id)} onChange={() => handleToggleClientSelection(client.id)} className="rounded border-gray-300" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-700 font-medium text-sm">{client.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{client.name}</p>
                          <p className="text-xs text-gray-500">{client.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{client.type}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="text-sm text-gray-900">{client.contactPerson?.name || '—'}</p>
                        <p className="text-xs text-gray-500">{client.phone || client.email || '—'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{client.lastDeliveryDate || 'No deliveries yet'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleAssignDelivery(client)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Assign</button>
                        <button onClick={() => notify.info(`Viewing details for ${client.name}`)} className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'deliveries' && (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Delivery management view</p>
        </div>
      )}
      {activeTab === 'routing' && (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
          <MapIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Route planning view</p>
        </div>
      )}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Delivery templates</p>
        </div>
      )}

      {/* FAB — mobile only, sits above bottom tab bar */}
      <button
        onClick={() => filteredClients.length > 0 && handleAssignDelivery(filteredClients[0])}
        className="fixed bottom-20 right-4 z-30 lg:hidden flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"
        aria-label="Assign delivery"
        style={{ touchAction: 'manipulation' }}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
};

export default DispatchDashboard;
