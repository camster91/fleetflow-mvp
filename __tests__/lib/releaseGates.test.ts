import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

describe('release quality gates', () => {
  test('customer-facing product identity is consistently Fleetvera', () => {
    const brandedFiles = [
      'components/ui/Logo.tsx',
      'components/layouts/AuthLayout.tsx',
      'components/onboarding/OnboardingModal.tsx',
      'pages/index.tsx',
      'pages/_app.tsx',
      'pages/_document.tsx',
      'public/manifest.json',
    ]

    for (const file of brandedFiles) {
      const source = fs.readFileSync(path.join(root, file), 'utf8')
      expect(source).toContain('Fleetvera')
      expect(source).not.toMatch(/FleetFlow|Fleet Manager/)
    }

    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8')
    ) as { name?: string; short_name?: string; description?: string; theme_color?: string }

    expect(manifest.name).toBe('Fleetvera - Fleet Operations')
    expect(manifest.short_name).toBe('Fleetvera')
    expect(manifest.description).toContain('organized')
    expect(manifest.theme_color).toBe('#123C36')
  })

  test('reports controls remain usable without widening a mobile viewport', () => {
    const reports = fs.readFileSync(path.join(root, 'pages/reports.tsx'), 'utf8')

    expect(reports).toContain('overflow-x-auto')
    expect(reports).toContain('min-w-max')
    expect(reports).toContain('flex-col sm:flex-row')
    expect(reports).toContain('role="tablist"')
    expect(reports).toContain('aria-selected={activeTab === key}')
  })

  test('network status starts with the same value on server and client', () => {
    const performanceHook = fs.readFileSync(path.join(root, 'lib/performance.ts'), 'utf8')

    expect(performanceHook).toContain('useState(true)')
    expect(performanceHook).toContain('setIsOnline(navigator.onLine)')
    expect(performanceHook).not.toContain("typeof navigator === 'undefined' ? true : navigator.onLine")
  })

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

  test('Compose requires explicit database credentials without publishing PostgreSQL', () => {
    const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8')
    const postgres = compose.split('\n  postgres:\n')[1]?.split('\nvolumes:')[0] || ''
    const exampleEnv = fs.readFileSync(path.join(root, '.env.example'), 'utf8')
    const requiredKey = ['POSTGRES', 'PASSWORD'].join('_')
    const settingLines = postgres
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith(requiredKey))

    expect(settingLines).toHaveLength(1)
    expect(settingLines[0]).toContain(':?Set ')
    expect(postgres).not.toMatch(/\n\s+ports:/)
    expect(compose).toContain('condition: service_healthy')
    expect(exampleEnv).toMatch(/^DATABASE_URL=$/m)
    expect(exampleEnv).toMatch(new RegExp(`^${requiredKey}=$`, 'm'))
  })

  test('production startup verifies an explicit release mode before migrations', () => {
    const entrypoint = fs.readFileSync(path.join(root, 'entrypoint.sh'), 'utf8')
    const verifier = 'node ./verify-production-readiness.cjs'
    const migration = 'npx prisma migrate deploy'

    expect(entrypoint).toContain('FLEETVERA_RELEASE_MODE must be explicitly set to pilot or public')
    expect(entrypoint).toContain('pilot|public)')
    expect(entrypoint).toContain(verifier)
    expect(entrypoint).toContain(migration)
    expect(entrypoint.indexOf(verifier)).toBeLessThan(entrypoint.indexOf(migration))
    expect(entrypoint).not.toMatch(/FLEETVERA_RELEASE_MODE[^\n]*:-pilot/)

    const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8')
    expect(compose).toContain('FLEETVERA_RELEASE_MODE=${FLEETVERA_RELEASE_MODE:?Set FLEETVERA_RELEASE_MODE to pilot or public}')

    const exampleEnv = fs.readFileSync(path.join(root, '.env.example'), 'utf8')
    expect(exampleEnv).toMatch(/^FLEETVERA_RELEASE_MODE=pilot$/m)
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
