/**
 * Shared Zod schemas for API request validation.
 */
import { z } from 'zod'
import { deliveryStatusTransitionSchema } from '@/lib/deliveryTransitions'

export const cuidLike = z.string().min(1).max(64)

export const emailSchema = z
  .string()
  .email()
  .max(254)
  .transform((e) => e.toLowerCase().trim())

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const vehicleStatusSchema = z.enum(['active', 'inactive', 'delayed'])

export const vehicleBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    status: vehicleStatusSchema.optional(),
    driver: z.string().max(120).nullable().optional(),
    assignedDriverId: z.string().trim().min(1).max(64).nullable().optional(),
    location: z.string().max(240).nullable().optional(),
    mileage: z.number().nonnegative().nullable().optional(),
    vehicleType: z.string().max(80).nullable().optional(),
    licensePlate: z.string().max(40).nullable().optional(),
  })
  .passthrough()

export const clientBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    address: z.string().max(500).optional(),
    type: z.string().max(80).optional(),
    businessName: z.string().max(200).nullable().optional(),
    email: z.string().email().max(254).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
  })
  .passthrough()

const vendingDateSchema = z
  .string()
  .max(40)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date')

const vendingMachineFields = {
  name: z.string().trim().min(1).max(120).optional(),
  location: z.string().trim().min(1).max(240).optional(),
  status: z.enum(['active', 'maintenance', 'out-of-service']).optional(),
  type: z.enum(['snacks', 'beverages', 'combo', 'coffee', 'fresh-food', 'other']).optional(),
  machineType: z.string().trim().max(80).nullable().optional(),
  serialNumber: z.string().trim().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  lastService: vendingDateSchema.nullable().optional(),
  nextService: vendingDateSchema.nullable().optional(),
  driverNotes: z
    .array(
      z.object({
        id: z.string().max(64),
        text: z.string().max(2000),
        author: z.string().max(120),
        timestamp: vendingDateSchema,
        type: z.enum(['maintenance', 'inventory', 'general']).optional(),
        priority: z.enum(['low', 'normal', 'high']).optional(),
      })
    )
    .max(200)
    .optional(),
}

export const vendingMachineBodySchema = z.object(vendingMachineFields).passthrough()
export const vendingMachineCreateSchema = z
  .object({
    ...vendingMachineFields,
    name: z.string().trim().min(1).max(120),
    location: z.string().trim().min(1).max(240),
  })
  .passthrough()

const safeAnnouncementUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (value.startsWith('/') && !value.startsWith('//')) return true
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  }, 'Invalid action URL')

const announcementExpirySchema = z
  .string()
  .max(40)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid expiry date')

export const announcementBodySchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    type: z.enum(['system', 'maintenance', 'delivery', 'general']).optional(),
    category: z.string().trim().max(80).nullable().optional(),
    expiresAt: announcementExpirySchema.nullable().optional(),
    actionUrl: safeAnnouncementUrl.nullable().optional(),
    actionLabel: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .passthrough()

export const maintenanceBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    type: z.string().max(80).optional(),
    vehicle: z.string().max(120).optional(),
    vehicleId: z.string().max(64).nullable().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    completed: z.boolean().optional(),
    costEstimate: z.number().nonnegative().nullable().optional(),
    serviceProvider: z.string().max(200).nullable().optional(),
  })
  .passthrough()

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Invalid calendar date')

/** Exact create contract shared by the maintenance UI/API and suggested actions. */
export const maintenanceCreateValuesSchema = z
  .object({
    vehicle: z.string().trim().min(1).max(120),
    type: z.string().trim().min(1).max(200),
    dueDate: dateOnlySchema,
    priority: z.enum(['low', 'medium', 'high']),
    notes: z.string().max(2000).optional(),
    estimatedDuration: z.string().max(100).optional(),
    partsNeeded: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    serviceProvider: z.string().max(200).optional(),
    costEstimate: z.number().nonnegative().max(10_000_000).optional(),
  })
  .strict()

/** Exact document-reviewed operating expense contract. Amounts are in workspace currency units. */
export const expenseCreateValuesSchema = z
  .object({
    vehicleId: cuidLike,
    vendor: z.string().trim().min(1).max(200),
    date: dateOnlySchema,
    category: z.enum(['maintenance', 'inspection', 'parts', 'other']),
    subtotal: z.number().nonnegative().max(100_000_000).optional(),
    tax: z.number().nonnegative().max(100_000_000).optional(),
    total: z.number().nonnegative().max(100_000_000),
    description: z.string().trim().min(1).max(2000),
  })
  .strict()

/** Exact status-update contract shared by the delivery status API and actions. */
export const deliveryStatusUpdateSchema = deliveryStatusTransitionSchema.extend({
  status: z.enum(['pending', 'in-transit', 'delivered', 'cancelled']),
})

export const vehicleEditPrefillSchema = z
  .object({
    status: vehicleStatusSchema.optional(),
    mileage: z.number().int().nonnegative().max(10_000_000).optional(),
  })
  .strict()
export const deliveryEditPrefillSchema = deliveryStatusUpdateSchema.partial().strict()

export const teamInviteSchema = z.object({
  teamId: cuidLike,
  emails: z.array(emailSchema).min(1).max(20),
  role: z.enum(['ADMIN', 'MANAGER', 'DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER']).optional(),
  message: z.string().max(1000).optional(),
})

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): { data: T } | { error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const msg = result.error.issues[0]?.message || 'Invalid request'
    return { error: msg }
  }
  return { data: result.data }
}

export function parseQuery<T>(schema: z.ZodType<T>, query: unknown): { data: T } | { error: string } {
  return parseBody(schema, query)
}
