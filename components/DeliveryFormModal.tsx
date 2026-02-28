import { useState, useEffect } from 'react'
import { Package, MapPin, User, Calendar, Clock, FileText, Phone, Mail, Building, Camera, Navigation } from 'lucide-react'
import FormModal from './FormModal'
import * as dataService from '../services/dataService'
import * as recentItems from '../services/recentItems'
import AutocompleteInput from './AutocompleteInput'

interface DeliveryFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (delivery: dataService.Delivery) => void
  delivery?: dataService.Delivery | null
  clients?: dataService.Client[]
  vehicles?: dataService.Vehicle[]
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'text-yellow-600 bg-yellow-50' },
  { value: 'in-transit', label: 'In Transit', color: 'text-blue-600 bg-blue-50' },
  { value: 'delivered', label: 'Delivered', color: 'text-green-600 bg-green-50' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-red-600 bg-red-50' }
]

export default function DeliveryFormModal({ isOpen, onClose, onSubmit, delivery, clients = [], vehicles = [] }: DeliveryFormModalProps) {
  const isEditing = !!delivery
  const [recents, setRecents] = useState<recentItems.RecentItems>(recentItems.getRecentItems())
  
  const [formData, setFormData] = useState<{
    customer: string
    address: string
    status: 'pending' | 'in-transit' | 'delivered' | 'cancelled'
    driver: string
    items: number
    progress: number
    notes: string
    scheduledTime: string
    estimatedArrival: string
    contactName: string
    contactPhone: string
    contactEmail: string
    parkingInstructions: string
    dropoffInstructions: string
    accessCodes: string
    securityNotes: string
    businessHours: string
  }>({
    customer: '',
    address: '',
    status: 'pending',
    driver: '',
    items: 1,
    progress: 0,
    notes: '',
    scheduledTime: '',
    estimatedArrival: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    parkingInstructions: '',
    dropoffInstructions: '',
    accessCodes: '',
    securityNotes: '',
    businessHours: ''
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedClient, setSelectedClient] = useState<dataService.Client | null>(null)

  // Reset form when modal opens/closes or delivery changes
  useEffect(() => {
    if (isOpen) {
      if (delivery) {
        setFormData({
          customer: delivery.customer || '',
          address: delivery.address || '',
          status: delivery.status || 'pending',
          driver: delivery.driver || '',
          items: delivery.items || 1,
          progress: delivery.progress || 0,
          notes: delivery.notes || '',
          scheduledTime: delivery.scheduledTime || '',
          estimatedArrival: delivery.estimatedArrival || '',
          contactName: delivery.contactPerson?.name || '',
          contactPhone: delivery.contactPerson?.phone || '',
          contactEmail: delivery.contactPerson?.email || '',
          parkingInstructions: delivery.parkingInstructions || '',
          dropoffInstructions: delivery.dropoffInstructions || '',
          accessCodes: delivery.accessCodes?.join(', ') || '',
          securityNotes: delivery.securityNotes || '',
          businessHours: delivery.businessHours || ''
        })
      } else {
        setFormData({
          customer: '',
          address: '',
          status: 'pending',
          driver: '',
          items: 1,
          progress: 0,
          notes: '',
          scheduledTime: '',
          estimatedArrival: '',
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          parkingInstructions: '',
          dropoffInstructions: '',
          accessCodes: '',
          securityNotes: '',
          businessHours: ''
        })
      }
      setErrors({})
      setIsSubmitting(false)
      setSelectedClient(null)
    }
  }, [isOpen, delivery])

  const handleClientSelect = (clientId: string) => {
    if (!clientId) {
      setSelectedClient(null)
      return
    }
    
    const client = clients.find(c => c.id.toString() === clientId)
    if (client) {
      setSelectedClient(client)
      setFormData(prev => ({
        ...prev,
        customer: client.businessName || client.name,
        address: client.address,
        contactName: client.contactPerson?.name || '',
        contactPhone: client.phone || '',
        contactEmail: client.email || '',
        parkingInstructions: client.parkingInstructions || '',
        dropoffInstructions: client.dropoffInstructions || '',
        accessCodes: client.accessCodes?.join(', ') || '',
        securityNotes: client.securityNotes || '',
        businessHours: client.businessHours || ''
      }))
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.customer.trim()) {
      newErrors.customer = 'Customer name is required'
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Delivery address is required'
    }
    
    if (formData.items < 1) {
      newErrors.items = 'Must have at least 1 item'
    }
    
    if (formData.progress < 0 || formData.progress > 100) {
      newErrors.progress = 'Progress must be between 0 and 100'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) return
    
    setIsSubmitting(true)
    
    try {
      const deliveryData = {
        customer: formData.customer,
        address: formData.address,
        status: formData.status,
        driver: formData.driver,
        items: formData.items,
        progress: formData.progress,
        notes: formData.notes,
        scheduledTime: formData.scheduledTime,
        estimatedArrival: formData.estimatedArrival,
        contactPerson: formData.contactName ? {
          name: formData.contactName,
          phone: formData.contactPhone,
          email: formData.contactEmail
        } : undefined,
        parkingInstructions: formData.parkingInstructions,
        dropoffInstructions: formData.dropoffInstructions,
        accessCodes: formData.accessCodes ? formData.accessCodes.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        securityNotes: formData.securityNotes,
        businessHours: formData.businessHours
      }
      
      let result: dataService.Delivery
      
      if (isEditing && delivery) {
        const updated = dataService.updateDelivery(delivery.id, deliveryData)
        if (!updated) throw new Error('Failed to update delivery')
        result = updated
      } else {
        result = dataService.addDelivery(deliveryData)
      }
      
      // Save to recent items for autofill
      recentItems.addRecentDelivery({
        customer: formData.customer,
        address: formData.address,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail
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

  const handleProgressChange = (value: number) => {
    setFormData(prev => ({ ...prev, progress: value }))
    // Auto-update status based on progress
    if (value === 0 && formData.status !== 'pending') {
      setFormData(prev => ({ ...prev, progress: value, status: 'pending' }))
    } else if (value > 0 && value < 100 && formData.status !== 'in-transit') {
      setFormData(prev => ({ ...prev, progress: value, status: 'in-transit' }))
    } else if (value === 100 && formData.status !== 'delivered') {
      setFormData(prev => ({ ...prev, progress: value, status: 'delivered' }))
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Delivery' : 'Add New Delivery'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Selection (for new deliveries) */}
        {!isEditing && clients.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-primary-600 uppercase tracking-wider flex items-center gap-2">
              <Building className="h-4 w-4" />
              Quick Fill from Client
            </h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Existing Client (Optional)
              </label>
              <select
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              >
                <option value="">-- Select a client --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.businessName || client.name} - {client.address}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Selecting a client will auto-fill their information
              </p>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Package className="h-4 w-4" />
            Basic Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <AutocompleteInput
                value={formData.customer}
                onChange={(value) => handleChange('customer', value)}
                recentItems={recents.customerNames}
                placeholder="e.g., Acme Corporation"
                icon={<Building className="h-4 w-4" />}
              />
              {errors.customer && <p className="mt-1 text-sm text-red-600">{errors.customer}</p>}
            </div>

            {/* Number of Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Items <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  value={formData.items}
                  onChange={(e) => handleChange('items', parseInt(e.target.value) || 1)}
                  min="1"
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                    errors.items ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.items && <p className="mt-1 text-sm text-red-600">{errors.items}</p>}
            </div>

            {/* Delivery Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Address <span className="text-red-500">*</span>
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
          </div>
        </div>

        {/* Assignment & Scheduling */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <User className="h-4 w-4" />
            Assignment & Scheduling
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Driver */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Driver
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={formData.driver}
                  onChange={(e) => handleChange('driver', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition appearance-none bg-white"
                >
                  <option value="">Unassigned</option>
                  {vehicles.filter(v => v.driver && v.driver !== 'Unassigned').map(vehicle => (
                    <option key={vehicle.id} value={vehicle.driver}>
                      {vehicle.driver} ({vehicle.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Status
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(status => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => handleChange('status', status.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition ${
                      formData.status === status.value
                        ? `${status.color} border-current`
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scheduled Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Date/Time
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="datetime-local"
                  value={formData.scheduledTime}
                  onChange={(e) => handleChange('scheduledTime', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>

            {/* Estimated Arrival */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Arrival
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="datetime-local"
                  value={formData.estimatedArrival}
                  onChange={(e) => handleChange('estimatedArrival', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Delivery Progress
          </h4>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Progress: {formData.progress}%
              </label>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                formData.progress === 0 ? 'bg-yellow-100 text-yellow-700' :
                formData.progress === 100 ? 'bg-green-100 text-green-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {formData.progress === 0 ? 'Not Started' :
                 formData.progress === 100 ? 'Complete' :
                 'In Progress'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.progress}
              onChange={(e) => handleProgressChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            {errors.progress && <p className="mt-1 text-sm text-red-600">{errors.progress}</p>}
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Contact Information
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
                Phone Number
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
                  placeholder="john@example.com"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Instructions */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Delivery Instructions
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Parking Instructions */}
            <div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dropoff Instructions
              </label>
              <textarea
                value={formData.dropoffInstructions}
                onChange={(e) => handleChange('dropoffInstructions', e.target.value)}
                placeholder="Specific instructions for delivery"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
              />
            </div>

            {/* Access Codes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Codes
              </label>
              <input
                type="text"
                value={formData.accessCodes}
                onChange={(e) => handleChange('accessCodes', e.target.value)}
                placeholder="Code 1, Code 2, ..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              />
              <p className="mt-1 text-xs text-gray-500">Separate multiple codes with commas</p>
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
                placeholder="e.g., Mon-Fri 9AM-5PM"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              />
            </div>
          </div>

          {/* Security Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Security Notes
            </label>
            <textarea
              value={formData.securityNotes}
              onChange={(e) => handleChange('securityNotes', e.target.value)}
              placeholder="Any security-related information..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Additional Notes
          </h4>
          
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Any additional notes about this delivery..."
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
              isEditing ? 'Save Changes' : 'Add Delivery'
            )}
          </button>
        </div>
      </form>
    </FormModal>
  )
}
