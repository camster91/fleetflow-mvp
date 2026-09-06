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
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

const defaultContent: Record<EmptyStateType, { icon: React.ReactNode; title: string; description: string }> = {
  default: {
    icon: <Inbox className="h-10 w-10" aria-hidden="true" />,
    title: 'Nothing here yet',
    description: 'When there is something to show, it will appear in this space.',
  },
  search: {
    icon: <Search className="h-10 w-10" aria-hidden="true" />,
    title: 'No matches',
    description: 'Try a different search or clear filters to see more results.',
  },
  data: {
    icon: <Package className="h-10 w-10" aria-hidden="true" />,
    title: 'Ready when you are',
    description: 'Add your first item to start building this list.',
  },
  error: {
    icon: <FileX className="h-10 w-10" aria-hidden="true" />,
    title: 'Could not load this view',
    description: 'Something went wrong. Try again in a moment.',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  title,
  description,
  icon,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  className = '',
}) => {
  const content = defaultContent[type];

  return (
    <div
      className={`flex flex-col items-center justify-center px-4 py-14 text-center ${className}`}
      role="status"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
        {icon || content.icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {title || content.title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {description || content.description}
      </p>
      {(actionLabel && onAction) || (secondaryLabel && onSecondary) ? (
        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {actionLabel && onAction && (
            <Button variant="primary" className="min-h-11" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button variant="outline" className="min-h-11" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default EmptyState;
