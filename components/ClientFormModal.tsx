import { useState, useEffect } from 'react'
import { Building, User, MapPin, Phone, Mail, Clock, FileText, Star, Navigation, Camera, Lock } from 'lucide-react'
import FormModal from './FormModal'
import AutocompleteInput from './AutocompleteInput'
import * as dataService from '../services/dataService'
import * as recentItems from '../services/recentItems'

interface ClientFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (client: dataService.Client) => void
  client?: dataService.Client | null
}

const CLIENT_TYPES = [
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { value: 'hotel', label: 'Hotel', icon: '🏨' },
  { value: 'office', label: 'Office', icon: '🏢' },
  { value: 'retail', label: 'Retail', icon: '🛍️' },
  { value: 'warehouse', label: 'Warehouse', icon: '🏭' },
  { value: 'cafe', label: 'Cafe', icon: '☕' },
  { value: 'institution', label: 'Institution', icon: '🏛️' },
  { value: 'other', label: 'Other', icon: '📍' }
] as const

const DELIVERY_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'as-needed', label: 'As Needed' }
] as const

export default function ClientFormModal({ isOpen, onClose, onSubmit, client }: ClientFormModalProps) {
  const isEditing = !!client
  const [recents, setRecents] = useState<recentItems.RecentItems>(recentItems.getRecentItems())
  
  const [formData, setFormData] = useState<{
    name: string
    businessName: string
    type: 'restaurant' | 'hotel' | 'office' | 'retail' | 'warehouse' | 'cafe' | 'institution' | 'other'
    address: string
    phone: string
    email: string
    website: string
    contactName: string
    contactPhone: string
    contactEmail: string
    contactDepartment: string
    contactAvailability: string
    deliveryFrequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'as-needed'
    businessHours: string
    parkingInstructions: string
    dropoffInstructions: string
    accessCodes: string
    securityNotes: string
    specialRequirements: string
    notes: string
    rating: number
  }>({
    name: '',
    businessName: '',
    type: 'restaurant',
    address: '',
    phone: '',
    email: '',
    website: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    contactDepartment: '',
    contactAvailability: '',
    deliveryFrequency: 'as-needed',
    businessHours: '',
    parkingInstructions: '',
    dropoffInstructions: '',
    accessCodes: '',
    securityNotes: '',
    specialRequirements: '',
    notes: '',
    rating: 3
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'delivery'>('basic')

  useEffect(() => {
    if (isOpen) {
      setRecents(recentItems.getRecentItems())
      
      if (client) {
        setFormData({
          name: client.name,
          businessName: client.businessName || '',
          type: client.type,
          address: client.address,
          phone: client.phone || '',
          email: client.email || '',
          website: client.website || '',
          contactName: client.contactPerson?.name || '',
          contactPhone: client.contactPerson?.phone || '',
          contactEmail: client.contactPerson?.email || '',
          contactDepartment: client.contactPerson?.department || '',
          contactAvailability: client.contactPerson?.availability || '',
          deliveryFrequency: client.deliveryFrequency || 'as-needed',
          businessHours: client.businessHours || '',
          parkingInstructions: client.parkingInstructions || '',
          dropoffInstructions: client.dropoffInstructions || '',
          accessCodes: client.accessCodes?.join(', ') || '',
          securityNotes: client.securityNotes || '',
          specialRequirements: client.specialRequirements?.join(', ') || '',
          notes: client.notes || '',
          rating: client.rating || 3
        })
      } else {
        setFormData({
          name: '',
          businessName: '',
          type: 'restaurant',
          address: '',
          phone: '',
          email: '',
          website: '',
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          contactDepartment: '',
          contactAvailability: '',
          deliveryFrequency: 'as-needed',
          businessHours: '',
          parkingInstructions: '',
          dropoffInstructions: '',
          accessCodes: '',
          securityNotes: '',
          specialRequirements: '',
          notes: '',
          rating: 3
        })
      }
      setErrors({})
      setIsSubmitting(false)
      setActiveTab('basic')
    }
  }, [isOpen, client])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Client name is required'
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    }
    
    if (formData.email && !formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) return
    
    setIsSubmitting(true)
    
    try {
      const clientData = {
        name: formData.name,
        businessName: formData.businessName || undefined,
        type: formData.type,
        address: formData.address,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        website: formData.website || undefined,
        contactPerson: formData.contactName ? {
          name: formData.contactName,
          phone: formData.contactPhone || undefined,
          email: formData.contactEmail || undefined,
          department: formData.contactDepartment || undefined,
          availability: formData.contactAvailability || undefined
        } : undefined,
        deliveryFrequency: formData.deliveryFrequency,
        businessHours: formData.businessHours || undefined,
        parkingInstructions: formData.parkingInstructions || undefined,
        dropoffInstructions: formData.dropoffInstructions || undefined,
        accessCodes: formData.accessCodes ? formData.accessCodes.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        securityNotes: formData.securityNotes || undefined,
        specialRequirements: formData.specialRequirements ? formData.specialRequirements.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        notes: formData.notes || undefined,
        rating: formData.rating as 1 | 2 | 3 | 4 | 5
      }
      
      let result: dataService.Client
      
      if (isEditing && client) {
        const updated = dataService.updateClient(client.id, clientData)
        if (!updated) throw new Error('Failed to update client')
        result = updated
      } else {
        result = dataService.addClient(clientData)
      }
      
      // Save to recent items
      recentItems.addRecentClient({
        name: formData.name,
        businessName: formData.businessName,
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

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const tabButtonClass = (tab: string) => `
    px-4 py-2 text-sm font-medium rounded-lg transition
    ${activeTab === tab 
      ? 'bg-primary-100 text-primary-700' 
      : 'text-gray-600 hover:bg-gray-100'
    }
  `

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Client' : 'Add New Client'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={tabButtonClass('basic')}
          >
            <Building className="h-4 w-4 inline mr-2" />
            Basic Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={tabButtonClass('contact')}
          >
            <User className="h-4 w-4 inline mr-2" />
            Contact
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('delivery')}
            className={tabButtonClass('delivery')}
          >
            <Navigation className="h-4 w-4 inline mr-2" />
            Delivery
          </button>
        </div>

        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Business Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name
                </label>
                <AutocompleteInput
                  value={formData.businessName}
                  onChange={(value) => handleChange('businessName', value)}
                  recentItems={recents.clientBusinessNames}
                  placeholder="e.g., Acme Corporation"
                  icon={<Building className="h-4 w-4" />}
                />
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name <span className="text-red-500">*</span>
                </label>
                <AutocompleteInput
                  value={formData.name}
                  onChange={(value) => handleChange('name', value)}
                  recentItems={recents.contactNames}
                  placeholder="Primary contact person"
                  icon={<User className="h-4 w-4" />}
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* Client Type */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CLIENT_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleChange('type', type.value)}
                      className={`p-3 rounded-lg border-2 text-center transition ${
                        formData.type === type.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <div className="text-2xl mb-1">{type.icon}</div>
                      <div className="text-xs font-medium">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <AutocompleteInput
                  value={formData.address}
                  onChange={(value) => handleChange('address', value)}
                  recentItems={recents.addresses}
                  placeholder="Full street address"
                  icon={<MapPin className="h-4 w-4" />}
                />
                {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <AutocompleteInput
                  value={formData.phone}
                  onChange={(value) => handleChange('phone', value)}
                  recentItems={recents.contactPhones}
                  placeholder="(555) 123-4567"
                  icon={<Phone className="h-4 w-4" />}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <AutocompleteInput
                  value={formData.email}
                  onChange={(value) => handleChange('email', value)}
                  recentItems={recents.contactEmails}
                  placeholder="contact@business.com"
                  icon={<Mail className="h-4 w-4" />}
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              {/* Website */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://www.business.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>

              {/* Rating */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleChange('rating', star)}
                      className={`p-2 rounded-lg transition ${
                        formData.rating >= star
                          ? 'text-yellow-500 bg-yellow-50'
                          : 'text-gray-300 hover:text-gray-400'
                      }`}
                    >
                      <Star className={`h-6 w-6 ${formData.rating >= star ? 'fill-current' : ''}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contact Tab */}
        {activeTab === 'contact' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Person */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => handleChange('contactName', e.target.value)}
                  placeholder="Primary contact for deliveries"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>

              {/* Contact Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.contactDepartment}
                  onChange={(e) => handleChange('contactDepartment', e.target.value)}
                  placeholder="e.g., Receiving, Operations"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Direct Phone
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>

              {/* Contact Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Direct Email
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  placeholder="person@business.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>

              {/* Availability */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Best Time to Contact
                </label>
                <input
                  type="text"
                  value={formData.contactAvailability}
                  onChange={(e) => handleChange('contactAvailability', e.target.value)}
                  placeholder="e.g., Mon-Fri 9AM-5PM"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>
          </div>
        )}

        {/* Delivery Tab */}
        {activeTab === 'delivery' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Delivery Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Frequency
                </label>
                <select
                  value={formData.deliveryFrequency}
                  onChange={(e) => handleChange('deliveryFrequency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                >
                  {DELIVERY_FREQUENCIES.map(freq => (
                    <option key={freq.value} value={freq.value}>{freq.label}</option>
                  ))}
                </select>
              </div>

              {/* Business Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Hours
                </label>
                <input
                  type="text"
                  value={formData.businessHours}
                  onChange={(e) => handleChange('businessHours', e.target.value)}
                  placeholder="e.g., Mon-Fri 8AM-6PM"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>

              {/* Parking Instructions */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parking Instructions
                </label>
                <textarea
                  value={formData.parkingInstructions}
                  onChange={(e) => handleChange('parkingInstructions', e.target.value)}
                  placeholder="Where should the driver park?"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
                />
              </div>

              {/* Dropoff Instructions */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dropoff Instructions
                </label>
                <textarea
                  value={formData.dropoffInstructions}
                  onChange={(e) => handleChange('dropoffInstructions', e.target.value)}
                  placeholder="Specific instructions for delivery location"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
                />
              </div>

              {/* Access Codes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Codes
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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

              {/* Security Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Security Notes
                </label>
                <input
                  type="text"
                  value={formData.securityNotes}
                  onChange={(e) => handleChange('securityNotes', e.target.value)}
                  placeholder="Security-related information"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>

              {/* Special Requirements */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Requirements
                </label>
                <input
                  type="text"
                  value={formData.specialRequirements}
                  onChange={(e) => handleChange('specialRequirements', e.target.value)}
                  placeholder="e.g., Liftgate required, Cold storage (comma separated)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>

              {/* General Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Any additional notes about this client..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errors.submit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex gap-2">
            {activeTab !== 'basic' && (
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'contact' ? 'basic' : 'contact')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                ← Back
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
            >
              Cancel
            </button>
            {activeTab !== 'delivery' ? (
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'basic' ? 'contact' : 'delivery')}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
              >
                Next →
              </button>
            ) : (
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
                  isEditing ? 'Save Changes' : 'Add Client'
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </FormModal>
  )
}
