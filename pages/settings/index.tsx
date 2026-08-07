import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/session';
import { User, Bell, Palette, Save, Camera, Moon, Sun } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { notify } from '../../services/notifications';

type TabId = 'profile' | 'notifications' | 'preferences';

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({ name: '', email: '', company: '', phone: '', bio: '' });
  const [notifications, setNotifications] = useState({
    emailDeliveries: true, emailMaintenance: true,
    pushDeliveries: true, pushMaintenance: false, weeklyReports: true,
  });
  const [preferences, setPreferences] = useState({
    language: 'en', timezone: 'America/Toronto', dateFormat: 'MM/DD/YYYY', theme: 'light',
  });
  const [isDark, toggleDark] = useDarkMode();

  // Load profile on mount
  const loadProfile = useCallback(async () => {
    try {
      const r = await fetch('/api/settings/profile');
      if (!r.ok) return;
      const { user, prefs } = await r.json();
      setProfile(p => ({
        ...p,
        name: user.name || '',
        email: user.email || '',
        company: user.company || '',
        phone: prefs?.phone || '',
        bio: prefs?.bio || '',
      }));
      if (prefs?.notificationSettings) setNotifications(prefs.notificationSettings);
      if (prefs?.preferences) setPreferences(prefs.preferences);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'profile') {
        const r = await fetch('/api/settings/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: profile.name, company: profile.company, phone: profile.phone, bio: profile.bio }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          notify.error(e.error || 'Failed to save profile');
          return;
        }
        await updateSession();
      } else if (activeTab === 'notifications') {
        const r = await fetch('/api/settings/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationSettings: notifications }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          notify.error(e.error || 'Failed to save notification settings');
          return;
        }
      } else if (activeTab === 'preferences') {
        const r = await fetch('/api/settings/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          notify.error(e.error || 'Failed to save preferences');
          return;
        }
      }
      notify.success('Settings saved');
    } catch { notify.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  const tabs = [
    { id: 'profile' as TabId, label: 'Profile', icon: User },
    { id: 'notifications' as TabId, label: 'Notifications', icon: Bell },
    { id: 'preferences' as TabId, label: 'Preferences', icon: Palette },
  ];

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}>
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Sidebar tabs */}
        <div className="lg:w-48 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === id ? 'bg-blue-50 text-blue-900' : 'text-slate-600 hover:bg-slate-100'
                }`}>
                <Icon className="h-4 w-4 shrink-0" />{label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {loading ? (
            <Card><div className="h-64 animate-pulse bg-slate-100 rounded-xl" /></Card>
          ) : (
            <Card>
              {activeTab === 'profile' && (
                <div className="space-y-5">
                  <h2 className="font-semibold text-slate-900">Profile Information</h2>
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-blue-900 flex items-center justify-center text-white text-xl font-bold shrink-0">
                      {profile.name.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                      <Camera className="h-4 w-4" /> Change photo
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><label className={labelCls}>Full Name</label><input value={profile.name} onChange={e => setProfile(p => ({...p, name: e.target.value}))} className={inputCls} /></div>
                    <div><label className={labelCls}>Email</label><input value={profile.email} disabled className={inputCls + ' bg-slate-50 cursor-not-allowed'} /></div>
                    <div><label className={labelCls}>Company</label><input value={profile.company} onChange={e => setProfile(p => ({...p, company: e.target.value}))} className={inputCls} placeholder="Your company" /></div>
                    <div><label className={labelCls}>Phone</label><input value={profile.phone} onChange={e => setProfile(p => ({...p, phone: e.target.value}))} className={inputCls} placeholder="+1 (555) 000-0000" /></div>
                  </div>
                  <div><label className={labelCls}>Bio</label><textarea value={profile.bio} onChange={e => setProfile(p => ({...p, bio: e.target.value}))} className={inputCls + ' resize-none'} rows={3} placeholder="Tell your team a little about yourself" /></div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-5">
                  <h2 className="font-semibold text-slate-900">Notification Preferences</h2>
                  {[
                    { key: 'emailDeliveries', label: 'Email — Delivery updates', desc: 'Get notified when deliveries change status' },
                    { key: 'emailMaintenance', label: 'Email — Maintenance alerts', desc: 'Reminders for upcoming and overdue tasks' },
                    { key: 'pushDeliveries', label: 'Push — Delivery updates', desc: 'Real-time push notifications for deliveries' },
                    { key: 'pushMaintenance', label: 'Push — Maintenance alerts', desc: 'Push alerts for maintenance tasks' },
                    { key: 'weeklyReports', label: 'Weekly summary report', desc: 'A weekly digest of your fleet activity' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div><p className="text-sm font-medium text-slate-900">{label}</p><p className="text-xs text-slate-500">{desc}</p></div>
                      <button
                        onClick={() => setNotifications(n => ({ ...n, [key]: !n[key as keyof typeof n] }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          notifications[key as keyof typeof notifications] ? 'bg-blue-600' : 'bg-slate-200'
                        }`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          notifications[key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="space-y-5">
                  <h2 className="font-semibold text-slate-900">App Preferences</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { key: 'language', label: 'Language', options: [['en','English'],['fr','French'],['es','Spanish']] },
                      { key: 'timezone', label: 'Timezone', options: [['America/Toronto','Eastern (Toronto)'],['America/Chicago','Central (Chicago)'],['America/Denver','Mountain (Denver)'],['America/Los_Angeles','Pacific (LA)'],['America/Vancouver','Pacific (Vancouver)']] },
                      { key: 'dateFormat', label: 'Date Format', options: [['MM/DD/YYYY','MM/DD/YYYY'],['DD/MM/YYYY','DD/MM/YYYY'],['YYYY-MM-DD','YYYY-MM-DD']] },
                    ].map(({ key, label, options }) => (
                      <div key={key}>
                        <label className={labelCls}>{label}</label>
                        <select value={preferences[key as keyof typeof preferences]}
                          onChange={e => setPreferences(p => ({ ...p, [key]: e.target.value }))}
                          className={inputCls}>
                          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    ))}
                    <div>
                      <label className={labelCls}>Theme</label>
                      <div className="flex items-center gap-3 mt-1">
                        <Sun className="h-4 w-4 text-slate-500" />
                        <button
                          onClick={toggleDark}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isDark ? 'bg-blue-600' : 'bg-slate-200'
                          }`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            isDark ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                        <Moon className="h-4 w-4 text-slate-500" />
                        <span className="text-sm text-slate-600">{isDark ? 'Dark' : 'Light'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-slate-100">
                <Button variant="primary" onClick={handleSave} disabled={saving}
                  iconLeft={<Save className="h-4 w-4" />}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
