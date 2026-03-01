import React, { useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { Building, Save, Upload, Clock } from 'lucide-react';
import { notify } from '../../services/notifications';

export default function CompanySettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [company, setCompany] = useState({
    name: 'Acme Logistics',
    logo: null as string | null,
    address: '123 Main Street',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5V 1K4',
    country: 'Canada',
    phone: '+1 (416) 555-0123',
    website: 'https://acmelogistics.com',
    businessHours: '9:00 AM - 5:00 PM',
    timezone: 'America/Toronto',
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // API call would go here
      notify.success('Company settings updated successfully');
    } catch (error) {
      notify.error('Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Settings', href: '/settings' },
        { label: 'Company' },
      ]}
    >
      <PageHeader
        title="Company Settings"
        subtitle="Manage your organization details and branding"
      />

      <div className="max-w-3xl">
        {/* Logo */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Company Logo</h3>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center">
              {company.logo ? (
                <img src={company.logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Building className="h-10 w-10 text-slate-400" />
              )}
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-3">
                Upload your company logo. Recommended size: 400x400px, PNG or SVG format.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" iconLeft={<Upload className="h-4 w-4" />}>
                  Upload Logo
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Company Information</h3>
          <div className="space-y-4">
            <Input
              label="Company Name"
              value={company.name}
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
              />
              <Input
                label="Website"
                value={company.website}
                onChange={(e) => setCompany({ ...company, website: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Business Hours
              </label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={company.businessHours}
                  onChange={(e) => setCompany({ ...company, businessHours: e.target.value })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Address */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Business Address</h3>
          <div className="space-y-4">
            <Input
              label="Street Address"
              value={company.address}
              onChange={(e) => setCompany({ ...company, address: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="City"
                value={company.city}
                onChange={(e) => setCompany({ ...company, city: e.target.value })}
              />
              <Input
                label="Province/State"
                value={company.province}
                onChange={(e) => setCompany({ ...company, province: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Postal/ZIP Code"
                value={company.postalCode}
                onChange={(e) => setCompany({ ...company, postalCode: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                <select
                  value={company.country}
                  onChange={(e) => setCompany({ ...company, country: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Canada">Canada</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Australia">Australia</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Branding */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Branding (Enterprise)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ColorPicker
              label="Primary Color"
              value={company.primaryColor}
              onChange={(color) => setCompany({ ...company, primaryColor: color })}
            />
            <ColorPicker
              label="Secondary Color"
              value={company.secondaryColor}
              onChange={(color) => setCompany({ ...company, secondaryColor: color })}
            />
          </div>
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              <strong>Preview:</strong> These colors will be used in your branded reports, 
              email templates, and customer-facing materials.
            </p>
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
