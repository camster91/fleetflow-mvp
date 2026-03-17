import { useState, useEffect } from 'react'
import { FileText, Hash, AlignLeft, BookOpen } from 'lucide-react'
import FormModal from './FormModal'
import * as dataService from '../services/dataServiceWithSync'

interface SOPCategoryFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (category: dataService.SOPCategory) => void
  category?: dataService.SOPCategory | null
}

const ICON_OPTIONS = [
  { value: 'FileText', label: 'Document', icon: FileText },
  { value: 'BookOpen', label: 'Manual', icon: BookOpen },
  { value: 'Hash', label: 'List', icon: Hash },
  { value: 'AlignLeft', label: 'Notes', icon: AlignLeft }
]

export default function SOPCategoryFormModal({
  isOpen,
  onClose,
  onSubmit,
  category
}: SOPCategoryFormModalProps) {
  const isEditing = !!category
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    count: 0,
    iconName: 'FileText'
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setFormData({
          name: category.name,
          description: category.description || '',
          count: category.count,
          iconName: 'FileText'
        })
      } else {
        setFormData({
          name: '',
          description: '',
          count: 0,
          iconName: 'FileText'
        })
      }
      setErrors({})
      setIsSubmitting(false)
    }
  }, [isOpen, category])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required'
    }
    
    if (formData.count < 0) {
      newErrors.count = 'Count cannot be negative'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) return
    
    setIsSubmitting(true)
    
    try {
      let result: dataService.SOPCategory
      
      if (isEditing && category) {
        const updated = dataService.updateSOPCategory(category.id, {
          name: formData.name,
          description: formData.description,
          count: formData.count
        })
        if (!updated) throw new Error('Failed to update category')
        result = updated
      } else {
        result = dataService.addSOPCategory({
          name: formData.name,
          description: formData.description,
          count: formData.count
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

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit SOP Category' : 'Add SOP Category'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Safety Procedures"
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <div className="relative">
            <AlignLeft className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of this category..."
              rows={3}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
            />
          </div>
        </div>

        {/* Initial Document Count */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of SOP Documents
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="number"
              value={formData.count}
              onChange={(e) => handleChange('count', parseInt(e.target.value) || 0)}
              min="0"
              placeholder="0"
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
                errors.count ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.count && <p className="mt-1 text-sm text-red-600">{errors.count}</p>}
          <p className="mt-1 text-xs text-gray-500">
            You can add individual SOP documents after creating the category
          </p>
        </div>

        {/* Icon Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category Icon
          </label>
          <div className="grid grid-cols-4 gap-3">
            {ICON_OPTIONS.map(option => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('iconName', option.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition ${
                    formData.iconName === option.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Preview
          </label>
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
            <div className="p-2 bg-primary-100 rounded-lg">
              <FileText className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                {formData.name || 'Category Name'}
              </h4>
              <p className="text-sm text-gray-500">
                {formData.count} SOP{formData.count !== 1 ? 's' : ''}
                {formData.description && ` • ${formData.description.slice(0, 50)}${formData.description.length > 50 ? '...' : ''}`}
              </p>
            </div>
          </div>
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
              isEditing ? 'Save Changes' : 'Add Category'
            )}
          </button>
        </div>
      </form>
    </FormModal>
  )
}
