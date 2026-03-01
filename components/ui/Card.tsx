/**
 * Card Component
 * 
 * A flexible card component with header, content, and footer sections.
 * Supports various visual styles including shadows and borders.
 * 
 * @example
 * ```tsx
 * <Card title="Vehicle Details" subtitle="Last updated today">
 *   <p>Content goes here</p>
 *   <CardFooter>
 *     <Button>Action</Button>
 *   </CardFooter>
 * </Card>
 * ```
 */

import React from 'react';

/**
 * Card shadow variants
 */
const shadowStyles = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
} as const;

/**
 * Card border variants
 */
const borderStyles = {
  none: 'border-0',
  default: 'border border-slate-200',
  dashed: 'border-2 border-dashed border-slate-300',
} as const;

/**
 * Card hover effect variants
 */
const hoverStyles = {
  none: '',
  lift: 'transition-transform duration-200 hover:-translate-y-1',
  shadow: 'transition-shadow duration-200 hover:shadow-lg',
  border: 'transition-colors duration-200 hover:border-blue-300',
} as const;

/**
 * Legacy boolean hover support
 */
const legacyHoverClass = 'card-hover cursor-pointer';

/**
 * Main Card component props
 */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Card title displayed in header */
  title?: React.ReactNode;
  /** Subtitle displayed below title */
  subtitle?: React.ReactNode;
  /** Content to display in the header actions area */
  headerAction?: React.ReactNode;
  /** Shadow depth */
  shadow?: keyof typeof shadowStyles;
  /** Border style */
  border?: keyof typeof borderStyles;
  /** Hover effect - can be boolean for legacy support or variant key */
  hover?: keyof typeof hoverStyles | boolean;
  /** Whether the card has padding in the content area */
  noPadding?: boolean;
  /** Padding style - 'none', 'sm', 'md', 'lg' or boolean (legacy) */
  padding?: 'none' | 'sm' | 'md' | 'lg' | boolean;
  /** Custom header content (overrides title/subtitle) */
  header?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Card content */
  children: React.ReactNode;
}

/**
 * Card component container
 * 
 * @param props - Card props
 * @returns React component
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ 
    title,
    subtitle,
    headerAction,
    shadow = 'md',
    border = 'default',
    hover = false,
    noPadding = false,
    padding,
    header,
    footer,
    children,
    className = '',
    ...props 
  }, ref) => {
    // Handle legacy padding prop
    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };
    const getPaddingClass = () => {
      if (padding === false || padding === 'none') return '';
      if (padding === true) return 'p-6';
      if (padding) return paddingStyles[padding];
      return noPadding ? '' : 'p-6';
    };
    const hasHeader = header || title || subtitle || headerAction;

    return (
      <div
        ref={ref}
        className={`
          bg-white rounded-xl overflow-hidden
          ${shadowStyles[shadow]}
          ${borderStyles[border]}
          ${typeof hover === 'boolean' ? (hover ? legacyHoverClass : '') : hoverStyles[hover]}
          ${className}
        `}
        {...props}
      >
        {hasHeader && (
          <div className="px-6 py-4 border-b border-slate-100">
            {header ? (
              <div className="flex-1">{header}</div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h3 className="text-lg font-semibold text-slate-900 truncate">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-sm text-slate-500">
                      {subtitle}
                    </p>
                  )}
                </div>
                {headerAction && (
                  <div className="shrink-0">{headerAction}</div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className={getPaddingClass()}>
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Card Header sub-component props
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Card Header sub-component
 */
export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = '', ...props }, ref) => (
    <div 
      ref={ref}
      className={`px-6 py-4 border-b border-slate-100 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';

/**
 * Card Content sub-component props
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  noPadding?: boolean;
}

/**
 * Card Content sub-component
 */
export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, noPadding = false, className = '', ...props }, ref) => (
    <div 
      ref={ref}
      className={`${noPadding ? '' : 'p-6'} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
CardContent.displayName = 'CardContent';

/**
 * Card Footer sub-component props
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end' | 'between';
}

const footerAlignStyles = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const;

/**
 * Card Footer sub-component
 */
export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, align = 'end', className = '', ...props }, ref) => (
    <div 
      ref={ref}
      className={`px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3 ${footerAlignStyles[align]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
CardFooter.displayName = 'CardFooter';

/**
 * StatCard sub-component props (for backward compatibility)
 */
export interface StatCardProps {
  /** Stat title */
  title: string;
  /** Stat value */
  value: string | number;
  /** Change indicator (e.g., '+12%', '-5%') */
  change?: string;
  /** Whether the change is positive, negative, neutral, or warning */
  changeType?: 'positive' | 'negative' | 'neutral' | 'warning';
  /** Icon to display */
  icon?: React.ReactNode;
  /** Icon background color */
  iconBg?: string;
  /** Icon background color (alias for iconBg) */
  iconBgColor?: string;
  /** Icon color (for backward compatibility) */
  iconColor?: string;
  /** Additional class */
  className?: string;
}

/**
 * StatCard component for dashboard statistics (backward compatible)
 */
export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  iconBg,
  iconBgColor,
  iconColor,
  className = '',
}) => {
  const bgColor = iconBg ?? iconBgColor ?? 'bg-blue-100';
  const changeColors = {
    positive: 'text-emerald-600',
    negative: 'text-red-600',
    neutral: 'text-slate-600',
    warning: 'text-amber-600',
  };

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${changeColors[changeType]}`}>
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-lg ${bgColor} ${iconColor || ''}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

export default Card;
