import { readFileSync } from 'fs'
import { join } from 'path'

const readRoute = (name: string) => readFileSync(join(process.cwd(), `pages/api/reports/${name}.ts`), 'utf8')

describe('report route resource controls', () => {
  it.each(['deliveries', 'maintenance'])('bounds %s analytics by date and row count', (name) => {
    const source = readRoute(name)

    expect(source).toContain('parseReportDateRange(req.query.startDate, req.query.endDate)')
    expect(source).toContain('take: REPORT_ROW_LIMIT')
    expect(source).toContain("res.setHeader('Cache-Control', 'private, no-store')")
  })

  it.each(['deliveries', 'maintenance', 'fleet', 'export'])(
    'rate limits %s reporting per authenticated user',
    (name) => {
      expect(readRoute(name)).toContain("rateLimitMiddleware(req, res, 'api', `reports:${session.user.id}`)")
    }
  )

  it('caps fleet materialization and keeps exports on the shared policy', () => {
    expect(readRoute('fleet')).toContain('take: REPORT_ROW_LIMIT')
    expect(readRoute('export')).toContain('parseReportDateRange(req.query.startDate, req.query.endDate)')
    expect(readRoute('export').match(/take: REPORT_ROW_LIMIT/g)).toHaveLength(3)
  })
})
