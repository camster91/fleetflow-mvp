/**
 * Button Component
 * 
 * A comprehensive button system for FleetFlow with multiple variants, sizes,
 * and states. Supports loading states and icons.
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Submit
 * </Button>
 * <Button variant="secondary" loading>
 *   Loading...
 * </Button>
 * ```
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button variant styles mapping
 */
const variantStyles = {
  primary: 'bg-blue-900 text-white hover:bg-blue-800 active:bg-blue-950 focus:ring-blue-500',
  secondary: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 focus:ring-blue-500',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus:ring-slate-400',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 focus:ring-red-500',
  outline: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 focus:ring-slate-400',
} as const;

/**
 * Button size styles mapping
 */
const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2',
} as const;

/**
 * Icon size mapping based on button size
 */
const iconSizes = {
  sm: 14,
  md: 18,
  lg: 22,
} as const;

/**
 * Button props interface
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant of the button */
  variant?: keyof typeof variantStyles;
  /** Size of the button */
  size?: keyof typeof sizeStyles;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Icon to display on the left side of the button */
  iconLeft?: React.ReactNode;
  /** Icon to display on the right side of the button */
  iconRight?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
}

/**
 * Button component for user interactions
 * 
 * @param props - Button props
 * @returns React component
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    loading = false, 
    disabled = false,
    iconLeft,
    iconRight,
    fullWidth = false,
    children, 
    className = '',
    type = 'button',
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={`
          inline-flex items-center justify-center
          font-medium rounded-lg
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <Loader2 
            size={iconSizes[size]} 
            className="animate-spin shrink-0" 
            aria-hidden="true"
          />
        )}
        {!loading && iconLeft && (
          <span className="shrink-0" aria-hidden="true">{iconLeft}</span>
        )}
        <span className="truncate">{children}</span>
        {!loading && iconRight && (
          <span className="shrink-0" aria-hidden="true">{iconRight}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
