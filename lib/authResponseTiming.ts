type TimingOptions = {
  minimumMs?: number
  now?: () => number
  sleep?: (milliseconds: number) => Promise<void>
}

type DeliveryTimingOptions = {
  timeoutMs?: number
  sleep?: (milliseconds: number) => Promise<void>
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const EMAIL_DELIVERY_TIMEOUT_MS = positiveInteger(
  process.env.EMAIL_DELIVERY_TIMEOUT_MS, 4_000
)
export const LOGIN_RESPONSE_TARGET_MS = Math.max(
  positiveInteger(process.env.LOGIN_RESPONSE_TARGET_MS, 4_500),
  EMAIL_DELIVERY_TIMEOUT_MS + 100
)

export async function awaitEmailDeliveryWithinTimeout<T>(
  delivery: Promise<T>,
  options: DeliveryTimingOptions = {}
): Promise<{ status: 'delivered'; value: T } | { status: 'failed' } | { status: 'timeout' }> {
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? EMAIL_DELIVERY_TIMEOUT_MS, 30_000))
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
  // Attach both settlement handlers before starting the timeout race. A late
  // provider rejection is therefore observed even after the response timed out.
  const handledDelivery = delivery.then(
    value => ({ status: 'delivered' as const, value }),
    () => ({ status: 'failed' as const })
  )
  const timeout = sleep(timeoutMs).then(() => ({ status: 'timeout' as const }))
  return Promise.race([handledDelivery, timeout])
}

export async function ensureMinimumResponseDuration(
  startedAt: number,
  options: TimingOptions = {}
): Promise<void> {
  const minimumMs = Math.max(0, Math.min(options.minimumMs ?? LOGIN_RESPONSE_TARGET_MS, 30_000))
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
  const remaining = minimumMs - (now() - startedAt)
  if (remaining > 0) await sleep(remaining)
}
