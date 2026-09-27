import { createMocks } from 'node-mocks-http'
jest.mock('@/lib/workspaceRetention', () => ({ runWorkspaceRetention: jest.fn() }))
import handler from '@/pages/api/cron/workspace-retention'
import { runWorkspaceRetention } from '@/lib/workspaceRetention'

const secret = 'r'.repeat(32)

async function post(headers: Record<string, string>, method = 'POST') {
  const { req, res } = createMocks({ method: method as never, headers })
  await handler(req as never, res as never)
  return res
}

describe('POST /api/cron/workspace-retention', () => {
  const original = process.env.CRON_SECRET
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = secret
  })
  afterAll(() => {
    process.env.CRON_SECRET = original
  })

  it('rejects GET and unauthorized calls before doing anything', async () => {
    expect((await post({ 'x-cron-secret': secret }, 'GET'))._getStatusCode()).toBe(405)
    expect((await post({ 'x-cron-secret': 'nope'.repeat(8) }))._getStatusCode()).toBe(401)
    expect(runWorkspaceRetention).not.toHaveBeenCalled()
  })

  it('returns the run summary', async () => {
    const summary = { enforced: true, dryRun: true, scanned: 3, errors: 0, actions: [] }
    ;(runWorkspaceRetention as jest.Mock).mockResolvedValue(summary)
    const res = await post({ 'x-cron-secret': secret })
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual(summary)
  })

  it('is a no-op while plans are not enforced', async () => {
    ;(runWorkspaceRetention as jest.Mock).mockResolvedValue({ enforced: false })
    const res = await post({ authorization: `Bearer ${secret}` })
    expect(res._getJSONData()).toEqual({ enforced: false })
  })

  it('returns 500 when any owner failed, so monitoring alerts', async () => {
    ;(runWorkspaceRetention as jest.Mock).mockResolvedValue({ enforced: true, errors: 1 })
    expect((await post({ 'x-cron-secret': secret }))._getStatusCode()).toBe(500)
  })

  it('hides internal errors', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(runWorkspaceRetention as jest.Mock).mockRejectedValue(new Error('db down'))
    const res = await post({ 'x-cron-secret': secret })
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Workspace retention failed' })
  })
})
