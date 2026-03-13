import React, { useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

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

const positionStyles = {
  center: 'items-center',
  top: 'items-start pt-16',
  bottom: 'items-end pb-16',
} as const;

/** Detects mobile viewport (<768px). Starts false on server (SSR-safe). */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  size?: keyof typeof sizeStyles;
  position?: keyof typeof positionStyles;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  preventBodyScroll?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  backdropClassName?: string;
}

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
  const isMobile = useIsMobile();
  const touchStartY = useRef<number>(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape' && closeOnEsc) onClose(); },
    [closeOnEsc, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      if (preventBodyScroll) document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (preventBodyScroll) document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown, preventBodyScroll]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnBackdropClick) onClose();
  };
  const handleModalClick = (e: React.MouseEvent) => e.stopPropagation();
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0].clientY - touchStartY.current > 80) onClose();
  };

  if (!isOpen) return null;

  const hasHeader = header || title || description;

  // ─── Mobile: bottom sheet ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm ${backdropClassName}`}
          onClick={closeOnBackdropClick ? onClose : undefined}
          aria-hidden="true"
        />
        {/* Sheet */}
        <div
          className={`fixed inset-x-0 bottom-0 z-10 flex flex-col bg-white rounded-t-2xl shadow-2xl max-h-[92dvh] animate-in slide-in-from-bottom duration-300 ${className}`}
          onClick={handleModalClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="h-1 w-10 rounded-full bg-slate-300" />
          </div>
          {/* Header */}
          {hasHeader && (
            <div className="flex items-start justify-between gap-4 px-5 py-3 border-b border-slate-100 shrink-0">
              {header ? (
                <div className="flex-1">{header}</div>
              ) : (
                <div className="flex-1">
                  {title && (
                    <h3 id="modal-title" className="text-base font-semibold text-slate-900">{title}</h3>
                  )}
                  {description && (
                    <p id="modal-description" className="mt-0.5 text-sm text-slate-500">{description}</p>
                  )}
                </div>
              )}
              {showCloseButton && (
                <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 -mr-1" aria-label="Close">
                  <X size={18} />
                </Button>
              )}
            </div>
          )}
          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
          {/* Footer */}
          {footer && (
            <div
              className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Desktop: centered dialog ────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${backdropClassName}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-0 overflow-y-auto flex justify-center min-h-full p-4 ${positionStyles[position]}`}
        onClick={handleBackdropClick}
      >
        <div
          className={`relative w-full ${sizeStyles[size]} bg-white rounded-xl shadow-xl transform transition-all duration-300 animate-in fade-in zoom-in-95 ${className}`}
          onClick={handleModalClick}
        >
          {hasHeader && (
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100">
              {header ? (
                <div className="flex-1">{header}</div>
              ) : (
                <div className="flex-1">
                  {title && <h3 id="modal-title" className="text-lg font-semibold text-slate-900">{title}</h3>}
                  {description && <p id="modal-description" className="mt-1 text-sm text-slate-500">{description}</p>}
                </div>
              )}
              {showCloseButton && (
                <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 -mr-2" aria-label="Close modal">
                  <X size={18} />
                </Button>
              )}
            </div>
          )}
          <div className="px-6 py-4">{children}</div>
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

// ─── ModalFooter ─────────────────────────────────────────────────────────────

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
    className={`flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl -mx-6 -mb-4 mt-4 ${footerAlignStyles[align]} ${className}`}
    {...props}
  >
    {children}
  </div>
);

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

export interface ConfirmModalProps extends Omit<ModalProps, 'children' | 'footer'> {
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  isDestructive?: boolean;
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
}) => (
  <Modal
    size={size}
    {...modalProps}
    footer={
      <>
        <Button variant="ghost" onClick={modalProps.onClose} disabled={isLoading}>{cancelText}</Button>
        <Button variant={isDestructive ? 'danger' : 'primary'} onClick={onConfirm} loading={isLoading}>{confirmText}</Button>
      </>
    }
  >
    <div className="text-slate-600">{message}</div>
  </Modal>
);

export default Modal;
