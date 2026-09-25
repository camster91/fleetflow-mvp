import fs from 'fs'
import path from 'path'

describe('administrator bootstrap entrypoints', () => {
  const rootBootstrap = fs.readFileSync(path.join(process.cwd(), 'create-admin.js'), 'utf8')
  const compatibilityBootstrap = fs.readFileSync(path.join(process.cwd(), 'scripts/create-admin.js'), 'utf8')

  it('keeps the authoritative bootstrap explicit and limited to an empty database', () => {
    expect(rootBootstrap).toContain('CONFIRM_ADMIN_BOOTSTRAP')
    expect(rootBootstrap).toContain('userCount !== 0')
    expect(rootBootstrap).toContain("role: 'admin'")
    expect(rootBootstrap).not.toContain('ADMIN_PASSWORD')
    expect(rootBootstrap).not.toContain('prisma db push')
  })

  it('makes the legacy path a wrapper instead of a second privilege implementation', () => {
    expect(compatibilityBootstrap).toContain("require('../create-admin.js')")
    expect(compatibilityBootstrap).not.toContain('ADMIN_PASSWORD')
    expect(compatibilityBootstrap).not.toContain('bcrypt')
    expect(compatibilityBootstrap).not.toContain('prisma db push')
    expect(compatibilityBootstrap).not.toContain('admin@fleetflow.com')
  })
})
