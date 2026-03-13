import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Mail,
  Smartphone,
  Key,
  Save,
  Camera,
  Check,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, TextArea, Select } from '../../components/ui/Input';
import { notify } from '../../services/notifications';

type TabId = 'profile' | 'notifications' | 'security' | 'preferences';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const tabs: Tab[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'preferences', label: 'Preferences', icon: Palette },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    company: '',
    phone: '',
    bio: '',
  });

  const [notifications, setNotifications] = useState({
    emailDeliveries: true,
    emailMaintenance: true,
    pushDeliveries: true,
    pushMaintenance: false,
    weeklyReports: true,
  });

  const [preferences, setPreferences] = useState({
    language: 'en',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    theme: 'light',
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    notify.success('Settings saved successfully');
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-6">
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-blue-900 flex items-center justify-center text-white text-2xl font-bold">
            {profile.name.charAt(0) || 'U'}
          </div>
          <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md border border-slate-200 hover:bg-slate-50">
            <Camera className="h-4 w-4 text-slate-600" />
          </button>
        </div>
        <div>
          <h3 className="text-lg font-medium text-slate-900">Profile Photo</h3>
          <p className="text-sm text-slate-500">JPG, GIF or PNG. Max size of 800KB</p>
          <div className="mt-2 flex items-center space-x-3">
            <Button variant="outline" size="sm">Upload New</Button>
            <Button variant="ghost" size="sm" className="text-red-600">Remove</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="Full Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="John Doe" />
        <Input label="Email Address" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="john@example.com" disabled helperText="Contact support to change your email" />
        <Input label="Company" value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} placeholder="Acme Inc." />
        <Input label="Phone Number" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
        <textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={4} placeholder="Tell us about yourself..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900 resize-none" />
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-900 mb-1">Email Notifications</h3>
        <p className="text-sm text-slate-500 mb-4">Receive notifications via email</p>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer" style={{ minHeight: '44px' }}>
            <input type="checkbox" checked={notifications.emailDeliveries} onChange={(e) => setNotifications({ ...notifications, emailDeliveries: e.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900" />
            <div className="flex-1"><div className="text-sm font-medium text-slate-900">Delivery Updates</div><div className="text-sm text-slate-500">Get notified when deliveries are assigned or completed</div></div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer" style={{ minHeight: '44px' }}>
            <input type="checkbox" checked={notifications.emailMaintenance} onChange={(e) => setNotifications({ ...notifications, emailMaintenance: e.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900" />
            <div className="flex-1"><div className="text-sm font-medium text-slate-900">Maintenance Alerts</div><div className="text-sm text-slate-500">Alerts when vehicles require maintenance</div></div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer" style={{ minHeight: '44px' }}>
            <input type="checkbox" checked={notifications.weeklyReports} onChange={(e) => setNotifications({ ...notifications, weeklyReports: e.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900" />
            <div className="flex-1"><div className="text-sm font-medium text-slate-900">Weekly Reports</div><div className="text-sm text-slate-500">Summary of fleet activity every week</div></div>
          </label>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-900 mb-1">Push Notifications</h3>
        <p className="text-sm text-slate-500 mb-4">Receive push notifications on your devices</p>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer" style={{ minHeight: '44px' }}>
            <input type="checkbox" checked={notifications.pushDeliveries} onChange={(e) => setNotifications({ ...notifications, pushDeliveries: e.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900" />
            <div className="flex-1"><div className="text-sm font-medium text-slate-900">Delivery Updates</div><div className="text-sm text-slate-500">Real-time delivery notifications</div></div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer" style={{ minHeight: '44px' }}>
            <input type="checkbox" checked={notifications.pushMaintenance} onChange={(e) => setNotifications({ ...notifications, pushMaintenance: e.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900" />
            <div className="flex-1"><div className="text-sm font-medium text-slate-900">Maintenance Alerts</div><div className="text-sm text-slate-500">Urgent maintenance notifications</div></div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-900 mb-1">Change Password</h3>
        <p className="text-sm text-slate-500 mb-4">Update your password to keep your account secure</p>
        <div className="space-y-4 max-w-md">
          <Input label="Current Password" type="password" placeholder="Enter current password" />
          <Input label="New Password" type="password" placeholder="Enter new password" />
          <Input label="Confirm New Password" type="password" placeholder="Confirm new password" />
          <Button variant="primary">Update Password</Button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-900 mb-1">Two-Factor Authentication</h3>
        <p className="text-sm text-slate-500 mb-4">Add an extra layer of security to your account</p>
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-slate-400" />
            <div><div className="text-sm font-medium text-slate-900">Two-Factor Authentication</div><div className="text-sm text-slate-500">Not enabled</div></div>
          </div>
          <Button variant="outline" size="sm">Enable</Button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-900 mb-1">Active Sessions</h3>
        <p className="text-sm text-slate-500 mb-4">Manage your active sessions across devices</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Smartphone className="h-5 w-5 text-slate-400" />
              <div><div className="text-sm font-medium text-slate-900">Current Session</div><div className="text-sm text-slate-500">Toronto, Canada • Active now</div></div>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1"><Globe className="h-4 w-4 inline mr-1" />Language</label>
          <select value={preferences.language} onChange={(e) => setPreferences({ ...preferences, language: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900">
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
          <select value={preferences.timezone} onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900">
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Europe/Paris">Paris (CET)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date Format</label>
          <select value={preferences.dateFormat} onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900">
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Theme</label>
          <select value={preferences.theme} onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>
      </div>
    </div>
  );

  const tabContent: Record<TabId, React.ReactNode> = {
    profile: renderProfileTab(),
    notifications: renderNotificationsTab(),
    security: renderSecurityTab(),
    preferences: renderPreferencesTab(),
  };

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings' }]}>
      <PageHeader title="Settings" subtitle="Manage your account settings and preferences" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar — horizontal scroll on mobile, vertical on desktop */}
        <div className="lg:col-span-1">
          <Card padding="none">
            <nav className="flex overflow-x-auto lg:flex-col gap-1 p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 lg:w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <Card>
            {tabContent[activeTab]}
            <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
              <Button variant="primary" onClick={handleSave} loading={saving} iconLeft={<Save className="h-4 w-4" />}>
                Save Changes
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
