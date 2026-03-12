import React, { useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Save, Bell, Mail, Smartphone, Clock } from 'lucide-react';
import { notify } from '../../services/notifications';

interface NotificationPreference {
  type: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export default function NotificationSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [digestFrequency, setDigestFrequency] = useState('weekly');
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    {
      type: 'maintenance',
      label: 'Maintenance Alerts',
      description: 'Get notified when vehicles are due for maintenance',
      email: true,
      push: true,
      inApp: true,
    },
    {
      type: 'deliveries',
      label: 'Delivery Updates',
      description: 'Notifications about delivery status changes',
      email: true,
      push: false,
      inApp: true,
    },
    {
      type: 'team',
      label: 'Team Invitations',
      description: 'When someone invites you to join a team',
      email: true,
      push: true,
      inApp: true,
    },
    {
      type: 'billing',
      label: 'Billing & Payments',
      description: 'Payment confirmations and billing alerts',
      email: true,
      push: false,
      inApp: true,
    },
    {
      type: 'security',
      label: 'Security Alerts',
      description: 'New logins, password changes, and security events',
      email: true,
      push: true,
      inApp: true,
    },
    {
      type: 'reports',
      label: 'Scheduled Reports',
      description: 'When your scheduled reports are ready',
      email: true,
      push: false,
      inApp: false,
    },
  ]);

  const updatePreference = (type: string, channel: 'email' | 'push' | 'inApp', value: boolean) => {
    setPreferences(prev =>
      prev.map(p => (p.type === type ? { ...p, [channel]: value } : p))
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000));
      notify.success('Notification preferences saved');
    } catch (error) {
      notify.error('Failed to save preferences');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Settings', href: '/settings' },
        { label: 'Notifications' },
      ]}
    >
      <PageHeader
        title="Notification Preferences"
        subtitle="Choose how and when you want to be notified"
      />

      <div className="max-w-4xl">
        {/* Channels Header */}
        <Card className="mb-4">
          <div className="flex items-center justify-end gap-8 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Smartphone className="h-4 w-4" />
              Push
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Bell className="h-4 w-4" />
              In-App
            </div>
          </div>
        </Card>

        {/* Notification Types */}
        <Card className="mb-6">
          <div className="space-y-6">
            {preferences.map((pref) => (
              <div
                key={pref.type}
                className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0 last:pb-0 first:pt-0"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900">{pref.label}</h4>
                  <p className="text-sm text-slate-500">{pref.description}</p>
                </div>
                <div className="flex items-center gap-8">
                  <input
                    type="checkbox"
                    checked={pref.email}
                    onChange={(e) => updatePreference(pref.type, 'email', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <input
                    type="checkbox"
                    checked={pref.push}
                    onChange={(e) => updatePreference(pref.type, 'push', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <input
                    type="checkbox"
                    checked={pref.inApp}
                    onChange={(e) => updatePreference(pref.type, 'inApp', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Digest Settings */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Email Digest</h3>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-400" />
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Digest Frequency
              </label>
              <select
                value={digestFrequency}
                onChange={(e) => setDigestFrequency(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Receive a summary of your fleet activity via email at your chosen frequency.
          </p>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isLoading}
            iconLeft={<Save className="h-4 w-4" />}
          >
            Save Preferences
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
