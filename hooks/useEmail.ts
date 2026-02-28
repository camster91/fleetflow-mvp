// React Hook for sending emails from components
import { useState, useCallback } from 'react'

interface UseEmailOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export function useEmail(options: UseEmailOptions = {}) {
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendEmail = useCallback(async (emailOptions: EmailOptions): Promise<boolean> => {
    setIsSending(true)
    setError(null)

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailOptions)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      options.onSuccess?.()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send email'
      setError(errorMessage)
      options.onError?.(errorMessage)
      return false
    } finally {
      setIsSending(false)
    }
  }, [options])

  return {
    sendEmail,
    isSending,
    error
  }
}
