import { applyDeliveryStatusTransition, deliveryStatusTransitionSchema } from '@/lib/deliveryTransitions'

describe('canonical delivery status transitions', () => {
  const current = { status: 'pending', notes: 'Old', progress: 10, completedTime: null as Date | null }
  it('sets delivered progress, completion time, notes and event consistently', () => { const now = new Date('2026-08-08T12:00:00Z'); expect(applyDeliveryStatusTransition(current, { status: 'delivered', notes: 'Done' }, now)).toEqual({ fields: { status: 'delivered', notes: 'Done', progress: 100, completedTime: now }, event: { status: 'delivered', notes: 'Done' } }) })
  it('sets in-transit progress and preserves completion/notes when omitted', () => { expect(applyDeliveryStatusTransition(current, { status: 'in-transit' }, new Date(0))).toEqual({ fields: { status: 'in-transit', notes: 'Old', progress: 50, completedTime: null }, event: { status: 'in-transit', notes: null } }) })
  it.each(['picked-up', 'failed', 'delayed'])('accepts only normal product status %s', status => expect(deliveryStatusTransitionSchema.safeParse({ status }).success).toBe(status !== 'delayed'))
  it('maps picked-up to 25 percent and failed without inventing progress', () => {
    expect(applyDeliveryStatusTransition(current, { status: 'picked-up' }, new Date()).fields.progress).toBe(25)
    expect(applyDeliveryStatusTransition({ ...current, progress: 75 }, { status: 'failed' }, new Date()).fields.progress).toBe(75)
  })
})
