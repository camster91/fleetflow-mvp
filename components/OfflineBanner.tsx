import { useNetworkStatus } from '../lib/performance'
import { WifiOff } from 'lucide-react'

/** Global offline / slow-network banner for authenticated app shells. */
export function OfflineBanner() {
  const { isOnline, isSlow } = useNetworkStatus()

  if (isOnline && !isSlow) return null

  return (
    <div
      role="status"
      className={`fixed top-0 inset-x-0 z-[100] px-4 py-2 text-center text-sm font-medium ${
        !isOnline ? 'bg-red-700 text-white' : 'bg-amber-500 text-slate-900'
      }`}
    >
      <span className="inline-flex items-center gap-2 justify-center">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        {!isOnline
          ? 'You are offline. Changes may not save until connectivity returns.'
          : 'Slow network detected. Some actions may take longer.'}
      </span>
    </div>
  )
}
