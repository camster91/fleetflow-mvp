'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { AlertCircle, Clock, RefreshCw, X } from 'lucide-react';
import { Button } from '../ui/Button';

// Time before expiry to show warning (5 minutes)
const WARNING_THRESHOLD = 5 * 60 * 1000;
// Check interval (30 seconds)
const CHECK_INTERVAL = 30 * 1000;

export function SessionExpiryWarning() {
  const { data: session, status } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkSessionExpiry = useCallback(() => {
    if (status !== 'authenticated' || !session?.expires) {
      setShowWarning(false);
      return;
    }

    const expiryTime = new Date(session.expires).getTime();
    const now = Date.now();
    const remaining = expiryTime - now;

    setTimeRemaining(remaining);

    if (remaining <= WARNING_THRESHOLD && remaining > 0) {
      setShowWarning(true);
    } else if (remaining <= 0) {
      // Session has expired
      setShowWarning(false);
      // Optionally trigger automatic logout or refresh
    } else {
      setShowWarning(false);
    }
  }, [session, status]);

  useEffect(() => {
    // Check immediately
    checkSessionExpiry();

    // Set up interval
    const interval = setInterval(checkSessionExpiry, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [checkSessionExpiry]);

  const handleExtendSession = async () => {
    setRefreshing(true);
    try {
      // Trigger session update
      const result = await signIn('credentials', {
        redirect: false,
        callbackUrl: window.location.pathname,
      });

      if (result?.ok) {
        setShowWarning(false);
        // Force a page reload to get fresh session data
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to extend session:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDismiss = () => {
    setShowWarning(false);
  };

  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!showWarning || !timeRemaining) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-900">
              Session Expiring Soon
            </h3>
            <div className="mt-1 flex items-center text-sm text-amber-700">
              <Clock className="h-4 w-4 mr-1.5" />
              Expires in {formatTimeRemaining(timeRemaining)}
            </div>
            <p className="mt-1 text-xs text-amber-600">
              Your session will expire soon. Save your work and extend your session to continue.
            </p>
            <div className="mt-3 flex space-x-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleExtendSession}
                loading={refreshing}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Extend Session
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
              >
                Dismiss
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-amber-400 hover:text-amber-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Alternative: Inline session status indicator
export function SessionStatusIndicator() {
  const { data: session, status } = useSession();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.expires) {
      setTimeRemaining(null);
      return;
    }

    const calculateRemaining = () => {
      const expiryTime = new Date(session.expires).getTime();
      const remaining = expiryTime - Date.now();
      setTimeRemaining(Math.max(0, remaining));
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [session, status]);

  if (status !== 'authenticated' || !timeRemaining) {
    return null;
  }

  const minutes = Math.floor(timeRemaining / 60000);
  const isExpiringSoon = minutes < 5;

  return (
    <div 
      className={`flex items-center space-x-1.5 text-xs ${
        isExpiringSoon ? 'text-amber-600' : 'text-slate-500'
      }`}
      title={`Session expires in ${minutes} minutes`}
    >
      <div className={`w-2 h-2 rounded-full ${
        isExpiringSoon ? 'bg-amber-500 animate-pulse' : 'bg-green-500'
      }`} />
      <span>{minutes}m</span>
    </div>
  );
}

// Hook for session management
export function useSessionManager() {
  const { data: session, status, update } = useSession();
  const [isExpiring, setIsExpiring] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.expires) {
      setIsExpiring(false);
      return;
    }

    const checkExpiry = () => {
      const expiryTime = new Date(session.expires).getTime();
      const remaining = expiryTime - Date.now();
      setIsExpiring(remaining <= WARNING_THRESHOLD);
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [session, status]);

  const extendSession = async () => {
    await update();
  };

  return {
    session,
    status,
    isExpiring,
    extendSession,
  };
}
