/**
 * Toast Component
 * 
 * Toast notification system with multiple positions, types,
 * auto-dismiss functionality, and progress bar.
 * 
 * @example
 * ```tsx
 * <ToastContainer position="top-right">
 *   <Toast type="success" message="Operation completed!" />
 * </ToastContainer>
 * ```
 * 
 * Or use the hook:
 * ```tsx
 * const toast = useToast();
 * toast.success('Success message');
 * ```
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  X,
  Loader2
} from 'lucide-react';
import { Button } from './Button';

/**
 * Toast type variants
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

/**
 * Toast position options
 */
export type ToastPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right'
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right';

/**
 * Toast data structure
 */
export interface ToastData {
  /** Unique identifier */
  id: string;
  /** Toast type */
  type: ToastType;
  /** Toast message */
  message: string;
  /** Optional title */
  title?: string;
  /** Auto-dismiss duration in ms (null for no auto-dismiss) */
  duration?: number | null;
  /** Whether to show progress bar */
  showProgress?: boolean;
  /** Whether toast can be dismissed */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Action button config */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Toast style configurations
 */
const toastStyles: Record<ToastType, { bg: string; border: string; icon: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  success: {
    bg: 'bg-white',
    border: 'border-emerald-200',
    icon: 'text-emerald-500',
    Icon: CheckCircle,
  },
  error: {
    bg: 'bg-white',
    border: 'border-red-200',
    icon: 'text-red-500',
    Icon: XCircle,
  },
  warning: {
    bg: 'bg-white',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-white',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    Icon: Info,
  },
  loading: {
    bg: 'bg-white',
    border: 'border-slate-200',
    icon: 'text-blue-900',
    Icon: Loader2,
  },
};

/**
 * Toast container position styles
 */
const positionStyles: Record<ToastPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
};

/**
 * Individual Toast component
 */
export interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
  position?: ToastPosition;
}

export const Toast: React.FC<ToastProps> = ({ 
  toast, 
  onDismiss,
  position = 'top-right',
}) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const progressRef = useRef<number>(100);
  const animationRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(Date.now());

  const duration = toast.duration ?? 5000;
  const showProgress = toast.showProgress ?? true;
  const dismissible = toast.dismissible ?? true;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
      toast.onDismiss?.();
    }, 300);
  }, [onDismiss, toast.id, toast.onDismiss]);

  // Auto-dismiss logic with RAF for smooth progress
  useEffect(() => {
    if (toast.type === 'loading' || duration === null) return;
    if (isPaused) return;

    const updateProgress = () => {
      const now = Date.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      progressRef.current = Math.max(0, progressRef.current - (delta / duration) * 100);
      setProgress(progressRef.current);

      if (progressRef.current > 0) {
        animationRef.current = requestAnimationFrame(updateProgress);
      } else {
        handleDismiss();
      }
    };

    lastTimeRef.current = Date.now();
    animationRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [duration, isPaused, toast.type, handleDismiss]);

  const styles = toastStyles[toast.type];
  const Icon = styles.Icon;
  const isVertical = position.startsWith('top');

  // Animation classes based on position
  const enterAnimation = isVertical ? 'animate-slide-in-top' : 'animate-slide-in-bottom';
  const exitAnimation = isVertical ? 'animate-slide-out-top' : 'animate-slide-out-bottom';

  return (
    <div
      className={`
        relative w-full max-w-sm 
        ${styles.bg} 
        border ${styles.border}
        rounded-lg shadow-lg
        overflow-hidden
        pointer-events-auto
        ${isExiting ? exitAnimation : enterAnimation}
      `}
      role="alert"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex gap-3 p-4">
        {/* Icon */}
        <div className={`shrink-0 ${styles.icon}`}>
          <Icon 
            size={20} 
            className={toast.type === 'loading' ? 'animate-spin' : ''}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <h4 className="text-sm font-semibold text-slate-900 mb-0.5">
              {toast.title}
            </h4>
          )}
          <p className="text-sm text-slate-600 leading-relaxed">
            {toast.message}
          </p>
          
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                handleDismiss();
              }}
              className="mt-2 text-sm font-medium text-blue-900 hover:text-blue-800 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Close button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="shrink-0 -mr-1 -mt-1 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && duration !== null && toast.type !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
          <div
            className={`h-full transition-all duration-100 ${
              toast.type === 'success' ? 'bg-emerald-500' :
              toast.type === 'error' ? 'bg-red-500' :
              toast.type === 'warning' ? 'bg-amber-500' :
              'bg-blue-500'
            }`}
            style={{ 
              width: `${progress}%`,
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Toast Container component
 */
export interface ToastContainerProps {
  /** Toast position on screen */
  position?: ToastPosition;
  /** Array of toasts to display */
  toasts: ToastData[];
  /** Callback to dismiss a toast */
  onDismiss: (id: string) => void;
  /** Maximum number of visible toasts */
  maxToasts?: number;
  /** Additional classes */
  className?: string;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  position = 'top-right',
  toasts,
  onDismiss,
  maxToasts = 5,
  className = '',
}) => {
  const visibleToasts = toasts.slice(-maxToasts);
  const isStacked = visibleToasts.length > 1;

  return (
    <div
      className={`
        fixed z-[100] flex flex-col gap-3
        ${positionStyles[position]}
        ${position.includes('center') ? 'items-center' : position.includes('right') ? 'items-end' : 'items-start'}
        ${className}
      `}
      aria-live="polite"
      aria-label="Notifications"
    >
      {visibleToasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            transform: isStacked && index < visibleToasts.length - 1 
              ? `scale(${1 - (visibleToasts.length - 1 - index) * 0.05})` 
              : undefined,
            opacity: isStacked && index < visibleToasts.length - 1 
              ? 1 - (visibleToasts.length - 1 - index) * 0.15 
              : undefined,
          }}
          className="transition-all duration-300"
        >
          <Toast 
            toast={toast} 
            onDismiss={onDismiss}
            position={position}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Toast Context for global toast management
 */
interface ToastContextType {
  /** Show a success toast */
  success: (message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => string;
  /** Show an error toast */
  error: (message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => string;
  /** Show a warning toast */
  warning: (message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => string;
  /** Show an info toast */
  info: (message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => string;
  /** Show a loading toast */
  loading: (message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => string;
  /** Show a custom toast */
  show: (toast: Omit<ToastData, 'id'>) => string;
  /** Dismiss a specific toast */
  dismiss: (id: string) => void;
  /** Dismiss all toasts */
  dismissAll: () => void;
  /** Update an existing toast (e.g., convert loading to success) */
  update: (id: string, updates: Partial<Omit<ToastData, 'id'>>) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

/**
 * Generate unique toast ID
 */
let toastIdCounter = 0;
function generateToastId(): string {
  return `toast-${++toastIdCounter}-${Date.now()}`;
}

/**
 * Toast Provider component
 */
export interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
  defaultDuration?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  position = 'top-right',
  maxToasts = 5,
  defaultDuration = 5000,
}) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const show = useCallback((toastData: Omit<ToastData, 'id'>): string => {
    const id = generateToastId();
    const newToast: ToastData = {
      duration: defaultDuration,
      dismissible: true,
      showProgress: true,
      ...toastData,
      id,
    };
    
    setToasts(prev => [...prev, newToast]);
    return id;
  }, [defaultDuration]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const update = useCallback((id: string, updates: Partial<Omit<ToastData, 'id'>>) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const success = useCallback((message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => {
    return show({ type: 'success', message, ...options });
  }, [show]);

  const error = useCallback((message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => {
    return show({ type: 'error', message, ...options });
  }, [show]);

  const warning = useCallback((message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => {
    return show({ type: 'warning', message, ...options });
  }, [show]);

  const info = useCallback((message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => {
    return show({ type: 'info', message, ...options });
  }, [show]);

  const loading = useCallback((message: string, options?: Omit<Partial<ToastData>, 'type' | 'message'>) => {
    return show({ type: 'loading', message, duration: null, ...options });
  }, [show]);

  const value: ToastContextType = {
    success,
    error,
    warning,
    info,
    loading,
    show,
    dismiss,
    dismissAll,
    update,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer
        position={position}
        toasts={toasts}
        onDismiss={dismiss}
        maxToasts={maxToasts}
      />
    </ToastContext.Provider>
  );
};

/**
 * Hook to use toast functionality
 */
export function useToast(): ToastContextType {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Promise toast helper - automatically handles loading/success/error states
 */
export function usePromiseToast() {
  const toast = useToast();

  return useCallback(<T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    },
    options?: {
      duration?: number;
    }
  ): Promise<T> => {
    const id = toast.loading(messages.loading);

    return promise
      .then(data => {
        const successMessage = typeof messages.success === 'function' 
          ? messages.success(data) 
          : messages.success;
        toast.update(id, {
          type: 'success',
          message: successMessage,
          duration: options?.duration ?? 5000,
        });
        return data;
      })
      .catch(err => {
        const errorMessage = typeof messages.error === 'function'
          ? messages.error(err)
          : messages.error;
        toast.update(id, {
          type: 'error',
          message: errorMessage,
          duration: options?.duration ?? 5000,
        });
        throw err;
      });
  }, [toast]);
}

export default Toast;
