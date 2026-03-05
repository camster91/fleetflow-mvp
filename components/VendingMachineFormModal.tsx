import { useState, useEffect } from 'react'
import { Building, MapPin, Lock, FileText, User, Phone, Mail, Clock, CheckCircle, AlertTriangle, Package } from 'lucide-react'
import FormModal from './FormModal'
import AutocompleteInput from './AutocompleteInput'
import * as dataService from '../services/dataServiceWithSync'
import * as recentItems from '../services/recentItems'

interface VendingMachineFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (machine: dataService.VendingMachine) => void
  machine?: dataService.VendingMachine | null
}

const MACHINE_TYPES = [
  { value: 'snacks', label: 'Snacks', icon: '🍿', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'beverages', label: 'Beverages', icon: '🥤', color: 'bg-blue-100 text-blue-700' },
  { value: 'combo', label: 'Combo', icon: '🛍️', color: 'bg-green-100 text-green-700' },
  { value: 'coffee', label: 'Coffee', icon: '☕', color: 'bg-amber-100 text-amber-700' },
  { value: 'fresh-food', label: 'Fresh Food', icon: '🥗', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'other', label: 'Other', icon: '📦', color: 'bg-gray-100 text-gray-700' }
] as const

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  { value: 'needs-restock', label: 'Needs Restock', color: 'bg-yellow-100 text-yellow-700', icon: Package },
  { value: 'needs-maintenance', label: 'Needs Maintenance', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  { value: 'offline', label: 'Offline', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
] as const

export default function VendingMachineFormModal({ isOpen, onClose, onSubmit, machine }: VendingMachineFormModalProps) {
  const isEditing = !!machine
  const [recents, setRecents] = useState<recentItems.RecentItems>(recentItems.getRecentItems())
  
  const [formData, setFormData] = useState<{
    name: string
    machineId: string
    location: string
    locationDetail: string
    type: 'snacks' | 'beverages' | 'combo' | 'coffee' | 'fresh-food' | 'other'
    status: 'operational' | 'needs-restock' | 'needs-maintenance' | 'offline'
    accessCodes: string
    accessInstructions: string
    contactName: string
    contactPhone: string
    contactEmail: string
    notes: string
  }>({
    name: '',
    machineId: '',
    location: '',
    locationDetail: '',
    type: 'combo',
    status: 'operational',
    accessCodes: '',
    accessInstructions: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes: ''
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setRecents(recentItems.getRecentItems())
      
      if (machine) {
        setFormData({
          name: machine.name,
          machineId: machine.machineId,
          location: machine.location,
          locationDetail: machine.locationDetail || '',
          type: machine.type,
          status: machine.status,
          accessCodes: machine.accessCodes?.join(', ') || '',
          accessInstructions: machine.accessInstructions || '',
          contactName: machine.contactPerson?.name || '',
          contactPhone: machine.contactPerson?.phone || '',
          contactEmail: machine.contactPerson?.email || '',
          notes: ''
        })
      } else {
        setFormData({
          name: '',
          machineId: '',
          location: '',
          locationDetail: '',
          type: 'combo',
          status: 'operational',
          accessCodes: '',
          accessInstructions: '',
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          notes: ''
        })
      }
      setErrors({})
      setIsSubmitting(false)
    }
  }, [isOpen, machine])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Location name is required'
    }
    
    if (!formData.machineId.trim()) {
      newErrors.machineId = 'Machine ID is required'
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Location/address is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) return
    
    setIsSubmitting(true)
    
    try {
      const machineData = {
        name: formData.name,
        machineId: formData.machineId,
        location: formData.location,
        locationDetail: formData.locationDetail || undefined,
        type: formData.type,
        status: formData.status,
        accessCodes: formData.accessCodes ? formData.accessCodes.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        accessInstructions: formData.accessInstructions || undefined,
        contactPerson: formData.contactName ? {
          name: formData.contactName,
          phone: formData.contactPhone || undefined,
          email: formData.contactEmail || undefined
        } : undefined,
        notes: []
      }
      
      let result: dataService.VendingMachine
      
      if (isEditing && machine) {
        const updated = dataService.updateVendingMachine(machine.id, machineData)
        if (!updated) throw new Error('Failed to update machine')
        result = updated
      } else {
        result = dataService.addVendingMachine(machineData)
      }
      
      // Save to recent items
      recentItems.addRecentVendingMachine({
        location: formData.location,
        type: formData.type
      })
      
      onSubmit(result)
      onClose()
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'An error occurred' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Vending Machine' : 'Add Vending Machine'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Location Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Building className="h-4 w-4" />
            Location Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Location Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Name <span className="text-red-500">*</span>
              </label>
              <AutocompleteInput
                value={formData.name}
                onChange={(value) => handleChange('name', value)}
                recentItems={recents.machineLocations}
                placeholder="e.g., Building A Lobby"
                icon={<Building className="h-4 w-4" />}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Machine ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Machine ID / Serial <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.machineId}
                onChange={(e) => handleChange('machineId', e.target.value)}
                placeholder="e.g., VM-001 or serial number"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                  errors.machineId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.machineId && <p className="mt-1 text-sm text-red-600">{errors.machineId}</p>}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address / Building <span className="text-red-500">*</span>
              </label>
              <AutocompleteInput
                value={formData.location}
                onChange={(value) => handleChange('location', value)}
                recentItems={recents.addresses}
                placeholder="Full address or building name"
                icon={<MapPin className="h-4 w-4" />}
              />
              {errors.location && <p className="mt-1 text-sm text-red-600">{errors.location}</p>}
            </div>

            {/* Location Detail */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Detail
              </label>
              <input
                type="text"
                value={formData.locationDetail}
                onChange={(e) => handleChange('locationDetail', e.target.value)}
                placeholder="e.g., Near main entrance, 2nd floor"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Machine Type */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Machine Type
          </h4>
          
          <div className="grid grid-cols-3 gap-3">
            {MACHINE_TYPES.map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleChange('type', type.value)}
                className={`p-4 rounded-lg border-2 text-center transition ${
                  formData.type === type.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">{type.icon}</div>
                <div className={`text-sm font-medium ${
                  formData.type === type.value ? 'text-primary-700' : 'text-gray-700'
                }`}>
                  {type.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Current Status
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            {STATUS_OPTIONS.map(status => {
              const Icon = status.icon
              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => handleChange('status', status.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition ${
                    formData.status === status.value
                      ? `${status.color} border-current`
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{status.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Access Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Access Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Access Codes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Codes
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.accessCodes}
                  onChange={(e) => handleChange('accessCodes', e.target.value)}
                  placeholder="Code 1, Code 2..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Separate multiple codes with commas</p>
            </div>

            {/* Access Instructions */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Instructions
              </label>
              <textarea
                value={formData.accessInstructions}
                onChange={(e) => handleChange('accessInstructions', e.target.value)}
                placeholder="How to access the machine (keys, codes, etc.)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <User className="h-4 w-4" />
            Site Contact
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Contact Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => handleChange('contactName', e.target.value)}
                  placeholder="e.g., John Doe"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  placeholder="contact@site.com"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notes
          </h4>
          
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Additional notes about this machine..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
          />
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isEditing ? 'Saving...' : 'Adding...'}
              </>
            ) : (
              isEditing ? 'Save Changes' : 'Add Machine'
            )}
          </button>
        </div>
      </form>
    </FormModal>
  )
}
