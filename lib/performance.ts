// Performance utilities for FleetFlow

import { useMemo, useCallback } from 'react'

/**
 * Debounce function to limit how often a function can fire
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function to limit execution to once per wait period
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Memoize expensive calculations
 */
export function useMemoizedValue<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps)
}

/**
 * Memoize callback functions
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps)
}

/**
 * Virtual list configuration for large datasets
 */
export interface VirtualListConfig {
  itemHeight: number
  overscan: number
  containerHeight: number
}

/**
 * Calculate visible items for virtual scrolling
 */
export function getVisibleRange(
  scrollTop: number,
  config: VirtualListConfig,
  totalItems: number
): { start: number; end: number } {
  const { itemHeight, overscan, containerHeight } = config
  
  const startIndex = Math.floor(scrollTop / itemHeight)
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  
  const start = Math.max(0, startIndex - overscan)
  const end = Math.min(totalItems, startIndex + visibleCount + overscan)
  
  return { start, end }
}

/**
 * Lazy load images
 */
export function useLazyImage(src: string): {
  src: string | undefined
  isLoaded: boolean
} {
  const [imageSrc, setImageSrc] = React.useState<string | undefined>(undefined)
  const [isLoaded, setIsLoaded] = React.useState(false)
  
  React.useEffect(() => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      setImageSrc(src)
      setIsLoaded(true)
    }
  }, [src])
  
  return { src: imageSrc, isLoaded }
}

/**
 * Measure component render performance (dev only)
 */
export function measurePerformance<T extends React.ComponentType<any>>(
  Component: T,
  name: string
): T {
  if (process.env.NODE_ENV === 'production') {
    return Component
  }
  
  return function PerformanceMeasuredComponent(props: any) {
    const startTime = performance.now()
    
    React.useEffect(() => {
      const endTime = performance.now()
      console.log(`${name} rendered in ${endTime - startTime}ms`)
    })
    
    return React.createElement(Component, props)
  } as T
}

/**
 * Optimize expensive filtering/sorting operations
 */
export function useOptimizedData<T>(
  data: T[],
  filterFn?: (item: T) => boolean,
  sortFn?: (a: T, b: T) => number,
  deps: React.DependencyList = []
): T[] {
  return useMemo(() => {
    let result = [...data]
    
    if (filterFn) {
      result = result.filter(filterFn)
    }
    
    if (sortFn) {
      result = result.sort(sortFn)
    }
    
    return result
  }, [data, filterFn, sortFn, ...deps])
}

import React from 'react'

/**
 * Preload critical resources
 */
export function preloadResource(href: string, as: 'script' | 'style' | 'font' | 'image') {
  if (typeof document !== 'undefined') {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = href
    link.as = as
    document.head.appendChild(link)
  }
}

/**
 * Batch multiple state updates
 */
export function useBatchedState<T>(
  initialState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = React.useState<T>(initialState)
  
  const batchUpdate = useCallback((updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])
  
  return [state, batchUpdate]
}

/**
 * Detect slow network and adjust behavior
 */
export function useNetworkStatus(): {
  isSlow: boolean
  isOnline: boolean
} {
  const [isSlow, setIsSlow] = React.useState(false)
  const [isOnline, setIsOnline] = React.useState(true)
  
  React.useEffect(() => {
    // Check connection speed
    const connection = (navigator as any).connection
    
    if (connection) {
      const checkSpeed = () => {
        setIsSlow(connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g')
      }
      
      checkSpeed()
      connection.addEventListener('change', checkSpeed)
      
      return () => connection.removeEventListener('change', checkSpeed)
    }
    
    // Online/offline detection
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  return { isSlow, isOnline }
}
