import fs from 'fs'
import path from 'path'

describe('dashboard source encoding', () => {
  it('contains no replacement characters or common UTF-8 mojibake markers', () => {
    const files = ['pages/dashboard.tsx','pages/api/dashboard/context.ts','components/role-dashboards/CommandCentre.tsx','components/role-dashboards/AdminDashboard.tsx','components/role-dashboards/DispatchDashboard.tsx','components/role-dashboards/DriverDashboard.tsx','components/role-dashboards/MaintenanceDashboard.tsx']
    for (const file of files) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      expect(source).not.toMatch(/[\uFFFD]|â(?:€|™|œ|€¢)/)
    }
  })
})
