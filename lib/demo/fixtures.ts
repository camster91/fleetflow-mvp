import type { Prisma } from '@prisma/client'
import { randomUUID, createHash } from 'crypto'
import { DEMO_ROLES, DEMO_DURATION_SECONDS } from './policy'
import { sampleInvoicePdf } from './sampleInvoice'

export async function seedDemoWorkspace(tx: Prisma.TransactionClient, now = new Date()) {
  const id = randomUUID()
  const users = await Promise.all(
    DEMO_ROLES.map((role, index) =>
      tx.user.create({
        data: {
          email: `${id}-${role.toLowerCase()}@demo.fleetvera.invalid`,
          name: ['Alex Morgan', 'Jordan Ellis', 'Sam Rivera', 'Taylor Brooks'][index],
          role,
          company: 'Maple Route Logistics · Demo',
          onboardingCompleted: true,
          emailVerified: now,
        },
      })
    )
  )
  const owner = users[0],
    driver = users[2]
  const team = await tx.team.create({
    data: { name: 'Maple Route Logistics · Demo', ownerId: owner.id, timeZone: 'America/Toronto' },
  })
  await tx.teamMember.createMany({
    data: users.map((user, index) => ({
      teamId: team.id,
      userId: user.id,
      role: DEMO_ROLES[index],
      status: 'ACCEPTED',
      joinedAt: now,
    })),
  })
  const scope = { ownerId: owner.id, teamId: team.id }
  const days = (offset: number) => new Date(now.getTime() + offset * 86_400_000)
  const names = [
    'Cedar Café',
    'Harbour Market',
    'Northside Office',
    'Maple Hotel',
    'Lakeshore Clinic',
    'Summit Warehouse',
  ]
  await tx.client.createMany({
    data: names.map((name, i) => ({
      ...scope,
      name,
      businessName: name,
      type: ['cafe', 'retail', 'office', 'hotel', 'institution', 'warehouse'][i],
      address: `${100 + i * 20} Example Avenue, Sample City`,
      email: `contact-${i}@example.invalid`,
      phone: `555-01${String(i).padStart(2, '0')}`,
      deliveryFrequency: 'weekly',
      parkingInstructions: 'Use the marked loading bay (sample instructions).',
      notes: 'Fictional customer for demonstration.',
    })),
  })
  const vehicles = await Promise.all(
    ['Sprinter 01', 'Transit 02', 'Cargo Van 03', 'Box Truck 04', 'Electric Van 05', 'Service Van 06'].map((name, i) =>
      tx.vehicle.create({
        data: {
          ...scope,
          name,
          status: i === 3 ? 'inactive' : 'active',
          driver: i < 3 ? driver.name : null,
          assignedDriverId: i < 3 ? driver.id : null,
          vehicleType: i === 3 ? 'truck' : 'van',
          licensePlate: `DEMO-${i + 1}`,
          year: 2022 + (i % 3),
          mileage: 14000 + i * 17500,
          fuelLevel: 90 - i * 12,
          location: 'Example Depot',
          maintenanceDue: i === 1 || i === 3,
          lastService: days(-30 - i * 5),
          nextService: days(i === 1 ? -2 : 7 + i),
        },
      })
    )
  )
  for (let i = 0; i < 24; i++) {
    const status = ['pending', 'in-transit', 'delivered', 'delivered', 'cancelled', 'pending'][i % 6]
    const delivery = await tx.delivery.create({
      data: {
        ...scope,
        customer: names[i % 6],
        address: `${100 + (i % 6) * 20} Example Avenue, Sample City`,
        status,
        items: 2 + (i % 8),
        vehicleId: vehicles[i % 3].id,
        driver: driver.name,
        assignedDriverId: driver.id,
        scheduledTime: days(i < 12 ? 0 : -1 - Math.floor(i / 6)),
        estimatedArrival: new Date(now.getTime() + ((i % 6) + 1) * 3600000),
        completedTime: status === 'delivered' ? days(-i % 4) : null,
        progress: status === 'delivered' ? 100 : status === 'in-transit' ? 55 : 0,
        notes: 'Sample delivery — try updating the status.',
        contactPerson: JSON.stringify({
          name: 'Sample Receiving Team',
          phone: '555-0100',
          email: 'receiving@example.invalid',
        }),
        parkingInstructions: 'Loading bay B',
        dropoffInstructions: 'Leave with the sample receiving team.',
      },
    })
    await tx.deliveryEvent.create({
      data: { deliveryId: delivery.id, status, notes: 'Demo delivery created', timestamp: days(i < 12 ? 0 : -2) },
    })
  }
  await tx.maintenanceTask.createMany({
    data: [
      'Oil and filter service',
      'Brake inspection',
      'Tire rotation',
      'Annual inspection',
      'Battery health check',
      'Completed oil service',
    ].map((title, i) => ({
      ...scope,
      title,
      type: title,
      vehicleId: vehicles[i].id,
      vehicleName: vehicles[i].name,
      dueDate: days(i === 0 ? -3 : i === 1 ? 0 : i + 2),
      priority: i < 2 ? 'high' : 'medium',
      completed: i === 5,
      completedDate: i === 5 ? days(-7) : null,
      actualCost: i === 5 ? 180 : null,
      costEstimate: [180, 320, 90, 250, 75, 180][i],
      serviceProvider: 'Example Fleet Service',
      estimatedDuration: '1 hour',
      notes: 'Sample service record. Costs are illustrative.',
    })),
  })
  await tx.sOPCategory.createMany({
    data: ['Daily vehicle checks', 'Safe deliveries', 'Emergency procedures'].map((name) => ({
      ...scope,
      name,
      description: 'Sample procedure category. Add and edit categories to explore the workflow.',
      documentCount: 0,
    })),
  })
  await tx.vendingMachine.createMany({
    data: ['Depot snack station', 'Office refreshment station'].map((name, i) => ({
      ...scope,
      name,
      location: i === 0 ? 'Example Depot' : 'Sample Office',
      status: 'active',
      machineType: 'snack',
      serialNumber: `DEMO-VM-${i}`,
      lastService: days(-10),
      nextService: days(7),
      notes: 'Fictional machine for exploring service operations.',
    })),
  })
  await tx.subscription.create({
    data: {
      userId: owner.id,
      plan: 'UNLIMITED',
      status: 'ACTIVE',
      currentPeriodStart: days(-10),
      currentPeriodEnd: days(20),
    },
  })
  await tx.invoice.create({
    data: {
      userId: owner.id,
      stripeInvoiceId: `demo-${id}`,
      amount: 4900,
      currency: 'USD',
      status: 'paid',
      periodStart: days(-40),
      periodEnd: days(-10),
    },
  })
  const extraction = {
    documentType: 'service_invoice',
    fields: {
      vendor: { value: 'Example Fleet Service', confidence: 1, citationIds: ['sample-1'] },
      vehicle: { value: vehicles[0].name, confidence: 1, citationIds: ['sample-1'] },
      total: { value: 180, confidence: 1, citationIds: ['sample-1'] },
    },
    services: [
      { description: 'Oil and filter service', quantity: 1, amount: 180, confidence: 1, citationIds: ['sample-1'] },
    ],
    parts: [],
    citations: [{ id: 'sample-1', page: 1, quote: 'SAMPLE: Oil and filter service for Sprinter 01. Total $180.' }],
    warnings: ['Preloaded fictional extraction. Uploads and external scanning are protected in this demo.'],
  }
  await tx.documentUpload.create({
    data: {
      ...scope,
      scopeKey: `team:${team.id}`,
      uploadedById: owner.id,
      uploadedBySnapshot: owner.email,
      originalName: 'Sample service invoice.pdf',
      mimeType: 'application/pdf',
      byteSize: sampleInvoicePdf().length,
      contentSha256: createHash('sha256').update(id).digest('hex'),
      storageKey: `demo/${id}`,
      status: 'EXTRACTED',
      scanStatus: 'CLEAN',
      extraction: JSON.stringify(extraction),
      expiresAt: days(1),
      extractedAt: now,
    },
  })
  await tx.expenseRecord.create({
    data: {
      ...scope,
      vehicleId: vehicles[0].id,
      vendor: 'Example Fleet Service',
      date: days(-7),
      category: 'maintenance',
      total: 180,
      description: 'Sample completed oil service',
    },
  })
  return tx.demoSession.create({
    data: {
      id,
      ownerId: owner.id,
      teamId: team.id,
      userIds: users.map((user) => user.id),
      expiresAt: new Date(now.getTime() + DEMO_DURATION_SECONDS * 1000),
    },
  })
}
