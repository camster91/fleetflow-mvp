import React from 'react';
import { TeamRole } from '../../types';
import { getRoleColor, getRoleDisplayName } from '../../lib/permissions';
import { Shield, User, Eye, Users, Crown } from 'lucide-react';

interface RoleBadgeProps {
  role: TeamRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const roleIcons: Record<TeamRole, React.ReactNode> = {
  OWNER: <Crown className="h-3.5 w-3.5" />,
  ADMIN: <Shield className="h-3.5 w-3.5" />,
  MANAGER: <Users className="h-3.5 w-3.5" />,
  MEMBER: <User className="h-3.5 w-3.5" />,
  VIEWER: <Eye className="h-3.5 w-3.5" />,
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
  lg: 'px-3 py-1.5 text-base gap-2',
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const colorClass = getRoleColor(role);
  const displayName = getRoleDisplayName(role);
  const icon = roleIcons[role];

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${colorClass}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {showIcon && icon}
      {displayName}
    </span>
  );
};

export default RoleBadge;
