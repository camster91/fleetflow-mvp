/**
 * Skeleton Component
 * 
 * Loading skeleton placeholders for content that is loading.
 * Supports text, circle, and rectangle variants with pulse animation.
 * 
 * @example
 * ```tsx
 * <Skeleton variant="text" width={200} />
 * <Skeleton variant="circle" width={48} height={48} />
 * <Skeleton variant="rect" width="100%" height={200} />
 * ```
 */

import React from 'react';

/**
 * Skeleton variant types
 */
export type SkeletonVariant = 'text' | 'circle' | 'rect' | 'rounded';

/**
 * Skeleton animation types
 */
export type SkeletonAnimation = 'pulse' | 'shimmer' | 'none';

/**
 * Skeleton component props
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant of the skeleton */
  variant?: SkeletonVariant;
  /** Width of the skeleton (number for pixels, string for CSS value) */
  width?: number | string;
  /** Height of the skeleton (number for pixels, string for CSS value) */
  height?: number | string;
  /** Animation style */
  animation?: SkeletonAnimation;
  /** Number of lines to render (for text variant) */
  lines?: number;
  /** Gap between lines (for text variant with multiple lines) */
  lineGap?: number;
}

/**
 * Convert dimension value to CSS string
 */
function toDimension(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * Skeleton component for loading states
 * 
 * @param props - Skeleton props
 * @returns React component
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ 
    variant = 'text',
    width,
    height,
    animation = 'pulse',
    lines = 1,
    lineGap = 8,
    className = '',
    style,
    ...props 
  }, ref) => {
    const widthStyle = toDimension(width);
    const heightStyle = toDimension(height);

    const animationClasses = {
      pulse: 'animate-pulse',
      shimmer: 'animate-shimmer',
      none: '',
    };

    const variantClasses = {
      text: 'rounded',
      circle: 'rounded-full',
      rect: 'rounded-none',
      rounded: 'rounded-lg',
    };

    // Single skeleton element
    const SkeletonElement = ({ 
      customWidth, 
      customHeight,
      isLast = true,
    }: { 
      customWidth?: string; 
      customHeight?: string;
      isLast?: boolean;
    }) => (
      <div
        className={`
          bg-slate-200 
          ${variantClasses[variant]}
          ${animationClasses[animation]}
          ${!isLast ? `mb-[${lineGap}px]` : ''}
          ${className}
        `}
        style={{
          width: customWidth ?? widthStyle ?? (variant === 'text' ? '100%' : undefined),
          height: customHeight ?? heightStyle ?? (variant === 'text' ? '1em' : undefined),
          marginBottom: !isLast ? lineGap : undefined,
          ...style,
        }}
        aria-hidden="true"
        {...props}
      />
    );

    // Multiple lines for text variant
    if (variant === 'text' && lines > 1) {
      return (
        <div ref={ref} className="w-full">
          {Array.from({ length: lines }).map((_, index) => (
            <SkeletonElement 
              key={index}
              customWidth={index === lines - 1 ? '75%' : '100%'}
              isLast={index === lines - 1}
            />
          ))}
        </div>
      );
    }

    return (
      <div ref={ref}>
        <SkeletonElement />
      </div>
    );
  }
);

Skeleton.displayName = 'Skeleton';

/**
 * Skeleton Card - Pre-configured skeleton for card-like content
 */
export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether to show header section */
  hasHeader?: boolean;
  /** Whether to show footer section */
  hasFooter?: boolean;
  /** Number of content lines (alias for contentLines for backward compatibility) */
  lines?: number;
  /** Number of content lines */
  contentLines?: number;
  /** Animation style */
  animation?: SkeletonAnimation;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  hasHeader = true,
  hasFooter = true,
  lines,
  contentLines,
  animation = 'pulse',
  className = '',
  ...props 
}) => {
  const numLines = lines ?? contentLines ?? 3;
  return (
    <div 
      className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className="flex items-center gap-4 mb-6">
          <Skeleton variant="circle" width={48} height={48} animation={animation} />
          <div className="flex-1">
            <Skeleton variant="text" width={150} height={20} animation={animation} />
            <Skeleton variant="text" width={100} height={14} animation={animation} />
          </div>
        </div>
      )}
      
      <Skeleton 
        variant="text" 
        lines={numLines} 
        animation={animation} 
      />
      
      {hasFooter && (
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <Skeleton variant="rounded" width={80} height={36} animation={animation} />
          <Skeleton variant="rounded" width={80} height={36} animation={animation} />
        </div>
      )}
    </div>
  );
};

/**
 * Skeleton Table - Pre-configured skeleton for table content
 */
export interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Whether to show header */
  hasHeader?: boolean;
  /** Animation style */
  animation?: SkeletonAnimation;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ 
  rows = 5,
  columns = 4,
  hasHeader = true,
  animation = 'pulse',
  className = '',
  ...props 
}) => (
  <div className={`w-full ${className}`} {...props}>
    {hasHeader && (
      <div className="flex gap-4 mb-4 pb-4 border-b border-slate-200">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton 
            key={`header-${index}`}
            variant="text" 
            width={`${100 / columns}%`}
            height={20}
            animation={animation}
          />
        ))}
      </div>
    )}
    
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={`row-${rowIndex}`} className="flex gap-4 mb-4">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton 
            key={`cell-${rowIndex}-${colIndex}`}
            variant="text" 
            width={`${100 / columns}%`}
            height={16}
            animation={animation}
          />
        ))}
      </div>
    ))}
  </div>
);

/**
 * Skeleton Avatar - Pre-configured skeleton for avatar
 */
export interface SkeletonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the avatar skeleton */
  size?: number;
  /** Animation style */
  animation?: SkeletonAnimation;
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({ 
  size = 40,
  animation = 'pulse',
  className = '',
  ...props 
}) => (
  <Skeleton 
    variant="circle" 
    width={size} 
    height={size} 
    animation={animation}
    className={className}
    {...props}
  />
);

/**
 * Skeleton Text - Pre-configured skeleton for text blocks
 */
export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of lines */
  lines?: number;
  /** Width of each line (can be array for different widths) */
  width?: (number | string) | (number | string)[];
  /** Line height */
  lineHeight?: number;
  /** Gap between lines */
  gap?: number;
  /** Animation style */
  animation?: SkeletonAnimation;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ 
  lines = 3,
  width,
  lineHeight = 16,
  gap = 8,
  animation = 'pulse',
  className = '',
  ...props 
}) => {
  const getWidth = (index: number): number | string | undefined => {
    if (!width) return index === lines - 1 ? '75%' : '100%';
    if (Array.isArray(width)) return width[index % width.length];
    return width;
  };

  return (
    <div className={className} {...props}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={getWidth(index)}
          height={lineHeight}
          animation={animation}
          lineGap={gap}
        />
      ))}
    </div>
  );
};

export default Skeleton;
