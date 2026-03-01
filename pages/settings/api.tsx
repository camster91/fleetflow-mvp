import React, { useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Webhook,
  Clock,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { notify } from '../../services/notifications';
import { formatDistanceToNow } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt: string | null;
  permissions: string[];
}

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
}

export default function APISettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Production API Key',
      key: 'ff_live_xxxxxxxxxxxx1234',
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
      permissions: ['read', 'write'],
    },
  ]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const generateKey = () => {
    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: 'New API Key',
      key: 'ff_live_' + Math.random().toString(36).substring(2, 15),
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      permissions: ['read'],
    };
    setApiKeys([...apiKeys, newKey]);
    setShowNewKey(newKey.key);
    setShowKeyModal(false);
    notify.success('API key generated successfully');
  };

  const revokeKey = (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    setApiKeys(apiKeys.filter(k => k.id !== id));
    notify.success('API key revoked');
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    notify.success('Copied to clipboard');
  };

  const toggleKeyVisibility = (id: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleKeys(newVisible);
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Settings', href: '/settings' },
        { label: 'API' },
      ]}
    >
      <PageHeader
        title="API & Integrations"
        subtitle="Manage API keys and webhook configurations"
      />

      {/* API Keys Section */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">API Keys</h3>
            <p className="text-sm text-slate-500">
              Use these keys to access the FleetFlow API programmatically
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowKeyModal(true)}
            iconLeft={<Plus className="h-4 w-4" />}
          >
            Generate Key
          </Button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg">
            <Key className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600">No API keys yet</p>
            <p className="text-sm text-slate-500">Generate your first key to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-900">{apiKey.name}</h4>
                    <Badge variant="success" size="sm">Active</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-slate-100 px-2 py-0.5 rounded">
                      {visibleKeys.has(apiKey.id) || showNewKey === apiKey.key
                        ? apiKey.key
                        : apiKey.key.substring(0, 12) + '••••••••'}
                    </code>
                    <button
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      {visibleKeys.has(apiKey.id) ? (
                        <EyeOff className="h-4 w-4 text-slate-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-slate-500" />
                      )}
                    </button>
                    <button
                      onClick={() => copyKey(apiKey.key)}
                      className="p-1 hover:bg-slate-100 rounded"
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span>Created {formatDistanceToNow(new Date(apiKey.createdAt))} ago</span>
                    {apiKey.lastUsedAt && (
                      <span>Last used {formatDistanceToNow(new Date(apiKey.lastUsedAt))} ago</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeKey(apiKey.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Security Notice</p>
            <p className="text-sm text-amber-700 mt-1">
              Keep your API keys secure. Do not share them in public repositories or client-side code.
              If a key is compromised, revoke it immediately and generate a new one.
            </p>
          </div>
        </div>
      </Card>

      {/* Webhooks Section */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Webhooks</h3>
            <p className="text-sm text-slate-500">
              Receive real-time notifications when events occur in your account
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowWebhookModal(true)}
            iconLeft={<Plus className="h-4 w-4" />}
          >
            Add Webhook
          </Button>
        </div>

        {webhooks.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg">
            <Webhook className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600">No webhooks configured</p>
            <p className="text-sm text-slate-500">Add a webhook to receive event notifications</p>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-900">{webhook.url}</h4>
                    <Badge variant={webhook.active ? 'success' : 'default'}>
                      {webhook.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Events: {webhook.events.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* New Key Modal */}
      <Modal
        isOpen={!!showNewKey}
        onClose={() => setShowNewKey(null)}
        title="API Key Generated"
        size="md"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Your New API Key
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Copy this key now. You won't be able to see it again!
          </p>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm break-all mb-4">
            {showNewKey}
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              copyKey(showNewKey!);
              setShowNewKey(null);
            }}
            iconLeft={<Copy className="h-4 w-4" />}
          >
            Copy to Clipboard
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
