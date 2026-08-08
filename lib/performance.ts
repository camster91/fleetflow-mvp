import { useEffect, useState } from 'react'

interface NetworkInformation extends EventTarget {
  effectiveType?: string
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation
}

/** Report browser connectivity and whether the current connection is very slow. */
export function useNetworkStatus(): { isSlow: boolean; isOnline: boolean } {
  const [isSlow, setIsSlow] = useState(false)
  // Keep the initial server and browser render identical, then read the
  // browser's actual state after hydration.
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const connection = (navigator as NavigatorWithConnection).connection
    setIsOnline(navigator.onLine)
    const checkSpeed = () => {
      setIsSlow(
        connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g'
      )
    }
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    checkSpeed()
    connection?.addEventListener('change', checkSpeed)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      connection?.removeEventListener('change', checkSpeed)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isSlow, isOnline }
}
