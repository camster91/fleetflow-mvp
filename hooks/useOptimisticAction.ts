import { useCallback, useRef, useState, useTransition } from 'react';

interface UseOptimisticActionOptions<T> {
  /** Apply optimistic update immediately */
  onOptimistic: () => void;
  /** Persist the change; throw/reject to roll back */
  action: () => Promise<T>;
  /** Restore previous UI state on failure */
  onRollback: () => void;
  onSuccess?: (result: T) => void;
  onError?: (error: unknown) => void;
}

/**
 * Runs an optimistic UI update with rollback on failure.
 * Uses startTransition for non-blocking paint where available.
 */
export function useOptimisticAction() {
  const [pending, setPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);

  const run = useCallback(
    async <T,>({
      onOptimistic,
      action,
      onRollback,
      onSuccess,
      onError,
    }: UseOptimisticActionOptions<T>): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setPending(true);
      startTransition(() => {
        onOptimistic();
      });
      try {
        const result = await action();
        onSuccess?.(result);
        return result;
      } catch (error) {
        onRollback();
        onError?.(error);
        return undefined;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    []
  );

  return { run, pending: pending || isPending };
}

export default useOptimisticAction;
