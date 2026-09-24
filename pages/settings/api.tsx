import React, { useEffect, useState } from 'react';
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
  Webhook,
  Clock,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { notify, confirmAction } from '../../services/notifications';
import { formatDistanceToNow } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt: string | null;
  scopes: string[];
}

const MASKED_API_KEY = `ff_${'•'.repeat(16)}`;

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
}

export default function APISettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [keyName, setKeyName] = useState('Production API Key');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    fetch('/api/settings/api-keys')
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load API keys');
        return response.json();
      })
      .then((data) => setApiKeys(data.keys || []))
      .catch(() => notify.error('Failed to load API keys'))
      .finally(() => setLoading(false));
  }, []);

  const generateKey = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName }),
      });
      const data = await response.json();
      if (!response.ok || !data?.apiKey?.key) {
        const message = typeof data?.error === 'string' ? data.error : data?.error?.message;
        notify.error(message || 'Failed to generate API key');
        return;
      }
      const { key: plaintextKey, ...createdKey } = data.apiKey;
      setApiKeys((current) => [{ ...createdKey, key: MASKED_API_KEY, scopes: createdKey.scopes || ['read'] }, ...current]);
      setShowNewKey(plaintextKey);
      setShowKeyModal(false);
      notify.success('API key generated successfully');
    } catch {
      notify.error('Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const revokeKey = async (id: string) => {
    const ok = await confirmAction(
      'Apps using this key will stop working immediately.',
      'Revoke API key'
    );
    if (!ok) return;
    setRevokingId(id);
    try {
      const response = await fetch(`/api/settings/api-keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) {
        notify.error('Failed to revoke API key');
        return;
      }
      setApiKeys((current) => current.filter(k => k.id !== id));
      notify.success('API key revoked');
    } catch {
      notify.error('Failed to revoke API key');
    } finally {
      setRevokingId(null);
    }
  };

  const copyNewKey = async () => {
    if (!showNewKey || copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(showNewKey);
      notify.success('Copied to clipboard');
      setShowNewKey(null);
    } catch {
      notify.error('Could not copy the API key. Copy it manually before closing.');
    } finally {
      setCopying(false);
    }
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
              Use these keys to access the Fleetvera API programmatically
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

        {loading ? <p className="py-8 text-center text-slate-500">Loading API keys...</p> : apiKeys.length === 0 ? (
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
                    {apiKey.scopes?.includes('read') ? (
                      <Badge variant="success" size="sm">Active</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">Legacy / inert</Badge>
                    )}
                    {(apiKey.scopes || []).map((scope) => (
                      <Badge key={scope} variant="default" size="sm">{scope}</Badge>
                    ))}
                  </div>
                  {!apiKey.scopes?.includes('read') && (
                    <p className="mt-1 text-sm text-amber-700">Generate a replacement key to use the read API.</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-slate-100 px-2 py-0.5 rounded">
                      {MASKED_API_KEY}
                    </code>
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
                  loading={revokingId === apiKey.id}
                  disabled={revokingId !== null}
                  className="text-red-600 hover:text-red-800"
                  aria-label={`Revoke ${apiKey.name}`}
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
            disabled
            iconLeft={<Plus className="h-4 w-4" />}
          >
            Webhooks coming soon
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
      <Modal isOpen={showKeyModal} onClose={() => setShowKeyModal(false)} title="Generate API Key" size="sm">
        <div className="space-y-4">
          <Input label="Key name" value={keyName} onChange={(event) => setKeyName(event.target.value)} fullWidth />
          <Button variant="primary" fullWidth disabled={!keyName.trim()} loading={generating} onClick={generateKey}>Generate secure key</Button>
        </div>
      </Modal>
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
            onClick={copyNewKey}
            loading={copying}
            iconLeft={<Copy className="h-4 w-4" />}
          >
            Copy to Clipboard
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
