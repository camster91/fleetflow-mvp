/**
 * Modal Component
 * 
 * A comprehensive dialog system with various sizes, backdrop blur,
 * and animation support. Includes header, content, and footer sections.
 * 
 * @example
 * ```tsx
 * <Modal isOpen={isOpen} onClose={handleClose} title="Confirm Action" size="md">
 *   <p>Are you sure you want to proceed?</p>
 *   <ModalFooter>
 *     <Button variant="ghost" onClick={handleClose}>Cancel</Button>
 *     <Button onClick={handleConfirm}>Confirm</Button>
 *   </ModalFooter>
 * </Modal>
 * ```
 */

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

/**
 * Modal size variants
 */
const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-full mx-4',
} as const;

/**
 * Modal position variants
 */
const positionStyles = {
  center: 'items-center',
  top: 'items-start pt-16',
  bottom: 'items-end pb-16',
} as const;

/**
 * Modal component props
 */
export interface ModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title displayed in header */
  title?: React.ReactNode;
  /** Modal description/subtitle */
  description?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Modal size */
  size?: keyof typeof sizeStyles;
  /** Modal position on screen */
  position?: keyof typeof positionStyles;
  /** Whether to show close button in header */
  showCloseButton?: boolean;
  /** Whether to close on backdrop click */
  closeOnBackdropClick?: boolean;
  /** Whether to close on Escape key */
  closeOnEsc?: boolean;
  /** Whether to prevent body scroll when modal is open */
  preventBodyScroll?: boolean;
  /** Custom header content (overrides title/description) */
  header?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Additional class for the modal panel */
  className?: string;
  /** Additional class for the backdrop */
  backdropClassName?: string;
}

/**
 * Modal component for dialogs and overlays
 * 
 * @param props - Modal props
 * @returns React component
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  position = 'center',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  preventBodyScroll = true,
  header,
  footer,
  className = '',
  backdropClassName = '',
}) => {
  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEsc) {
      onClose();
    }
  }, [closeOnEsc, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      
      if (preventBodyScroll) {
        document.body.style.overflow = 'hidden';
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (preventBodyScroll) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen, handleKeyDown, preventBodyScroll]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnBackdropClick) {
      onClose();
    }
  };

  // Prevent scroll on modal content
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  const hasHeader = header || title || description;

  return (
    <div 
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Backdrop */}
      <div 
        className={`
          fixed inset-0 bg-slate-900/50 backdrop-blur-sm
          transition-opacity duration-300
          ${backdropClassName}
        `}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      
      {/* Modal container */}
      <div 
        className={`
          fixed inset-0 overflow-y-auto
          flex justify-center min-h-full p-4
          ${positionStyles[position]}
        `}
        onClick={handleBackdropClick}
      >
        {/* Modal panel */}
        <div
          className={`
            relative w-full ${sizeStyles[size]}
            bg-white rounded-xl shadow-xl
            transform transition-all duration-300
            animate-in fade-in zoom-in-95
            ${className}
          `}
          onClick={handleModalClick}
        >
          {hasHeader && (
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100">
              {header ? (
                <div className="flex-1">{header}</div>
              ) : (
                <div className="flex-1">
                  {title && (
                    <h3 
                      id="modal-title" 
                      className="text-lg font-semibold text-slate-900"
                    >
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p 
                      id="modal-description" 
                      className="mt-1 text-sm text-slate-500"
                    >
                      {description}
                    </p>
                  )}
                </div>
              )}
              
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="shrink-0 -mr-2"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </Button>
              )}
            </div>
          )}

          <div className="px-6 py-4">
            {children}
          </div>

          {footer && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Modal Footer sub-component
 */
export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end' | 'between';
}

const footerAlignStyles = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const;

export const ModalFooter: React.FC<ModalFooterProps> = ({ 
  children, 
  align = 'end',
  className = '',
  ...props 
}) => (
  <div 
    className={`
      flex items-center gap-3 px-6 py-4 
      border-t border-slate-100 bg-slate-50/50 
      rounded-b-xl -mx-6 -mb-4 mt-4
      ${footerAlignStyles[align]}
      ${className}
    `}
    {...props}
  >
    {children}
  </div>
);

/**
 * Confirm Modal - Pre-configured modal for confirmation dialogs
 */
export interface ConfirmModalProps extends Omit<ModalProps, 'children' | 'footer'> {
  /** Confirmation message */
  message: React.ReactNode;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Whether the confirm action is destructive */
  isDestructive?: boolean;
  /** Loading state for confirm action */
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isDestructive = false,
  isLoading = false,
  size = 'sm',
  ...modalProps
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal
      size={size}
      {...modalProps}
      footer={
        <>
          <Button variant="ghost" onClick={modalProps.onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button 
            variant={isDestructive ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-slate-600">
        {message}
      </div>
    </Modal>
  );
};

export default Modal;
