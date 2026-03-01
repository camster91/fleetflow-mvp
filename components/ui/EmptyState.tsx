import React from 'react';
import { Package, Search, FileX, Inbox } from 'lucide-react';
import { Button } from './Button';

type EmptyStateType = 'default' | 'search' | 'data' | 'error';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const defaultContent: Record<EmptyStateType, { icon: React.ReactNode; title: string; description: string }> = {
  default: {
    icon: <Inbox className="h-12 w-12" />,
    title: 'No items found',
    description: 'There are no items to display at the moment.',
  },
  search: {
    icon: <Search className="h-12 w-12" />,
    title: 'No results found',
    description: 'We couldn\'t find any items matching your search criteria.',
  },
  data: {
    icon: <Package className="h-12 w-12" />,
    title: 'No data available',
    description: 'Start by adding your first item to get started.',
  },
  error: {
    icon: <FileX className="h-12 w-12" />,
    title: 'Something went wrong',
    description: 'We encountered an error while loading the data.',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = '',
}) => {
  const content = defaultContent[type];

  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
      <div className="p-4 bg-slate-100 rounded-full text-slate-400 mb-4">
        {icon || content.icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">
        {title || content.title}
      </h3>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        {description || content.description}
      </p>
      {actionLabel && onAction && (
        <Button
          variant="primary"
          className="mt-6"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
