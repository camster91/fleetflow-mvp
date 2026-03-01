/**
 * Alert Component
 * 
 * Alert and notification banners for displaying important messages.
 * Supports success, warning, error, and info types with icons.
 * 
 * @example
 * ```tsx
 * <Alert type="success">
 *   Vehicle successfully added to the fleet!
 * </Alert>
 * <Alert type="error" dismissible onDismiss={handleDismiss}>
 *   Failed to connect to the server.
 * </Alert>
 * ```
 */

import React from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info, 
  X 
} from 'lucide-react';
import { Button } from './Button';

/**
 * Alert type variants
 */
type AlertType = 'success' | 'warning' | 'error' | 'info';

/**
 * Alert style configurations
 */
const alertStyles: Record<AlertType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    icon: 'text-emerald-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: 'text-amber-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'text-red-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'text-blue-500',
  },
} as const;

/**
 * Alert icons mapping
 */
const alertIcons: Record<AlertType, React.ReactNode> = {
  success: <CheckCircle size={20} aria-hidden="true" />,
  warning: <AlertTriangle size={20} aria-hidden="true" />,
  error: <XCircle size={20} aria-hidden="true" />,
  info: <Info size={20} aria-hidden="true" />,
} as const;

/**
 * Alert component props
 */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Type of alert determining color scheme */
  type?: AlertType;
  /** Alert title */
  title?: string;
  /** Alert message content */
  children: React.ReactNode;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Custom icon (overrides default) */
  icon?: React.ReactNode;
  /** Visual style variant */
  variant?: 'default' | 'outlined' | 'solid';
}

/**
 * Alert component for notifications and messages
 * 
 * @param props - Alert props
 * @returns React component
 */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ 
    type = 'info',
    title,
    children,
    dismissible = false,
    onDismiss,
    icon,
    variant = 'default',
    className = '',
    role = 'alert',
    ...props 
  }, ref) => {
    const [isVisible, setIsVisible] = React.useState(true);
    const styles = alertStyles[type];
    const defaultIcon = alertIcons[type];

    const handleDismiss = () => {
      setIsVisible(false);
      onDismiss?.();
    };

    if (!isVisible) return null;

    const variantClasses = {
      default: `${styles.bg} ${styles.border} ${styles.text}`,
      outlined: `bg-white ${styles.border} ${styles.text}`,
      solid: `${type === 'success' ? 'bg-emerald-500' : type === 'warning' ? 'bg-amber-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white border-transparent`,
    };

    const iconColorClass = variant === 'solid' ? 'text-white' : styles.icon;

    return (
      <div
        ref={ref}
        role={role}
        className={`
          relative rounded-lg border p-4
          transition-all duration-200
          ${variantClasses[variant]}
          ${className}
        `}
        {...props}
      >
        <div className="flex gap-3">
          {/* Icon */}
          {(icon || defaultIcon) && (
            <div className={`shrink-0 mt-0.5 ${iconColorClass}`}>
              {icon || defaultIcon}
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className="text-sm font-semibold mb-1">
                {title}
              </h4>
            )}
            <div className="text-sm leading-relaxed">
              {children}
            </div>
          </div>

          {/* Dismiss button */}
          {dismissible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className={`
                shrink-0 -mr-2 -mt-1 h-8 w-8 p-0
                ${variant === 'solid' ? 'text-white hover:text-white/80 hover:bg-white/10' : 'text-slate-400 hover:text-slate-600'}
              `}
              aria-label="Dismiss alert"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

/**
 * Alert group for stacking multiple alerts
 */
export interface AlertGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Spacing between alerts */
  spacing?: 'tight' | 'normal' | 'loose';
}

const spacingStyles = {
  tight: 'gap-2',
  normal: 'gap-3',
  loose: 'gap-4',
} as const;

export const AlertGroup: React.FC<AlertGroupProps> = ({ 
  children,
  spacing = 'normal',
  className = '',
  ...props 
}) => (
  <div 
    className={`flex flex-col ${spacingStyles[spacing]} ${className}`}
    {...props}
  >
    {children}
  </div>
);

/**
 * Inline alert for form field errors
 */
export interface InlineAlertProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const InlineAlert: React.FC<InlineAlertProps> = ({ 
  children,
  className = '',
  ...props 
}) => (
  <span 
    className={`inline-flex items-center gap-1 text-sm text-red-600 ${className}`}
    role="alert"
    {...props}
  >
    <XCircle size={14} aria-hidden="true" />
    {children}
  </span>
);

export default Alert;
