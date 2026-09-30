import { movePersonalWorkspaceIntoTeam } from '@/lib/teamWorkspace'

function fakeTx() {
  const calls: Array<{ model: string; args: { where: object; data: object } }> = []
  const tx = new Proxy(
    {},
    {
      get: (_target, model: string) => ({
        updateMany: jest.fn(async (args: { where: object; data: object }) => {
          calls.push({ model, args })
          return { count: 1 }
        }),
      }),
    }
  )
  return { tx, calls }
}

test('moves every personal-workspace record into the new team and re-keys scoped rows', async () => {
  const { tx, calls } = fakeTx()
  const moved = await movePersonalWorkspaceIntoTeam(tx as never, 'u1', 't1')
  const byModel = Object.fromEntries(calls.map((call) => [call.model, call.args]))

  for (const model of ['vehicle', 'delivery', 'maintenanceTask', 'client', 'sOPCategory', 'expenseRecord']) {
    expect(byModel[model]).toEqual({ where: { ownerId: 'u1', teamId: null }, data: { teamId: 't1' } })
  }
  for (const model of ['documentUpload', 'integrationConnection', 'aiWorkspaceConfig', 'pilotEvent']) {
    expect(byModel[model]).toEqual({
      where: { ownerId: 'u1', teamId: null },
      data: { teamId: 't1', scopeKey: 'team:t1' },
    })
  }
  for (const model of ['integrationRateLimit', 'aiControlAudit', 'aiTelemetryBucket']) {
    expect(byModel[model]).toEqual({ where: { scopeKey: 'owner:u1' }, data: { scopeKey: 'team:t1' } })
  }
  expect(Object.keys(moved)).toHaveLength(calls.length)
})

test('covers every model that retention deletes for a workspace', async () => {
  // lib/workspaceRetention.ts deleteOwnerWorkspaceData is the authoritative list of workspace data.
  const fs = await import('fs')
  const retention = fs.readFileSync(require.resolve('@/lib/workspaceRetention'), 'utf8')
  const deleted = [...retention.matchAll(/tx\.(\w+)\.deleteMany\(\{ where: scope \}\)/g)].map((match) => match[1])
  const { tx, calls } = fakeTx()
  await movePersonalWorkspaceIntoTeam(tx as never, 'u1', 't1')
  const movedModels = calls.map((call) => call.model)
  expect(deleted.length).toBeGreaterThan(10)
  for (const model of deleted) expect(movedModels).toContain(model)
})
