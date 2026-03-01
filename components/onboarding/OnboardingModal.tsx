import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ProgressRing } from '../ui/ProgressRing';
import {
  Truck,
  Users,
  Wrench,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  X,
} from 'lucide-react';
import { notify } from '../../services/notifications';
import {
  getLocalOnboardingProgress,
  saveLocalOnboardingProgress,
  completeOnboarding,
} from '../../lib/onboarding';
import { useSession } from 'next-auth/react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { data: session } = useSession();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const progress = getLocalOnboardingProgress();
      setCurrentStep(progress.currentStep);
    }
  }, [isOpen]);

  const steps: Step[] = [
    {
      id: 0,
      title: 'Welcome to FleetFlow',
      description: 'Let\'s get you set up in just a few steps',
      icon: <Sparkles className="h-8 w-8 text-amber-500" />,
      content: (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="h-10 w-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">
            Welcome to FleetFlow!
          </h3>
          <p className="text-slate-600 max-w-sm mx-auto">
            We\'re excited to help you manage your fleet more efficiently. 
            This quick setup will guide you through the essential steps to get started.
          </p>
          <div className="flex justify-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>Add vehicles</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>Invite team</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>Schedule maintenance</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 1,
      title: 'Add Your First Vehicle',
      description: 'Start by adding a vehicle to your fleet',
      icon: <Truck className="h-6 w-6 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Why add vehicles?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Track vehicle location and status in real-time</li>
              <li>• Monitor maintenance schedules</li>
              <li>• Assign drivers and manage deliveries</li>
              <li>• Generate compliance reports</li>
            </ul>
          </div>
          <p className="text-slate-600">
            You can add vehicles manually or import them from a CSV file. 
            Each vehicle can be tracked with GPS, maintenance history, and driver assignments.
          </p>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Truck className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-medium text-slate-900">Ready to add your first vehicle?</p>
              <p className="text-sm text-slate-500">Click Next to continue or skip for now</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Invite Team Members',
      description: 'Collaborate with your team',
      icon: <Users className="h-6 w-6 text-emerald-500" />,
      content: (
        <div className="space-y-4">
          <div className="bg-emerald-50 p-4 rounded-lg">
            <h4 className="font-medium text-emerald-900 mb-2">Team Roles</h4>
            <div className="text-sm text-emerald-800 space-y-2">
              <div className="flex justify-between">
                <span>Owner</span>
                <span className="text-emerald-600">Full access</span>
              </div>
              <div className="flex justify-between">
                <span>Admin</span>
                <span className="text-emerald-600">Manage everything</span>
              </div>
              <div className="flex justify-between">
                <span>Manager</span>
                <span className="text-emerald-600">Manage vehicles & drivers</span>
              </div>
              <div className="flex justify-between">
                <span>Member</span>
                <span className="text-emerald-600">View & update assigned</span>
              </div>
            </div>
          </div>
          <p className="text-slate-600">
            Invite your team members to collaborate. You can assign different roles 
            to control what each person can access and modify.
          </p>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Set Up Maintenance',
      description: 'Keep your fleet running smoothly',
      icon: <Wrench className="h-6 w-6 text-amber-500" />,
      content: (
        <div className="space-y-4">
          <div className="bg-amber-50 p-4 rounded-lg">
            <h4 className="font-medium text-amber-900 mb-2">Maintenance Features</h4>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• Schedule recurring maintenance tasks</li>
              <li>• Get alerts before maintenance is due</li>
              <li>• Track maintenance history per vehicle</li>
              <li>• Generate compliance reports</li>
            </ul>
          </div>
          <p className="text-slate-600">
            Proactive maintenance helps prevent breakdowns and extends vehicle life. 
            Set up maintenance schedules for oil changes, inspections, and more.
          </p>
        </div>
      ),
    },
    {
      id: 4,
      title: 'You\'re All Set!',
      description: 'Ready to manage your fleet',
      icon: <CheckCircle className="h-6 w-6 text-emerald-500" />,
      content: (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">
            You\'re Ready to Go!
          </h3>
          <p className="text-slate-600 max-w-sm mx-auto">
            You\'ve completed the initial setup. You can always access these features 
            from your dashboard. Check the setup checklist to track your progress.
          </p>
          <div className="bg-slate-50 p-4 rounded-lg text-left">
            <h4 className="font-medium text-slate-900 mb-2">Quick Tips:</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Use the Command Palette (Ctrl+K) for quick navigation</li>
              <li>• Set up notifications to stay informed</li>
              <li>• Explore the Analytics dashboard for insights</li>
              <li>• Check out our Help Center for detailed guides</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveLocalOnboardingProgress({ currentStep: nextStep });
    } else {
      await handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveLocalOnboardingProgress({ currentStep: prevStep });
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      if (session?.user?.id) {
        await completeOnboarding(session.user.id);
      } else {
        saveLocalOnboardingProgress({ completed: true });
      }
      notify.success('Welcome to FleetFlow! Your setup is complete.');
      onComplete?.();
      onClose();
    } catch (error) {
      notify.error('Failed to save progress. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    saveLocalOnboardingProgress({ currentStep: 0 });
    onClose();
  };

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      size="lg"
      closeOnBackdropClick={false}
      closeOnEsc={false}
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            {currentStepData.icon}
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {currentStepData.title}
              </h3>
              <p className="text-sm text-slate-500">
                {currentStepData.description}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Skip onboarding"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <ProgressRing
              progress={progress}
              size={40}
              strokeWidth={3}
              showPercentage
            />
            <span className="text-sm text-slate-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                onClick={handlePrevious}
                iconLeft={<ChevronLeft className="h-4 w-4" />}
              >
                Back
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleNext}
              loading={isLoading}
              iconRight={currentStep === steps.length - 1 ? undefined : <ChevronRight className="h-4 w-4" />}
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="min-h-[300px] flex items-center justify-center">
        {currentStepData.content}
      </div>
    </Modal>
  );
};

export default OnboardingModal;
