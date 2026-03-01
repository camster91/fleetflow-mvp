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

  // Profile form state
  const [profile, setProfile] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    company: '',
    phone: '',
    bio: '',
  });

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailDeliveries: true,
    emailMaintenance: true,
    pushDeliveries: true,
    pushMaintenance: false,
    weeklyReports: true,
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    language: 'en',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    theme: 'light',
  });

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    notify.success('Settings saved successfully');
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      {/* Avatar Section */}
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

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Full Name"
          value={profile.name}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
        />
        <Input
          label="Email Address"
          type="email"
          value={profile.email}
          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
        />
        <Input
          label="Company"
          value={profile.company}
          onChange={(e) => setProfile({ ...profile, company: e.target.value })}
        />
        <Input
          label="Phone Number"
          value={profile.phone}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
        />
      </div>

      <TextArea
        label="Bio"
        value={profile.bio}
        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
        helperText="Brief description for your profile."
      />
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-900 mb-4">Email Notifications</h3>
        <div className="space-y-4">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.emailDeliveries}
              onChange={(e) => setNotifications({ ...notifications, emailDeliveries: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
            />
            <div>
              <p className="font-medium text-slate-900">Delivery Updates</p>
              <p className="text-sm text-slate-500">Get notified when delivery status changes</p>
            </div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.emailMaintenance}
              onChange={(e) => setNotifications({ ...notifications, emailMaintenance: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
            />
            <div>
              <p className="font-medium text-slate-900">Maintenance Alerts</p>
              <p className="text-sm text-slate-500">Receive maintenance due reminders</p>
            </div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.weeklyReports}
              onChange={(e) => setNotifications({ ...notifications, weeklyReports: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
            />
            <div>
              <p className="font-medium text-slate-900">Weekly Reports</p>
              <p className="text-sm text-slate-500">Receive weekly summary reports</p>
            </div>
          </label>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-900 mb-4">Push Notifications</h3>
        <div className="space-y-4">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.pushDeliveries}
              onChange={(e) => setNotifications({ ...notifications, pushDeliveries: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
            />
            <div>
              <p className="font-medium text-slate-900">Delivery Updates</p>
              <p className="text-sm text-slate-500">Push notifications for delivery changes</p>
            </div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.pushMaintenance}
              onChange={(e) => setNotifications({ ...notifications, pushMaintenance: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
            />
            <div>
              <p className="font-medium text-slate-900">Maintenance Alerts</p>
              <p className="text-sm text-slate-500">Push notifications for maintenance</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-900 mb-4">Change Password</h3>
        <div className="space-y-4 max-w-md">
          <Input
            label="Current Password"
            type="password"
            placeholder="Enter current password"
          />
          <Input
            label="New Password"
            type="password"
            placeholder="Enter new password"
          />
          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Confirm new password"
          />
          <Button variant="primary">Update Password</Button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-900 mb-4">Two-Factor Authentication</h3>
        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Smartphone className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Authenticator App</p>
              <p className="text-sm text-slate-500">Use an authenticator app for 2FA</p>
            </div>
          </div>
          <Button variant="outline" size="sm">Enable</Button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-medium text-slate-900 mb-4">Active Sessions</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white rounded-lg">
                <Globe className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Current Session</p>
                <p className="text-sm text-slate-500">Windows • Chrome • Toronto, Canada</p>
              </div>
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
        <Select
          label="Language"
          value={preferences.language}
          onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
          options={[
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'French' },
            { value: 'es', label: 'Spanish' },
            { value: 'de', label: 'German' },
          ]}
        />
        <Select
          label="Timezone"
          value={preferences.timezone}
          onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
          options={[
            { value: 'America/New_York', label: 'Eastern Time (ET)' },
            { value: 'America/Chicago', label: 'Central Time (CT)' },
            { value: 'America/Denver', label: 'Mountain Time (MT)' },
            { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
          ]}
        />
        <Select
          label="Date Format"
          value={preferences.dateFormat}
          onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
          options={[
            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
          ]}
        />
        <Select
          label="Theme"
          value={preferences.theme}
          onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
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
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Settings' },
      ]}
    >
      <PageHeader
        title="Settings"
        subtitle="Manage your account settings and preferences"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <Card className="lg:col-span-1 h-fit">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${activeTab === tab.id
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                  `}
                >
                  <Icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <Button
                variant="primary"
                size="sm"
                iconLeft={saving ? undefined : <Save className="h-4 w-4" />}
                loading={saving}
                onClick={handleSave}
              >
                Save Changes
              </Button>
            </div>
            {tabContent[activeTab]}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
