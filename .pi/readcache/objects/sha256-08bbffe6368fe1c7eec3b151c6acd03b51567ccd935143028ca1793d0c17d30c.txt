import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FileUpload } from '../../components/ui/FileUpload';
import { Camera, Save, Globe, Clock } from 'lucide-react';
import { notify } from '../../services/notifications';

export default function ProfileSettingsPage() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    phone: '',
    timezone: 'America/Toronto',
    language: 'en',
    bio: '',
    isPublic: false,
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // API call would go here
      await update({ name: profile.name });
      notify.success('Profile updated successfully');
    } catch (error) {
      notify.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Settings', href: '/settings' },
        { label: 'Profile' },
      ]}
    >
      <PageHeader
        title="Profile Settings"
        subtitle="Manage your personal information and preferences"
      />

      <div className="max-w-3xl">
        {/* Avatar Section */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Profile Photo</h3>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 bg-blue-900 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {profile.name.charAt(0) || 'U'}
              </div>
              <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md border border-slate-200 hover:bg-slate-50">
                <Camera className="h-4 w-4 text-slate-600" />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-3">
                Upload a new avatar. Large files will be resized automatically.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm">
                  Upload New
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600">
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Basic Information */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              disabled
              helperText="Contact support to change your email"
            />
            <Input
              label="Phone Number"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bio
            </label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={3}
              placeholder="Tell us a bit about yourself..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              This will be visible to your team members.
            </p>
          </div>
        </Card>

        {/* Preferences */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <Globe className="h-4 w-4 inline mr-1" />
                Language
              </label>
              <select
                value={profile.language}
                onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
                <option value="de">German</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <Clock className="h-4 w-4 inline mr-1" />
                Timezone
              </label>
              <select
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={profile.isPublic}
                onChange={(e) => setProfile({ ...profile, isPublic: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">
                Make my profile visible to other organizations
              </span>
            </label>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isLoading}
            iconLeft={<Save className="h-4 w-4" />}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
