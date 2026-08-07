import React, { useEffect, useId } from 'react'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnBackdropClick?: boolean
  closeOnEsc?: boolean
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  header,
  footer,
  children,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEsc = true,
}: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen || !closeOnEsc) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeOnEsc, isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        data-testid="modal-backdrop"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`relative w-full ${sizeClasses[size]} rounded-2xl bg-white shadow-2xl`}>
          {(header || title) && (
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              {header ?? <h2 id={titleId} className="text-xl font-semibold text-slate-900">{title}</h2>}
              {!header && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
          <div className="px-6 py-6">{children}</div>
          {footer && <div className="border-t border-slate-100 px-6 py-4">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
