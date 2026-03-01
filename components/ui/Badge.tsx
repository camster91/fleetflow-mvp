/**
 * Badge Component
 * 
 * Status badges for indicating state, category, or type.
 * Used throughout FleetFlow for vehicle status, delivery status, etc.
 * 
 * @example
 * ```tsx
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" size="sm">Pending</Badge>
 * ```
 */

import React from 'react';

/**
 * Badge variant styles mapping
 */
const variantStyles = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  danger: 'bg-red-100 text-red-700 border-red-200', // Alias for error (backward compatibility)
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  primary: 'bg-blue-900 text-white border-blue-900',
  secondary: 'bg-blue-500 text-white border-blue-500',
} as const;

/**
 * Badge size styles mapping
 */
const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
} as const;

/**
 * Badge dot variant styles
 */
const dotStyles = {
  default: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  danger: 'bg-red-500', // Alias for error
  info: 'bg-blue-500',
  primary: 'bg-white',
  secondary: 'bg-white',
} as const;

/**
 * Badge component props
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual style variant */
  variant?: keyof typeof variantStyles;
  /** Size of the badge */
  size?: keyof typeof sizeStyles;
  /** Whether to show a dot indicator */
  dot?: boolean;
  /** Optional icon to display before text */
  icon?: React.ReactNode;
  /** Whether the badge is pill-shaped (fully rounded) */
  pill?: boolean;
  /** Badge content */
  children: React.ReactNode;
}

/**
 * Badge component for status indication
 * 
 * @param props - Badge props
 * @returns React component
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ 
    variant = 'default', 
    size = 'md',
    dot = false,
    icon,
    pill = false,
    children,
    className = '',
    ...props 
  }, ref) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center gap-1.5
          font-medium border
          ${sizeStyles[size]}
          ${variantStyles[variant]}
          ${pill ? 'rounded-full' : 'rounded-md'}
          ${className}
        `}
        {...props}
      >
        {dot && (
          <span 
            className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`}
            aria-hidden="true"
          />
        )}
        {icon && (
          <span className="shrink-0" aria-hidden="true">{icon}</span>
        )}
        <span className="truncate">{children}</span>
      </span>
    );
  }
);

Badge.displayName = 'Badge';

/**
 * Status badge with predefined states for common use cases
 */
export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  /** Status value that maps to a variant */
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'failed' | 'warning' | 'info';
}

const statusVariantMap: Record<StatusBadgeProps['status'], keyof typeof variantStyles> = {
  active: 'success',
  inactive: 'default',
  pending: 'warning',
  completed: 'success',
  failed: 'error',
  warning: 'warning',
  info: 'info',
};

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, children, ...props }, ref) => {
    const displayText = children || status.charAt(0).toUpperCase() + status.slice(1);
    
    return (
      <Badge 
        ref={ref}
        variant={statusVariantMap[status]}
        dot
        {...props}
      >
        {displayText}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export default Badge;
