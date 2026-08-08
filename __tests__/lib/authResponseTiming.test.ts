import { awaitEmailDeliveryWithinTimeout, ensureMinimumResponseDuration } from '@/lib/authResponseTiming'

it('waits only for the bounded remainder of the minimum response duration', async () => {
  const sleep = jest.fn(async () => undefined)
  await ensureMinimumResponseDuration(1_000, { minimumMs: 250, now: () => 1_100, sleep })
  expect(sleep).toHaveBeenCalledWith(150)
})

it('bounds a never-settling provider operation at the configured timeout', async () => {
  const never = new Promise<never>(() => undefined)
  const result = await awaitEmailDeliveryWithinTimeout(never, {
    timeoutMs: 10,
    sleep: async milliseconds => expect(milliseconds).toBe(10),
  })
  expect(result).toEqual({ status: 'timeout' })
})

it('returns a provider result that settles inside the delivery window', async () => {
  const result = await awaitEmailDeliveryWithinTimeout(Promise.resolve({ success: true }), {
    timeoutMs: 10,
    sleep: () => new Promise(() => undefined),
  })
  expect(result).toEqual({ status: 'delivered', value: { success: true } })
})

it('turns rejection into a handled sanitized delivery result', async () => {
  const result = await awaitEmailDeliveryWithinTimeout(Promise.reject(new Error('raw secret')), {
    timeoutMs: 10,
    sleep: () => new Promise(() => undefined),
  })
  expect(result).toEqual({ status: 'failed' })
})

it('does not wait after the minimum duration has elapsed', async () => {
  const sleep = jest.fn(async () => undefined)
  await ensureMinimumResponseDuration(1_000, { minimumMs: 250, now: () => 1_400, sleep })
  expect(sleep).not.toHaveBeenCalled()
})
