import React from 'react';
import Image from 'next/image';

interface LogoProps {
  variant?: 'horizontal' | 'icon' | 'wordmark' | 'horizontal-dark';
  width?: number;
  height?: number;
  className?: string;
}

const logoPaths = {
  'horizontal': '/brand/logo/logo-horizontal.svg',
  'horizontal-dark': '/brand/logo/logo-horizontal-dark.svg',
  'icon': '/brand/logo/logo-icon.svg',
  'wordmark': '/brand/logo/logo-wordmark.svg',
};

const defaultDimensions = {
  'horizontal': { width: 200, height: 40 },
  'horizontal-dark': { width: 200, height: 40 },
  'icon': { width: 40, height: 40 },
  'wordmark': { width: 140, height: 32 },
};

/**
 * FleetFlow Logo Component
 * 
 * Usage:
 * <Logo /> - Default horizontal logo (200x40)
 * <Logo variant="icon" width={32} height={32} /> - Icon only
 * <Logo variant="horizontal-dark" /> - For dark backgrounds
 * <Logo variant="wordmark" /> - Text only
 */
export const Logo: React.FC<LogoProps> = ({
  variant = 'horizontal',
  width,
  height,
  className = '',
}) => {
  const dims = defaultDimensions[variant];
  const finalWidth = width || dims.width;
  const finalHeight = height || dims.height;

  return (
    <Image
      src={logoPaths[variant]}
      alt="FleetFlow"
      width={finalWidth}
      height={finalHeight}
      className={className}
      priority
    />
  );
};

export default Logo;
