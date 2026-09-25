import React, { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layouts/DashboardLayout'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ColorPicker } from '../../components/ui/ColorPicker'
import { Building, Save, Upload, Clock, Globe } from 'lucide-react'
import { notify } from '../../services/notifications'
import Image from 'next/image'
import { DEFAULT_TIME_ZONE, supportedTimeZones } from '../../lib/dateOnly'

type WorkspaceSettings = { scope: 'team' | 'personal'; name: string | null; timeZone: string; canEdit: boolean }

export default function CompanySettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
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
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
  })

  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null)
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE)
  const [timeZoneError, setTimeZoneError] = useState<string | null>(null)
  const [isSavingTimeZone, setIsSavingTimeZone] = useState(false)
  // Filled after mount: the browser's Intl zone list can differ from the
  // server's, so rendering it during prerender would cause a hydration mismatch.
  const [zoneList, setZoneList] = useState<string[]>([DEFAULT_TIME_ZONE])
  const timeZones = useMemo(
    () => (zoneList.includes(timeZone) ? zoneList : [...zoneList, timeZone]),
    [zoneList, timeZone]
  )

  useEffect(() => {
    setZoneList(supportedTimeZones())
    let cancelled = false
    fetch('/api/settings/workspace')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((data: WorkspaceSettings) => {
        if (cancelled) return
        setWorkspace(data)
        setTimeZone(data.timeZone)
      })
      .catch(() => {
        if (!cancelled) setTimeZoneError('Workspace time zone could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveTimeZone = async () => {
    setIsSavingTimeZone(true)
    setTimeZoneError(null)
    try {
      const r = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeZone }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setTimeZoneError(data.error || 'Failed to update the workspace time zone.')
        return
      }
      setTimeZone(data.timeZone)
      setWorkspace((current) => (current ? { ...current, timeZone: data.timeZone } : current))
      notify.success('Workspace time zone updated')
    } catch {
      setTimeZoneError('Failed to update the workspace time zone.')
    } finally {
      setIsSavingTimeZone(false)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // API call would go here
      notify.success('Company settings updated successfully')
    } catch (error) {
      notify.error('Failed to update settings')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DashboardLayout
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings', href: '/settings' }, { label: 'Company' }]}
    >
      <PageHeader title="Company Settings" subtitle="Manage your organization details and branding" />

      <div className="max-w-3xl">
        {/* Logo */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Company Logo</h3>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center">
              {company.logo ? (
                <Image
                  unoptimized
                  src={company.logo}
                  alt="Company logo"
                  width={96}
                  height={96}
                  className="w-full h-full object-contain"
                />
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Hours</label>
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

        {/* Workspace time zone */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Workspace Time Zone</h3>
          <p className="text-sm text-slate-600 mb-4">
            Decides when a maintenance task becomes overdue and when due-date reminders are sent
            {workspace?.scope === 'team' && workspace.name ? ` for ${workspace.name}` : ''}.
          </p>
          <label htmlFor="workspace-time-zone" className="block text-sm font-medium text-slate-700 mb-1">
            Time zone
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Globe className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <select
                id="workspace-time-zone"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                disabled={!workspace?.canEdit || isSavingTimeZone}
                aria-invalid={timeZoneError ? true : undefined}
                aria-describedby={timeZoneError ? 'workspace-time-zone-error' : 'workspace-time-zone-help'}
                className="min-h-11 flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              >
                {timeZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            {workspace?.canEdit && (
              <Button
                variant="outline"
                onClick={handleSaveTimeZone}
                loading={isSavingTimeZone}
                disabled={timeZone === workspace.timeZone}
                className="min-h-11"
              >
                Save time zone
              </Button>
            )}
          </div>
          {timeZoneError ? (
            <p id="workspace-time-zone-error" role="alert" className="mt-2 text-sm text-red-600">
              {timeZoneError}
            </p>
          ) : (
            <p id="workspace-time-zone-help" className="mt-2 text-sm text-slate-500">
              {workspace && !workspace.canEdit
                ? 'Only workspace owners and admins can change the time zone.'
                : 'Use the zone where your fleet operates.'}
            </p>
          )}
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
              <strong>Preview:</strong> These colors will be used in your branded reports, email templates, and
              customer-facing materials.
            </p>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button variant="primary" onClick={handleSave} loading={isLoading} iconLeft={<Save className="h-4 w-4" />}>
            Save Changes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
