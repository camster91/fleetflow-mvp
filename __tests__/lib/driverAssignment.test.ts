import { resolveDriverAssignment } from '../../lib/driverAssignment'
describe('stable driver assignment', () => {
  const findFirst = jest.fn()
  const db = { user: { findFirst } }
  beforeEach(() => jest.clearAllMocks())
  it('resolves an accepted driver by stable id inside the team', async () => {
    findFirst.mockResolvedValue({ id: 'd1', name: 'Driver One' })
    expect(await resolveDriverAssignment(db, { ownerId: 'o1', teamId: 't1' }, 'd1')).toEqual({
      assignedDriverId: 'd1',
      driver: 'Driver One',
    })
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'd1' }) }))
  })
  it('clears both stable id and snapshot together', async () =>
    expect(await resolveDriverAssignment(db, { ownerId: 'o1', teamId: 't1' }, null)).toEqual({
      assignedDriverId: null,
      driver: null,
    }))
  it('rejects unresolved and cross-personal-scope ids', async () => {
    findFirst.mockResolvedValue(null)
    await expect(resolveDriverAssignment(db, { ownerId: 'o1', teamId: 't1' }, 'd2')).rejects.toThrow('INVALID')
    await expect(resolveDriverAssignment(db, { ownerId: 'o1', teamId: null }, 'd2')).rejects.toThrow('INVALID')
  })
})
