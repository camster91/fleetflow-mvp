import { useState, useCallback } from 'react'

interface UseFormSubmitResult<T> {
  isSubmitting: boolean
  error: string | null
  handleSubmit: (data: T) => Promise<void>
  clearError: () => void
}

export function useFormSubmit<T>(
  onSubmit: (data: T) => Promise<void>
): UseFormSubmitResult<T> {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (data: T) => {
      setIsSubmitting(true)
      setError(null)
      try {
        await onSubmit(data)
      } catch (err: any) {
        setError(err.message || 'An error occurred')
      } finally {
        setIsSubmitting(false)
      }
    },
    [onSubmit]
  )

  const clearError = useCallback(() => setError(null), [])

  return { isSubmitting, error, handleSubmit, clearError }
}
