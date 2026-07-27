import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, X } from 'lucide-react';

export function TrialBanner() {
  const [data, setData] = useState<{ status: string; trialEndsAt: string | null } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/subscription/status')
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then(d => {
        if (d?.subscription) setData(d.subscription);
      })
      .catch(() => {});
  }, []);

  if (dismissed || !data || data.status !== 'TRIAL') return null;

  const trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const expired = trialEndsAt && trialEndsAt < new Date();

  return (
    <div className={`px-4 py-2.5 text-sm flex items-center justify-between ${expired ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        {expired ? (
          <span>Your trial has expired. <Link href="/billing" className="font-medium underline">Subscribe now</Link> to keep using FleetFlow.</span>
        ) : (
          <span>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left in your trial. <Link href="/billing" className="font-medium underline">Subscribe</Link></span>
        )}
      </div>
      <button onClick={() => setDismissed(true)} className="p-1 hover:opacity-70">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
