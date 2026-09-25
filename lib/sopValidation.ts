import { z } from 'zod'

export const sopCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(5000).nullable().optional(),
    count: z.number().int().nonnegative().max(1_000_000).optional(),
  })
  .passthrough()
