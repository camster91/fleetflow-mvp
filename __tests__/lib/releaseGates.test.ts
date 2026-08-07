import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

describe('release quality gates', () => {
  test('package scripts expose deterministic type and CI checks', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> }

    expect(packageJson.scripts?.typecheck).toBe('tsc --noEmit')
    expect(packageJson.scripts?.['test:ci']).toContain('--runInBand')
    expect(packageJson.scripts?.['test:ci']).toContain('--detectOpenHandles')
    expect(packageJson.scripts?.lint).toBe('eslint .')
    expect(packageJson.scripts?.audit).toBe('npm audit --audit-level=high')
    expect(packageJson.scripts?.ci).toContain('npm run audit')
    expect(packageJson.scripts?.ci).toContain('npm run typecheck')
    expect(packageJson.scripts?.ci).toContain('npm run test:ci')
    expect(packageJson.scripts?.ci).toContain('npm run build')
    expect(packageJson.scripts?.['db:push']).toBeUndefined()
    expect(packageJson.scripts?.['build:full']).toBeUndefined()
    expect(JSON.stringify(packageJson.scripts)).not.toContain('--accept-data-loss')
  })

  test('production builds do not suppress TypeScript errors', () => {
    const nextConfig = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8')

    expect(nextConfig).not.toContain('ignoreBuildErrors')
    expect(nextConfig).not.toContain("'unsafe-eval'")
  })

  test('Edge middleware uses an Edge-compatible JWT verifier', () => {
    const middleware = fs.readFileSync(path.join(root, 'proxy.ts'), 'utf8')

    expect(fs.existsSync(path.join(root, 'middleware.ts'))).toBe(false)
    expect(middleware).not.toMatch(/from ['"]jsonwebtoken['"]/)
    expect(middleware).toMatch(/jwtVerify/)
    expect(middleware).not.toContain("pathname.startsWith('/api/auth/')")
  })

  test('custom cookie authentication has no unsupported NextAuth catch-all route', () => {
    expect(fs.existsSync(path.join(root, 'pages/api/auth/[...nextauth].ts'))).toBe(false)
  })

  test('does not ship the obsolete raw-SQL sync persistence endpoint', () => {
    expect(fs.existsSync(path.join(root, 'pages/api/sync-data.ts'))).toBe(false)
  })

  test('does not ship the non-functional admin impersonation surface', () => {
    const adminUsers = fs.readFileSync(
      path.join(root, 'components/AdminUserManagement.tsx'),
      'utf8'
    )

    expect(adminUsers).not.toMatch(/impersonat/i)
    expect(fs.existsSync(path.join(root, 'pages/api/admin/impersonate.ts'))).toBe(false)
  })

  test('Jest ignores generated Next.js output during module discovery', () => {
    const jestConfigPath = path.join(root, 'jest.config.js')
    const jestConfig = fs.readFileSync(jestConfigPath, 'utf8')
    const parsedConfig = require(jestConfigPath) as {
      modulePathIgnorePatterns?: string[]
      projects?: Array<{ modulePathIgnorePatterns?: string[] }>
    }

    expect(jestConfig).toContain('modulePathIgnorePatterns')
    expect(jestConfig).toContain("'<rootDir>/.next/'")
    expect(parsedConfig.modulePathIgnorePatterns).toContain('<rootDir>/.next/')
    expect(parsedConfig.projects?.every((project) =>
      project.modulePathIgnorePatterns?.includes('<rootDir>/.next/')
    )).toBe(true)
  })

  test('Docker normalizes the Windows entrypoint before execution', () => {
    const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8')

    expect(dockerfile).toContain("sed -i 's/\\r$//' entrypoint.sh")
    expect(dockerfile).toContain('chmod 755 entrypoint.sh')
    expect(dockerfile).toContain('/app/create-admin.js ./create-admin.js')
  })

  test('passwordless auth does not ship obsolete password and verification routes', () => {
    const obsoleteRoutes = [
      'pages/api/auth/change-password.ts',
      'pages/api/auth/forgot-password.ts',
      'pages/api/auth/reset-password.ts',
      'pages/api/auth/resend-verification.ts',
      'pages/api/auth/verify-email.ts',
      'pages/auth/forgot-password.tsx',
      'pages/auth/reset-password/[token].tsx',
      'pages/auth/verify-email/[token].tsx',
    ]

    expect(obsoleteRoutes.every((route) => !fs.existsSync(path.join(root, route)))).toBe(true)
    expect(fs.existsSync(path.join(root, 'create-admin.js'))).toBe(true)
  })

  test('does not publish placeholder subscription endpoints', () => {
    expect(fs.existsSync(path.join(root, 'pages/api/stripe/customer-portal.ts'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'pages/api/subscription/trial-start.ts'))).toBe(false)
  })

  test('CI is singular, mandatory, and production deployment is manual', () => {
    const workflows = path.join(root, '.github/workflows')
    const ci = fs.readFileSync(path.join(workflows, 'ci.yml'), 'utf8')
    const deploy = fs.readFileSync(path.join(workflows, 'deploy-coolify.yml'), 'utf8')

    expect(fs.existsSync(path.join(workflows, 'lint.yml'))).toBe(false)
    expect(fs.existsSync(path.join(workflows, 'deploy.yml'))).toBe(false)
    expect(fs.existsSync(path.join(workflows, 'build-and-push.yml'))).toBe(false)
    expect(ci).toContain('npm ci')
    expect(ci).toContain('npm run ci')
    expect(ci).not.toContain('continue-on-error')
    expect(deploy).toContain('workflow_dispatch:')
    expect(deploy).not.toMatch(/\n\s+push:/)
    expect(deploy).toContain('environment: production')
    expect(deploy).toContain('actions: read')
    expect(deploy).toContain('actions/workflows/ci.yml/runs')
    expect(deploy).toContain('conclusion == "success"')
  })
})
