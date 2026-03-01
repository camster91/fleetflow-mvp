import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { X, Clock, Sparkles } from 'lucide-react';
import { getTrialBannerColor, getTrialStatusMessage } from '@/lib/trial';
import Link from 'next/link';

interface TrialBannerProps {
  daysLeft: number;
  isDismissible?: boolean;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({
  daysLeft,
  isDismissible = true,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const colors = getTrialBannerColor(daysLeft);

  useEffect(() => {
    // Check if banner was previously dismissed (only for non-urgent notices)
    if (daysLeft > 1 && typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('trialBannerDismissed');
      const dismissedDate = dismissed ? new Date(dismissed) : null;
      const now = new Date();
      
      // Show banner again if it's been more than 24 hours since dismissal
      // or if daysLeft has changed
      if (dismissedDate && (now.getTime() - dismissedDate.getTime()) < 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
      }
    }
    
    // Small delay for smooth animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, [daysLeft]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (daysLeft > 1) {
      localStorage.setItem('trialBannerDismissed', new Date().toISOString());
    }
  };

  if (isDismissed || daysLeft <= 0) return null;

  return (
    <div
      className={`
        ${colors.bg} ${colors.border} border
        transition-all duration-300 ease-in-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-1.5 rounded-full ${colors.bg} ${colors.text}`}>
              {daysLeft <= 3 ? (
                <Clock className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${colors.text}`}>
                {getTrialStatusMessage(daysLeft)}
              </p>
              <p className={`text-xs ${colors.text} opacity-80 mt-0.5`}>
                Upgrade now to continue enjoying all features uninterrupted
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link
              href="/pricing"
              className={`
                inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium
                transition-colors duration-200
                ${colors.button}
              `}
            >
              Upgrade Now
            </Link>
            
            {isDismissible && daysLeft > 1 && (
              <button
                onClick={handleDismiss}
                className={`
                  p-1.5 rounded-lg transition-colors duration-200
                  ${colors.text} hover:bg-black/5
                `}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;
