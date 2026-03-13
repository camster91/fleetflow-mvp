import React, { useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Link2,
  Check,
  X,
  RefreshCw,
  Settings,
  ExternalLink,
  Cloud,
  MapPin,
  CreditCard,
  Calculator,
  FileSpreadsheet,
} from 'lucide-react';
import { notify } from '../../services/notifications';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  connected: boolean;
  comingSoon?: boolean;
}

const integrations: Integration[] = [
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync expenses and invoices with QuickBooks Online',
    icon: <Calculator className="h-6 w-6 text-emerald-600" />,
    category: 'Accounting',
    connected: false,
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Connect your Xero account for financial tracking',
    icon: <FileSpreadsheet className="h-6 w-6 text-blue-600" />,
    category: 'Accounting',
    connected: false,
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Enhanced routing and location services',
    icon: <MapPin className="h-6 w-6 text-red-500" />,
    category: 'Navigation',
    connected: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Process payments and manage billing',
    icon: <CreditCard className="h-6 w-6 text-purple-600" />,
    category: 'Payments',
    connected: true,
  },
  {
    id: 'fuel-cards',
    name: 'Fuel Card Integration',
    description: 'Import fuel transactions automatically',
    icon: <CreditCard className="h-6 w-6 text-amber-600" />,
    category: 'Fuel',
    connected: false,
    comingSoon: true,
  },
  {
    id: 'telematics',
    name: 'Telematics Provider',
    description: 'Connect your existing GPS tracking devices',
    icon: <Cloud className="h-6 w-6 text-blue-500" />,
    category: 'GPS',
    connected: false,
    comingSoon: true,
  },
];

export default function IntegrationsPage() {
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(
    new Set(integrations.filter(i => i.connected).map(i => i.id))
  );

  const handleConnect = (id: string) => {
    notify.info(`Redirecting to ${integrations.find(i => i.id === id)?.name}...`);
    // In a real app, this would redirect to OAuth flow
    setTimeout(() => {
      setConnectedIntegrations(prev => new Set(Array.from(prev).concat(id)));
      notify.success(`Connected to ${integrations.find(i => i.id === id)?.name}`);
    }, 1500);
  };

  const handleDisconnect = (id: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    
    const newConnected = new Set(connectedIntegrations);
    newConnected.delete(id);
    setConnectedIntegrations(newConnected);
    notify.success('Integration disconnected');
  };

  const handleSync = (id: string) => {
    notify.success(`Syncing with ${integrations.find(i => i.id === id)?.name}...`);
  };

  const categories = Array.from(new Set(integrations.map(i => i.category)));

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Settings', href: '/settings' },
        { label: 'Integrations' },
      ]}
    >
      <PageHeader
        title="Integrations"
        subtitle="Connect FleetFlow with your favorite tools and services"
      />

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations
              .filter((i) => i.category === category)
              .map((integration) => {
                const isConnected = connectedIntegrations.has(integration.id);
                return (
                  <Card key={integration.id}>
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg">{integration.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{integration.name}</h4>
                          {integration.comingSoon && (
                            <Badge variant="default" size="sm">Coming Soon</Badge>
                          )}
                          {isConnected && (
                            <Badge variant="success" size="sm">Connected</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {integration.description}
                        </p>
                        
                        {!integration.comingSoon && (
                          <div className="flex items-center gap-2 mt-3">
                            {isConnected ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSync(integration.id)}
                                  iconLeft={<RefreshCw className="h-4 w-4" />}
                                >
                                  Sync Now
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDisconnect(integration.id)}
                                  className="text-red-600 hover:text-red-800"
                                  iconLeft={<X className="h-4 w-4" />}
                                >
                                  Disconnect
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConnect(integration.id)}
                                iconLeft={<Link2 className="h-4 w-4" />}
                              >
                                Connect
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}

      {/* Custom Integration CTA */}
      <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-2">Need a custom integration?</h3>
            <p className="text-blue-100">
              Our API allows you to build custom integrations for your specific needs.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-blue-600"
            iconLeft={<ExternalLink className="h-4 w-4" />}
          >
            View API Docs
          </Button>
        </div>
      </Card>
    </DashboardLayout>
  );
}
