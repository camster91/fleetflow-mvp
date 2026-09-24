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

const deliveryStatuses = deliveryStatusTransitionSchema.shape.status
const shortText = z.string().max(500)
const longText = z.string().max(2000)
// Optional text, date, and list fields accept null to clear them (deliveryToDb
// stores falsy values as null). Empty strings clear a date; anything else must parse so Prisma never sees an Invalid Date.
const dateText = z.string().max(64).refine((value) => value === '' || !Number.isNaN(Date.parse(value)), 'Invalid date')
const location = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: shortText.optional(),
  notes: longText.optional(),
}).strict()

/**
 * Body accepted by PUT /api/deliveries/[id]. Every field is optional because
 * status controls submit partial records; unknown keys are rejected. `id` and
 * `driver` are tolerated for clients that echo a full Delivery back, but the
 * route derives both from the URL and the driver assignment.
 */
export const deliveryUpdateSchema = z.object({
  id: z.string().max(100).optional(),
  customer: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  status: deliveryStatuses.optional(),
  driver: z.string().max(200).optional(),
  assignedDriverId: z.string().max(100).nullable().optional(),
  items: z.number().int().min(0).max(100000).optional(),
  progress: z.number().min(0).max(100).optional(),
  notes: longText.nullable().optional(),
  scheduledTime: dateText.nullable().optional(),
  estimatedArrival: dateText.nullable().optional(),
  completedTime: dateText.nullable().optional(),
  parkingLocation: location.nullable().optional(),
  dropoffLocation: location.nullable().optional(),
  parkingInstructions: longText.nullable().optional(),
  dropoffInstructions: longText.nullable().optional(),
  contactPerson: z.object({
    name: z.string().max(200),
    phone: z.string().max(50).optional(),
    email: z.string().max(254).optional(),
    department: z.string().max(200).optional(),
    availability: z.string().max(200).optional(),
  }).strict().nullable().optional(),
  photos: z.array(z.object({
    id: z.string().max(100),
    url: z.string().max(2048),
    caption: shortText.optional(),
    timestamp: z.string().max(64),
    uploadedBy: z.string().max(200),
  }).strict()).max(50).nullable().optional(),
  accessCodes: z.array(z.string().max(100)).max(50).nullable().optional(),
  securityNotes: longText.nullable().optional(),
  businessHours: shortText.nullable().optional(),
  specialRequirements: z.array(shortText).max(50).nullable().optional(),
}).strict()

export type DeliveryUpdateInput = z.infer<typeof deliveryUpdateSchema>
