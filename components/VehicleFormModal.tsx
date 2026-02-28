import { useState, useEffect } from 'react'
import { Truck, User, MapPin, Gauge, Calendar, FileText, Fuel } from 'lucide-react'
import FormModal from './FormModal'
import * as dataService from '../services/dataService'

interface VehicleFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (vehicle: dataService.Vehicle) => void
  vehicle?: dataService.Vehicle | null
}

const VEHICLE_TYPES = [
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
  { value: 'box-truck', label: 'Box Truck' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'refrigerated', label: 'Refrigerated' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'other', label: 'Other' }
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'text-green-600 bg-green-50' },
  { value: 'inactive', label: 'Inactive', color: 'text-gray-600 bg-gray-50' },
  { value: 'delayed', label: 'Delayed', color: 'text-orange-600 bg-orange-50' }
]

export default function VehicleFormModal({ isOpen, onClose, onSubmit, vehicle }: VehicleFormModalProps) {
  const isEditing = !!vehicle
  
  const [formData, setFormData] = useState<{
    name: string
    vehicleType: string
    licensePlate: string
    year: number
    driver: string
    location: string
    mileage: number
    fuelLevel: number
    status: 'active' | 'inactive' | 'delayed'
    maintenanceDue: boolean
    lastService: string
    nextService: string
    notes: string
  }>({
    name: '',
    vehicleType: 'van',
    licensePlate: '',
    year: new Date().getFullYear(),
    driver: '',
    location: '',
    mileage: 0,
    fuelLevel: 100,
    status: 'active',
    maintenanceDue: false,
    lastService: '',
    nextService: '',
    notes: ''
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens/closes or vehicle changes
  useEffect(() => {
    if (isOpen) {
      if (vehicle) {
        setFormData({
          name: vehicle.name || '',
          vehicleType: vehicle.vehicleType || 'van',
          licensePlate: vehicle.licensePlate || '',
          year: vehicle.year || new Date().getFullYear(),
          driver: vehicle.driver || '',
          location: vehicle.location || '',
          mileage: vehicle.mileage || 0,
          fuelLevel: vehicle.fuelLevel || 100,
          status: vehicle.status || 'active',
          maintenanceDue: vehicle.maintenanceDue || false,
          lastService: vehicle.lastService || '',
          nextService: vehicle.nextService || '',
          notes: ''
        })
      } else {
        setFormData({
          name: '',
          vehicleType: 'van',
          licensePlate: '',
          year: new Date().getFullYear(),
          driver: '',
          location: '',
          mileage: 0,
          fuelLevel: 100,
          status: 'active',
          maintenanceDue: false,
          lastService: '',
          nextService: '',
          notes: ''
        })
      }
      setErrors({})
      setIsSubmitting(false)
    }
  }, [isOpen, vehicle])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Vehicle name is required'
    }
    
    if (formData.mileage < 0) {
      newErrors.mileage = 'Mileage cannot be negative'
    }
    
    if (formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
      newErrors.year = 'Please enter a valid year'
    }
    
    if (formData.fuelLevel < 0 || formData.fuelLevel > 100) {
      newErrors.fuelLevel = 'Fuel level must be between 0 and 100'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) return
    
    setIsSubmitting(true)
    
    try {
      let result: dataService.Vehicle
      
      if (isEditing && vehicle) {
        const updated = dataService.updateVehicle(vehicle.id, {
          ...formData,
          eta: vehicle.eta || 'N/A'
        })
        if (!updated) throw new Error('Failed to update vehicle')
        result = updated
      } else {
        result = dataService.addVehicle({
          ...formData,
          eta: 'N/A'
        })
      }
      
      onSubmit(result)
      onClose()
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'An error occurred' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Basic Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vehicle Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Delivery Van 1"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Type
              </label>
              <select
                value={formData.vehicleType}
                onChange={(e) => handleChange('vehicleType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              >
                {VEHICLE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* License Plate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                License Plate
              </label>
              <input
                type="text"
                value={formData.licensePlate}
                onChange={(e) => handleChange('licensePlate', e.target.value.toUpperCase())}
                placeholder="ABC-1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              />
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => handleChange('year', parseInt(e.target.value) || 0)}
                min="1900"
                max={new Date().getFullYear() + 1}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                  errors.year ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.year && <p className="mt-1 text-sm text-red-600">{errors.year}</p>}
            </div>
          </div>
        </div>

        {/* Assignment & Location */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <User className="h-4 w-4" />
            Assignment & Location
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Driver */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Driver
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.driver}
                  onChange={(e) => handleChange('driver', e.target.value)}
                  placeholder="e.g., John Smith"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="e.g., Depot, Main Warehouse"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map(status => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => handleChange('status', status.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition ${
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
          </div>
        </div>

        {/* Vehicle Metrics */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Vehicle Metrics
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Mileage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mileage
              </label>
              <div className="relative">
                <Gauge className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  value={formData.mileage}
                  onChange={(e) => handleChange('mileage', parseInt(e.target.value) || 0)}
                  min="0"
                  placeholder="0"
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                    errors.mileage ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.mileage && <p className="mt-1 text-sm text-red-600">{errors.mileage}</p>}
            </div>

            {/* Fuel Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fuel Level (%)
              </label>
              <div className="relative">
                <Fuel className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  value={formData.fuelLevel}
                  onChange={(e) => handleChange('fuelLevel', parseInt(e.target.value) || 0)}
                  min="0"
                  max="100"
                  placeholder="100"
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                    errors.fuelLevel ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.fuelLevel && <p className="mt-1 text-sm text-red-600">{errors.fuelLevel}</p>}
            </div>

            {/* Maintenance Due */}
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.maintenanceDue}
                  onChange={(e) => handleChange('maintenanceDue', e.target.checked)}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Maintenance Due
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Service Dates */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Service History
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Last Service */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Service Date
              </label>
              <input
                type="date"
                value={formData.lastService}
                onChange={(e) => handleChange('lastService', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              />
            </div>

            {/* Next Service */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Service Due
              </label>
              <input
                type="date"
                value={formData.nextService}
                onChange={(e) => handleChange('nextService', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              />
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
            placeholder="Additional notes about the vehicle..."
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
              isEditing ? 'Save Changes' : 'Add Vehicle'
            )}
          </button>
        </div>
      </form>
    </FormModal>
  )
}
