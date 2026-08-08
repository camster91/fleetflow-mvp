import { z } from 'zod'

export const deliveryStatusTransitionSchema = z.object({
  status: z.enum(['pending', 'picked-up', 'in-transit', 'delivered', 'failed', 'cancelled']),
  notes: z.string().max(2000).optional(),
}).strict()

type CurrentDeliveryState = {
  status: string
  notes: string | null
  progress: number
  completedTime: Date | null
}

export function applyDeliveryStatusTransition(
  current: CurrentDeliveryState,
  values: z.infer<typeof deliveryStatusTransitionSchema>,
  now: Date,
) {
  const progress = values.status === 'delivered' ? 100 : values.status === 'in-transit' ? 50 : values.status === 'picked-up' ? 25 : values.status === 'pending' ? 0 : current.progress
  return {
    fields: {
      status: values.status,
      notes: values.notes ?? current.notes,
      progress,
      completedTime: values.status === 'delivered' ? now : current.completedTime,
    },
    event: { status: values.status, notes: values.notes ?? null },
  }
}
