import { mergeDeliveryUpdate, mergeMaintenanceUpdate } from '../../lib/fleet'

describe('partial record updates', () => {
  it('preserves delivery item count when only status changes', () => {
    const existing = {
      id: 'd1', ownerId: 'u1', teamId: null, customer: 'Acme', address: '1 Main',
      status: 'pending', driver: 'Sam', items: 4, progress: 0, notes: null,
      scheduledTime: null, estimatedArrival: null, completedTime: null,
      parkingLocation: null, dropoffLocation: null, parkingInstructions: null,
      dropoffInstructions: null, contactPerson: null, photos: null, accessCodes: null,
      securityNotes: null, businessHours: null, specialRequirements: null,
      createdAt: new Date(), updatedAt: new Date(),
    }

    expect(mergeDeliveryUpdate(existing as never, { status: 'delivered', progress: 100 })).toMatchObject({
      customer: 'Acme', items: 4, status: 'delivered', progress: 100,
    })
  })

  it('preserves maintenance fields when only completion changes', () => {
    const existing = {
      id: 'm1', ownerId: 'u1', teamId: null, title: 'Oil change', type: 'Oil change',
      vehicleName: 'Van 1', vehicleId: null, dueDate: new Date('2026-08-15T12:00:00Z'),
      priority: 'medium', completed: false, completedDate: null, notes: null,
      estimatedDuration: null, partsNeeded: null, serviceProvider: null, costEstimate: 89.5,
      createdAt: new Date(), updatedAt: new Date(),
    }

    expect(mergeMaintenanceUpdate(existing as never, { completed: true, completedDate: '2026-08-08' })).toMatchObject({
      type: 'Oil change', vehicle: 'Van 1', dueDate: '2026-08-15', completed: true,
    })
  })
})
