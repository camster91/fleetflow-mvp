/**
 * Avatar Component
 * 
 * User avatar component with fallback to initials, size variants,
 * and status indicator support.
 * 
 * @example
 * ```tsx
 * <Avatar src="/user.jpg" alt="John Doe" size="lg" status="online" />
 * <Avatar fallback="John Doe" size="md" />
 * ```
 */

import React from 'react';
import { User } from 'lucide-react';

/**
 * Avatar size variants
 */
const sizeStyles = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl',
} as const;

/**
 * Status indicator size variants
 */
const statusSizeStyles = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
} as const;

/**
 * Status indicator position offset
 */
const statusPositionStyles = {
  xs: '-bottom-0.5 -right-0.5',
  sm: '-bottom-0.5 -right-0.5',
  md: '-bottom-0.5 -right-0.5',
  lg: '-bottom-1 -right-1',
  xl: '-bottom-1 -right-1',
  '2xl': '-bottom-1 -right-1',
} as const;

/**
 * Status color styles
 */
const statusStyles = {
  online: 'bg-emerald-500',
  offline: 'bg-slate-400',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
} as const;

/**
 * Avatar component props
 */
export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image source URL */
  src?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Avatar size */
  size?: keyof typeof sizeStyles;
  /** Fallback text (usually initials or full name) */
  fallback?: string;
  /** Online status indicator */
  status?: keyof typeof statusStyles;
  /** Shape of the avatar */
  shape?: 'circle' | 'square';
  /** Additional class for the image */
  imgClassName?: string;
}

/**
 * Generate initials from a name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate a consistent background color based on name
 */
function getBackgroundColor(name: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Avatar component for user representation
 * 
 * @param props - Avatar props
 * @returns React component
 */
export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ 
    src,
    alt = '',
    size = 'md',
    fallback,
    status,
    shape = 'circle',
    className = '',
    imgClassName = '',
    ...props 
  }, ref) => {
    const [imageError, setImageError] = React.useState(false);
    const hasImage = src && !imageError;
    const fallbackText = fallback || alt;
    const hasFallback = !!fallbackText;

    const handleImageError = () => {
      setImageError(true);
    };

    const bgColor = hasFallback ? getBackgroundColor(fallbackText) : 'bg-slate-300';

    return (
      <div 
        ref={ref}
        className={`relative inline-block shrink-0 ${className}`}
        {...props}
      >
        <div
          className={`
            ${sizeStyles[size]}
            ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'}
            ${hasImage ? '' : bgColor}
            flex items-center justify-center
            overflow-hidden
            ${!hasImage ? 'text-white font-medium' : ''}
          `}
          aria-label={alt || fallback || 'Avatar'}
        >
          {hasImage ? (
            <img
              src={src}
              alt={alt}
              onError={handleImageError}
              className={`w-full h-full object-cover ${imgClassName}`}
              loading="lazy"
            />
          ) : hasFallback ? (
            <span>{getInitials(fallbackText)}</span>
          ) : (
            <User 
              size={size === 'xs' ? 12 : size === 'sm' ? 16 : size === 'md' ? 20 : size === 'lg' ? 24 : size === 'xl' ? 32 : 40} 
              className="text-white"
              aria-hidden="true"
            />
          )}
        </div>

        {status && (
          <span
            className={`
              absolute ${statusPositionStyles[size]}
              ${statusSizeStyles[size]}
              ${statusStyles[status]}
              rounded-full ring-2 ring-white
            `}
            aria-label={`Status: ${status}`}
            title={status.charAt(0).toUpperCase() + status.slice(1)}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

/**
 * Avatar Group component for displaying multiple avatars
 */
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum number of avatars to display */
  max?: number;
  /** Spacing between avatars */
  spacing?: 'tight' | 'normal' | 'loose';
  /** Avatar size */
  size?: keyof typeof sizeStyles;
  /** Children avatars */
  children: React.ReactNode;
  /** Additional count to display as +N */
  total?: number;
}

const groupSpacingStyles = {
  tight: '-space-x-2',
  normal: '-space-x-3',
  loose: '-space-x-1',
} as const;

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ 
    max,
    spacing = 'normal',
    size = 'md',
    children,
    total,
    className = '',
    ...props 
  }, ref) => {
    const childrenArray = React.Children.toArray(children);
    const displayCount = max ? Math.min(childrenArray.length, max) : childrenArray.length;
    const hiddenCount = total ?? (max && childrenArray.length > max ? childrenArray.length - max : 0);
    const displayedChildren = childrenArray.slice(0, displayCount);

    return (
      <div 
        ref={ref}
        className={`flex items-center ${groupSpacingStyles[spacing]} ${className}`}
        {...props}
      >
        {displayedChildren.map((child, index) => (
          <div 
            key={index}
            className="relative inline-block ring-2 ring-white rounded-full"
          >
            {React.isValidElement(child) 
              ? React.cloneElement(child as React.ReactElement<AvatarProps>, { size })
              : child
            }
          </div>
        ))}
        
        {hiddenCount > 0 && (
          <div 
            className={`
              relative inline-flex items-center justify-center
              ${sizeStyles[size]}
              rounded-full bg-slate-100 text-slate-600
              font-medium text-xs ring-2 ring-white
            `}
          >
            +{hiddenCount}
          </div>
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';

export default Avatar;
