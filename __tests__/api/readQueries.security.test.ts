import { readFileSync } from 'fs'
import { join } from 'path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('cross-resource read API controls', () => {
  it('validates, scopes, throttles, and caps global search', () => {
    const source = read('pages/api/search.ts')

    expect(source).toContain('parseSearchTerm(req.query.q)')
    expect(source).toContain("rateLimitMiddleware(req, res, 'api', `search:${session.user.id}`)")
    expect(source.match(/tenant\.resourceWhere/g)).toHaveLength(4)
    expect(source.match(/take: 5/g)).toHaveLength(4)
    expect(source).toContain("res.setHeader('Cache-Control', 'private, no-store')")
  })

  it('validates and throttles activity while preserving audit scope', () => {
    const source = read('pages/api/activity/index.ts')

    expect(source).toContain('parseActivityFilters(req.query.limit, req.query.type)')
    expect(source).toContain("rateLimitMiddleware(req, res, 'api', `activity:${session.user.id}`)")
    expect(source).toContain('tenant.auditWhere')
    expect(source).toContain('metadata: parseAuditMetadata(log.metadata)')
    expect(source).toContain("res.setHeader('Cache-Control', 'private, no-store')")
  })
})
