import React, { useEffect, useState } from 'react'

export interface FadeInProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** Stagger delay in ms */
  delay?: number
  /** Duration in ms */
  duration?: number
  /** Translate distance in px on enter */
  offset?: number
  /** Disable animation (e.g. reduced motion handled via CSS too) */
  disabled?: boolean
}

/**
 * Subtle entrance animation for list rows and page sections.
 * Respects prefers-reduced-motion via CSS utility in globals.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 320,
  offset = 8,
  disabled = false,
  className = '',
  style,
  ...props
}: FadeInProps) {
  const [visible, setVisible] = useState(disabled)

  useEffect(() => {
    if (disabled) {
      setVisible(true)
      return
    }
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setVisible(true)
      return
    }
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [disabled])

  return (
    <div
      className={`motion-safe-fade ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : `translateY(${offset}px)`,
        transition: disabled
          ? undefined
          : `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export default FadeIn
