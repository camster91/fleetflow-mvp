import { AlertTriangle, X, CheckCircle, Info } from 'lucide-react'
import FormModal from './FormModal'

type ConfirmVariant = 'danger' | 'warning' | 'info'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  variant?: ConfirmVariant
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
}

const variants: Record<ConfirmVariant, { icon: typeof AlertTriangle; iconColor: string; buttonColor: string; buttonHover: string }> = {
  danger: {
    icon: AlertTriangle,
    iconColor: 'text-red-600 bg-red-100',
    buttonColor: 'bg-red-600',
    buttonHover: 'hover:bg-red-700'
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-orange-600 bg-orange-100',
    buttonColor: 'bg-orange-600',
    buttonHover: 'hover:bg-orange-700'
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-600 bg-blue-100',
    buttonColor: 'bg-blue-600',
    buttonHover: 'hover:bg-blue-700'
  }
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant = 'danger',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false
}: ConfirmModalProps) {
  const style = variants[variant]
  const Icon = style.icon

  const handleConfirm = () => {
    onConfirm()
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="sm"
    >
      <div className="text-center">
        {/* Icon */}
        <div className={`mx-auto w-12 h-12 rounded-full ${style.iconColor} flex items-center justify-center mb-4`}>
          <Icon className="h-6 w-6" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-sm text-gray-600 mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-white ${style.buttonColor} ${style.buttonHover} rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </FormModal>
  )
}
