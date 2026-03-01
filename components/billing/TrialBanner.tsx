import React, { useState, useEffect } from 'react';
import { X, Sparkles, Gift } from 'lucide-react';
import Link from 'next/link';

interface TrialBannerProps {
  daysLeft?: number;
  isDismissible?: boolean;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({
  isDismissible = true,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('betaBannerDismissed');
      if (dismissed) {
        setIsDismissed(true);
      }
    }
    
    // Small delay for smooth animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('betaBannerDismissed', 'true');
  };

  if (isDismissed) return null;

  return (
    <div
      className={`
        bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-200
        transition-all duration-300 ease-in-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 rounded-full bg-amber-100 text-amber-700">
              <Gift className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                You're in the FleetFlow Beta! 🎉
              </p>
              <p className="text-xs text-amber-800 opacity-80 mt-0.5">
                Free access to all features • Limited time offer
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link
              href="/pricing"
              className="
                inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium
                transition-colors duration-200
                bg-amber-600 hover:bg-amber-700 text-white
              "
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Beta Benefits
            </Link>
            
            {isDismissible && (
              <button
                onClick={handleDismiss}
                className="
                  p-1.5 rounded-lg transition-colors duration-200
                  text-amber-700 hover:bg-amber-200/50
                "
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
