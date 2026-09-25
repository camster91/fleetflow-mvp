import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import {
  assessDataQuality,
  type DataQualityEntityType,
  type DataQualityRecords,
  type DataQualitySeverity,
} from '@/lib/intelligence/dataQuality'

export const DATA_QUALITY_SOURCE_LIMIT = 500
export const DATA_QUALITY_ISSUE_LIMIT = 100

const vehicleSelect = {
  id: true,
  status: true,
  mileage: true,
  driver: true,
  lastService: true,
  nextService: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
} as const
const deliverySelect = {
  id: true,
  status: true,
  vehicleId: true,
  driver: true,
  scheduledTime: true,
  estimatedArrival: true,
  contactPerson: true,
  updatedAt: true,
} as const
const maintenanceSelect = {
  id: true,
  completed: true,
  dueDate: true,
  vehicleId: true,
  costEstimate: true,
  actualCost: true,
  updatedAt: true,
} as const
const clientSelect = {
  id: true,
  phone: true,
  email: true,
  contactPerson: true,
  updatedAt: true,
} as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const context = await requireTenantContext(req, res)
  if (!context) return

  // Keep this internal dashboard assessment consistent with the existing
  // resource APIs: selected teams include their owner's legacy null-team rows.
  // Public API keys remain exact-team scoped. This compatibility scope can be
  // tightened only after an explicit legacy-row backfill/migration.
  const where = context.tenant.resourceWhere
  const take = DATA_QUALITY_SOURCE_LIMIT + 1

  try {
    const [vehicleRows, deliveryRows, maintenanceRows, clientRows] = await Promise.all([
      prisma.vehicle.findMany({ where, select: vehicleSelect, orderBy: { id: 'asc' }, take }),
      prisma.delivery.findMany({ where, select: deliverySelect, orderBy: { id: 'asc' }, take }),
      prisma.maintenanceTask.findMany({ where, select: maintenanceSelect, orderBy: { id: 'asc' }, take }),
      prisma.client.findMany({ where, select: clientSelect, orderBy: { id: 'asc' }, take }),
    ])

    const sourceTruncated = [vehicleRows, deliveryRows, maintenanceRows, clientRows].some(
      (rows) => rows.length > DATA_QUALITY_SOURCE_LIMIT
    )
    const records: DataQualityRecords = {
      vehicles: vehicleRows.slice(0, DATA_QUALITY_SOURCE_LIMIT),
      deliveries: deliveryRows.slice(0, DATA_QUALITY_SOURCE_LIMIT),
      maintenance: maintenanceRows.slice(0, DATA_QUALITY_SOURCE_LIMIT),
      clients: clientRows.slice(0, DATA_QUALITY_SOURCE_LIMIT),
    }
    const allScannedIssues = assessDataQuality(records)
    const issueTruncated = allScannedIssues.length > DATA_QUALITY_ISSUE_LIMIT
    const issues = allScannedIssues.slice(0, DATA_QUALITY_ISSUE_LIMIT)

    const bySeverity: Record<DataQualitySeverity, number> = { high: 0, medium: 0, low: 0 }
    const byEntity: Record<DataQualityEntityType, number> = {
      vehicle: 0,
      delivery: 0,
      maintenance: 0,
      client: 0,
    }
    for (const issue of allScannedIssues) {
      bySeverity[issue.severity] += 1
      byEntity[issue.entityType] += 1
    }

    return res.status(200).json({
      issues,
      summary: {
        total: allScannedIssues.length,
        bySeverity,
        byEntity,
        // Issue counts include every scanned record, even when the display list
        // is capped. They are workspace-complete only if no source was capped.
        countsComplete: !sourceTruncated,
      },
      coverage: {
        complete: !sourceTruncated && !issueTruncated,
        sourceTruncated,
        issuesTruncated: issueTruncated,
        sourceLimitPerEntity: DATA_QUALITY_SOURCE_LIMIT,
        issueLimit: DATA_QUALITY_ISSUE_LIMIT,
        recordsScannedByEntity: {
          vehicle: records.vehicles.length,
          delivery: records.deliveries.length,
          maintenance: records.maintenance.length,
          client: records.clients.length,
        },
        issuesReturned: issues.length,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch {
    console.error('Data quality assessment failed')
    return res.status(500).json({ error: 'Unable to assess data quality' })
  }
}
