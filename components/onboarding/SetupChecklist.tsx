import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProgressRing } from '../ui/ProgressRing';
import { Badge } from '../ui/Badge';
import {
  User,
  Truck,
  Users,
  Wrench,
  Plug,
  ChevronRight,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import { useRouter } from 'next/router';
import {
  getOnboardingCompletionPercentage,
  isOnboardingComplete,
  getLocalOnboardingProgress,
  completeChecklistItem,
  resetOnboardingProgress,
} from '../../lib/onboarding';
import { notify } from '../../services/notifications';

interface SetupChecklistProps {
  onDismiss?: () => void;
  className?: string;
}

interface ChecklistItem {
  id: keyof ReturnType<typeof getLocalOnboardingProgress>['checklist'];
  label: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  actionLabel: string;
}

export const SetupChecklist: React.FC<SetupChecklistProps> = ({
  onDismiss,
  className = '',
}) => {
  const router = useRouter();
  const [progress, setProgress] = React.useState(() => getLocalOnboardingProgress());
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const checklistItems: ChecklistItem[] = [
    {
      id: 'profileComplete',
      label: 'Complete your profile',
      description: 'Add your name, photo, and company details',
      icon: <User className="h-5 w-5" />,
      route: '/settings/profile',
      actionLabel: 'Complete Profile',
    },
    {
      id: 'vehicleAdded',
      label: 'Add your first vehicle',
      description: 'Start tracking your fleet by adding a vehicle',
      icon: <Truck className="h-5 w-5" />,
      route: '/vehicles',
      actionLabel: 'Add Vehicle',
    },
    {
      id: 'teamMemberInvited',
      label: 'Invite a team member',
      description: 'Collaborate with your team by inviting members',
      icon: <Users className="h-5 w-5" />,
      route: '/team/invite',
      actionLabel: 'Invite Team',
    },
    {
      id: 'maintenanceScheduled',
      label: 'Schedule maintenance',
      description: 'Set up your first maintenance reminder',
      icon: <Wrench className="h-5 w-5" />,
      route: '/maintenance',
      actionLabel: 'Schedule',
    },
    {
      id: 'integrationConnected',
      label: 'Connect an integration',
      description: 'Link QuickBooks, GPS, or other services',
      icon: <Plug className="h-5 w-5" />,
      route: '/settings/integrations',
      actionLabel: 'Connect',
    },
  ];

  const completionPercentage = getOnboardingCompletionPercentage();
  const isComplete = isOnboardingComplete();

  const handleItemClick = (item: ChecklistItem) => {
    router.push(item.route);
  };

  const handleCheckItem = (e: React.MouseEvent, itemId: ChecklistItem['id']) => {
    e.stopPropagation();
    completeChecklistItem(itemId);
    setProgress(getLocalOnboardingProgress());
    notify.success('Item marked as complete!');
  };

  const handleReset = () => {
    resetOnboardingProgress();
    setProgress(getLocalOnboardingProgress());
    notify.success('Checklist reset');
  };

  const completedCount = Object.values(progress.checklist).filter(Boolean).length;
  const totalCount = checklistItems.length;

  if (isComplete) {
    return (
      <Card className={`bg-emerald-50 border-emerald-200 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900">
                Setup Complete!
              </h3>
              <p className="text-sm text-emerald-700">
                You\'re all set to manage your fleet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              iconLeft={<RotateCcw className="h-4 w-4" />}
            >
              Reset
            </Button>
            <button
              onClick={onDismiss}
              className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              <X className="h-4 w-4 text-emerald-600" />
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (isCollapsed) {
    return (
      <Card className={`${className}`}>
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <ProgressRing progress={completionPercentage} size={32} strokeWidth={2} />
            <div>
              <h3 className="font-medium text-slate-900">Setup Checklist</h3>
              <p className="text-sm text-slate-500">
                {completedCount} of {totalCount} completed
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </button>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ProgressRing progress={completionPercentage} size={40} strokeWidth={3} />
          <div>
            <h3 className="font-semibold text-slate-900">Setup Checklist</h3>
            <p className="text-sm text-slate-500">
              Complete these steps to get the most out of FleetFlow
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Collapse checklist"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {checklistItems.map((item) => {
          const isCompleted = progress.checklist[item.id];
          return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`
                flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                ${isCompleted 
                  ? 'bg-emerald-50 border border-emerald-100' 
                  : 'bg-slate-50 hover:bg-slate-100 border border-transparent hover:border-slate-200'
                }
              `}
            >
              <button
                onClick={(e) => handleCheckItem(e, item.id)}
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center transition-colors
                  ${isCompleted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white border-2 border-slate-300 hover:border-blue-500'
                  }
                `}
              >
                {isCompleted && <Check className="h-4 w-4" />}
              </button>

              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-500'}
              `}>
                {item.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className={`
                    font-medium truncate
                    ${isCompleted ? 'text-emerald-900 line-through' : 'text-slate-900'}
                  `}>
                    {item.label}
                  </h4>
                  {isCompleted && (
                    <Badge variant="success" size="sm">Done</Badge>
                  )}
                </div>
                <p className={`
                  text-sm truncate
                  ${isCompleted ? 'text-emerald-600' : 'text-slate-500'}
                `}>
                  {item.description}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(item);
                }}
              >
                {item.actionLabel}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {completedCount} of {totalCount} completed
        </p>
        <button
          onClick={onDismiss}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Dismiss checklist
        </button>
      </div>
    </Card>
  );
};

export default SetupChecklist;
