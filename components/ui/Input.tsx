/**
 * Input Component
 * 
 * A comprehensive form input system supporting multiple types, states,
 * and icon placements. Includes label and error message handling.
 * 
 * @example
 * ```tsx
 * <Input
 *   type="email"
 *   label="Email Address"
 *   placeholder="user@example.com"
 *   iconLeft={<Mail size={18} />}
 *   error="Please enter a valid email"
 * />
 * ```
 */

import React from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

/**
 * Supported input types
 */
type InputType = 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url' | 'date';

/**
 * Input size variants
 */
const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-5 py-3 text-lg',
} as const;

/**
 * Icon size mapping based on input size
 */
const iconSizes = {
  sm: 14,
  md: 18,
  lg: 22,
} as const;

/**
 * Input component props
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input type */
  type?: InputType;
  /** Label text */
  label?: string;
  /** Helper text displayed below input */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Icon to display on the left (alias: leftIcon for backward compatibility) */
  iconLeft?: React.ReactNode;
  /** Icon to display on the right (alias: rightIcon for backward compatibility) */
  iconRight?: React.ReactNode;
  /** @deprecated Use iconLeft instead */
  leftIcon?: React.ReactNode;
  /** @deprecated Use iconRight instead */
  rightIcon?: React.ReactNode;
  /** Input size */
  size?: keyof typeof sizeStyles;
  /** Full width input */
  fullWidth?: boolean;
  /** Reference to the input element */
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * Input component for form fields
 * 
 * @param props - Input props
 * @returns React component
 */
export const Input = React.forwardRef<HTMLDivElement, InputProps>(
  ({ 
    type = 'text',
    label,
    helperText,
    error,
    iconLeft,
    iconRight,
    leftIcon,
    rightIcon,
    size = 'md',
    fullWidth = false,
    disabled = false,
    required = false,
    className = '',
    inputRef,
    id,
    ...props 
  }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const inputId = id || React.useId();
    const hasError = !!error;
    const isPassword = type === 'password';
    // Support both iconLeft/leftIcon for backward compatibility
    const leftIconToUse = iconLeft ?? leftIcon;
    const rightIconToUse = iconRight ?? rightIcon;
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    const handleTogglePassword = () => setShowPassword(!showPassword);

    return (
      <div ref={ref} className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {label}
            {required && (
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}
        
        <div className="relative">
          {leftIconToUse && (
            <div 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              aria-hidden="true"
            >
              {leftIconToUse}
            </div>
          )}
          
          <input
            ref={inputRef}
            id={inputId}
            type={inputType}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            className={`
              block rounded-lg border bg-white
              transition-colors duration-200
              placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
              ${sizeStyles[size]}
              ${leftIconToUse ? 'pl-10' : ''}
              ${rightIconToUse || isPassword ? 'pr-10' : ''}
              ${fullWidth ? 'w-full' : ''}
              ${hasError 
                ? 'border-red-300 text-red-900 placeholder:text-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-500'
              }
            `}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={handleTogglePassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff size={iconSizes[size]} />
              ) : (
                <Eye size={iconSizes[size]} />
              )}
            </button>
          )}
          
          {rightIconToUse && !isPassword && (
            <div 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              aria-hidden="true"
            >
              {rightIconToUse}
            </div>
          )}
        </div>

        {helperText && !hasError && (
          <p 
            id={`${inputId}-helper`}
            className="mt-1.5 text-sm text-slate-500"
          >
            {helperText}
          </p>
        )}
        
        {hasError && (
          <p 
            id={`${inputId}-error`}
            className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
            role="alert"
          >
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Textarea component props
 */
export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label text */
  label?: string;
  /** Helper text displayed below textarea */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Input size */
  size?: keyof typeof sizeStyles;
  /** Full width textarea */
  fullWidth?: boolean;
  /** Number of rows */
  rows?: number;
}

/**
 * Textarea component for multi-line text input
 * 
 * @param props - TextArea props
 * @returns React component
 */
export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ 
    label,
    helperText,
    error,
    size = 'md',
    fullWidth = false,
    disabled = false,
    required = false,
    rows = 4,
    className = '',
    id,
    ...props 
  }, ref) => {
    const textareaId = id || React.useId();
    const hasError = !!error;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label 
            htmlFor={textareaId}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {label}
            {required && (
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
          className={`
            block rounded-lg border bg-white
            transition-colors duration-200
            placeholder:text-slate-400 resize-y min-h-[80px]
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            ${sizeStyles[size]}
            ${fullWidth ? 'w-full' : ''}
            ${hasError 
              ? 'border-red-300 text-red-900 placeholder:text-red-300 focus:border-red-500 focus:ring-red-500' 
              : 'border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-500'
            }
          `}
          {...props}
        />

        {helperText && !hasError && (
          <p 
            id={`${textareaId}-helper`}
            className="mt-1.5 text-sm text-slate-500"
          >
            {helperText}
          </p>
        )}
        
        {hasError && (
          <p 
            id={`${textareaId}-error`}
            className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
            role="alert"
          >
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

// Alias for backward compatibility
export const Textarea = TextArea;

/**
 * Select component props (for backward compatibility)
 */
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Label text */
  label?: string;
  /** Helper text displayed below select */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Select size */
  size?: keyof typeof sizeStyles;
  /** Full width select */
  fullWidth?: boolean;
  /** Options for the select */
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
}

/**
 * Select component for dropdown selection (backward compatible)
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ 
    label,
    helperText,
    error,
    size = 'md',
    fullWidth = false,
    disabled = false,
    required = false,
    options,
    children,
    className = '',
    id,
    ...props 
  }, ref) => {
    const selectId = id || React.useId();
    const hasError = !!error;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label 
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {label}
            {required && (
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}
        
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          className={`
            block rounded-lg border bg-white
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            ${sizeStyles[size]}
            ${fullWidth ? 'w-full' : ''}
            ${hasError 
              ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500' 
              : 'border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-500'
            }
          `}
          {...props}
        >
          {options ? options.map(opt => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          )) : children}
        </select>

        {helperText && !hasError && (
          <p 
            id={`${selectId}-helper`}
            className="mt-1.5 text-sm text-slate-500"
          >
            {helperText}
          </p>
        )}
        
        {hasError && (
          <p 
            id={`${selectId}-error`}
            className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
            role="alert"
          >
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Input;
