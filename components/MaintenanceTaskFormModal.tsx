import { useState, useEffect } from 'react'
import { Wrench, Calendar, AlertTriangle, FileText, Truck, Clock } from 'lucide-react'
import FormModal from './FormModal'
import AutocompleteInput from './AutocompleteInput'
import * as dataService from '../services/dataServiceWithSync'
import * as recentItems from '../services/recentItems'

interface MaintenanceTaskFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (task: dataService.MaintenanceTask) => void
  task?: dataService.MaintenanceTask | null
  vehicles?: dataService.Vehicle[]
}

const MAINTENANCE_TYPES = [
  'Oil Change',
  'Brake Inspection',
  'Tire Rotation',
  'Air Filter Replacement',
  'Battery Check',
  'Transmission Service',
  'Coolant Flush',
  'Spark Plug Replacement',
  'Belt Inspection',
  'Fluid Check',
  'Safety Inspection',
  'General Maintenance'
]

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', color: 'text-red-600 bg-red-100 border-red-200', desc: 'Urgent - Immediate attention required' },
  { value: 'medium', label: 'Medium', color: 'text-orange-600 bg-orange-100 border-orange-200', desc: 'Normal - Schedule soon' },
  { value: 'low', label: 'Low', color: 'text-green-600 bg-green-100 border-green-200', desc: 'Routine - Can wait' }
] as const

export default function MaintenanceTaskFormModal({
  isOpen,
  onClose,
  onSubmit,
  task,
  vehicles = []
}: MaintenanceTaskFormModalProps) {
  const isEditing = !!task
  const [recents, setRecents] = useState<recentItems.RecentItems>(recentItems.getRecentItems())
  
  const [formData, setFormData] = useState<{
    vehicle: string
    type: string
    dueDate: string
    priority: 'high' | 'medium' | 'low'
    notes: string
    estimatedDuration: string
    partsNeeded: string
    serviceProvider: string
    costEstimate: string
  }>({
    vehicle: '',
    type: '',
    dueDate: '',
    priority: 'medium',
    notes: '',
    estimatedDuration: '',
    partsNeeded: '',
    serviceProvider: '',
    costEstimate: ''
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setRecents(recentItems.getRecentItems())
      
      if (task) {
        setFormData({
          vehicle: task.vehicle,
          type: task.type,
          dueDate: task.dueDate,
          priority: task.priority,
          notes: task.notes || '',
          estimatedDuration: task.estimatedDuration || '',
          partsNeeded: task.partsNeeded?.join(', ') || '',
          serviceProvider: task.serviceProvider || '',
          costEstimate: task.costEstimate?.toString() || ''
        })
      } else {
        // Default due date is 7 days from now
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        
        setFormData({
          vehicle: '',
          type: '',
          dueDate: nextWeek.toISOString().split('T')[0],
          priority: 'medium',
          notes: '',
          estimatedDuration: '',
          partsNeeded: '',
          serviceProvider: '',
          costEstimate: ''
        })
      }
      setErrors({})
      setIsSubmitting(false)
    }
  }, [isOpen, task])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.vehicle.trim()) {
      newErrors.vehicle = 'Vehicle name is required'
    }
    
    if (!formData.type.trim()) {
      newErrors.type = 'Maintenance type is required'
    }
    
    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required'
    }
    
    if (formData.costEstimate && isNaN(parseFloat(formData.costEstimate))) {
      newErrors.costEstimate = 'Please enter a valid amount'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) return
    
    setIsSubmitting(true)
    
    try {
      const taskData = {
        vehicle: formData.vehicle,
        type: formData.type,
        dueDate: formData.dueDate,
        priority: formData.priority,
        notes: formData.notes,
        estimatedDuration: formData.estimatedDuration,
        partsNeeded: formData.partsNeeded ? formData.partsNeeded.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        serviceProvider: formData.serviceProvider,
        costEstimate: formData.costEstimate ? parseFloat(formData.costEstimate) : undefined
      }
      
      let result: dataService.MaintenanceTask
      
      if (isEditing && task) {
        const updated = dataService.updateMaintenanceTask(task.id, taskData)
        if (!updated) throw new Error('Failed to update task')
        result = updated
      } else {
        result = dataService.addMaintenanceTask(taskData)
      }
      
      // Save to recent items
      recentItems.addRecentMaintenance({ vehicle: formData.vehicle, type: formData.type })
      
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

  // Get vehicle names from both recent items and existing vehicles
  const vehicleSuggestions = vehicles.map(v => v.name)

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Maintenance Task' : 'Add Maintenance Task'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Vehicle Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vehicle Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Name <span className="text-red-500">*</span>
              </label>
              <AutocompleteInput
                value={formData.vehicle}
                onChange={(value) => handleChange('vehicle', value)}
                recentItems={recents.vehicleNames}
                suggestions={vehicleSuggestions}
                placeholder="e.g., Van 1, Truck A"
                icon={<Truck className="h-4 w-4" />}
              />
              {errors.vehicle && <p className="mt-1 text-sm text-red-600">{errors.vehicle}</p>}
            </div>

            {/* Maintenance Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maintenance Type <span className="text-red-500">*</span>
              </label>
              <AutocompleteInput
                value={formData.type}
                onChange={(value) => handleChange('type', value)}
                recentItems={recents.maintenanceTypes}
                suggestions={MAINTENANCE_TYPES}
                placeholder="e.g., Oil Change, Brake Inspection"
                icon={<Wrench className="h-4 w-4" />}
              />
              {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type}</p>}
            </div>
          </div>
        </div>

        {/* Scheduling */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Scheduling
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleChange('dueDate', e.target.value)}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                    errors.dueDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.dueDate && <p className="mt-1 text-sm text-red-600">{errors.dueDate}</p>}
            </div>

            {/* Estimated Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Duration
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.estimatedDuration}
                  onChange={(e) => handleChange('estimatedDuration', e.target.value)}
                  placeholder="e.g., 2 hours, 30 minutes"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Priority Level
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PRIORITY_OPTIONS.map(priority => (
              <button
                key={priority.value}
                type="button"
                onClick={() => handleChange('priority', priority.value)}
                className={`p-4 rounded-lg border-2 text-left transition ${
                  formData.priority === priority.value
                    ? `${priority.color} border-current`
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">{priority.label}</div>
                <div className="text-xs mt-1 opacity-80">{priority.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Service Provider & Cost */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Service Details
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Service Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Provider
              </label>
              <input
                type="text"
                value={formData.serviceProvider}
                onChange={(e) => handleChange('serviceProvider', e.target.value)}
                placeholder="e.g., Quick Lube Center"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              />
            </div>

            {/* Cost Estimate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost Estimate ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={formData.costEstimate}
                  onChange={(e) => handleChange('costEstimate', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                    errors.costEstimate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.costEstimate && <p className="mt-1 text-sm text-red-600">{errors.costEstimate}</p>}
            </div>

            {/* Parts Needed */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parts Needed
              </label>
              <input
                type="text"
                value={formData.partsNeeded}
                onChange={(e) => handleChange('partsNeeded', e.target.value)}
                placeholder="e.g., Oil filter, Brake pads, Wiper blades (comma separated)"
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
            placeholder="Additional notes about this maintenance task..."
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
              isEditing ? 'Save Changes' : 'Add Task'
            )}
          </button>
        </div>
      </form>
    </FormModal>
  )
}
