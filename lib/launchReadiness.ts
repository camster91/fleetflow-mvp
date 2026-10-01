/**
 * Live go-live checks for /admin/launch. Details are setting names, statuses, dates and the
 * non-secret alert address and Mailgun domain; no secret value is ever returned.
 */
import { prisma } from '@/lib/prisma'
import { configuredMailgun } from '@/lib/emailConfig'
import { isAdminValue } from '@/lib/platformSettings'
import { burnedSecretNames, evaluateEnvironment } from '@/scripts/verify-production-readiness.cjs'

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface LaunchCheck {
  id: string
  label: string
  status: CheckStatus
  detail: string
  /** Individual problems, e.g. each missing setting. */
  items?: string[]
  /** GitHub issue that tracks this item. */
  issue?: number
  action?: { href: string; label: string }
}

export const OPS_RECORD_KINDS = ['backup_drill', 'restore_drill', 'monitoring_test', 'go_no_go'] as const
export type OpsRecordKind = (typeof OPS_RECORD_KINDS)[number]

const DAY_MS = 24 * 60 * 60 * 1000
export const EVIDENCE_MAX_AGE_DAYS: Record<Exclude<OpsRecordKind, 'go_no_go'>, number> = {
  backup_drill: 7,
  restore_drill: 90,
  monitoring_test: 90,
}

const BILLING_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_MONTHLY',
  'STRIPE_PRICE_YEARLY',
  'STRIPE_PRICE_MONTHLY_AMOUNT',
  'STRIPE_PRICE_YEARLY_AMOUNT',
  'STRIPE_PRICE_CURRENCY',
]

const present = (env: NodeJS.ProcessEnv, key: string) => Boolean(env[key]?.trim())
const day = (date: Date) => date.toISOString().slice(0, 10)

export function releaseMode(env: NodeJS.ProcessEnv = process.env): string {
  return env.FLEETVERA_RELEASE_MODE?.trim() || 'pilot'
}

interface EvidenceRow {
  outcome: string
  performedAt: Date
  recordedByName: string | null
}

export function evidenceCheck(
  id: string,
  label: string,
  kind: Exclude<OpsRecordKind, 'go_no_go'>,
  latest: EvidenceRow | null,
  now: Date
): LaunchCheck {
  const maxAge = EVIDENCE_MAX_AGE_DAYS[kind]
  const base = { id, label, issue: 72, action: { href: '#record-evidence', label: 'Record evidence' } }
  if (!latest) return { ...base, status: 'fail', detail: 'Nothing recorded yet.' }
  if (latest.outcome !== 'pass')
    return { ...base, status: 'fail', detail: `The latest one, on ${day(latest.performedAt)}, failed.` }
  const ageDays = Math.floor((now.getTime() - latest.performedAt.getTime()) / DAY_MS)
  const detail = `Passed on ${day(latest.performedAt)}${latest.recordedByName ? ` (${latest.recordedByName})` : ''}.`
  return ageDays > maxAge
    ? { ...base, status: 'warn', detail: `${detail} Older than ${maxAge} days: repeat it.` }
    : { ...base, status: 'pass', detail }
}

function secretsCheck(env: NodeJS.ProcessEnv): LaunchCheck {
  const burned: string[] = burnedSecretNames(env)
  return burned.length
    ? {
        id: 'leaked-secrets',
        label: 'Leaked secrets replaced',
        status: 'fail',
        issue: 30,
        detail:
          'These settings still use a value that was committed to the repository. Generate new values in Coolify and redeploy. Before changing JWT_SECRET, set TOKEN_ENCRYPTION_KEY to its current value so 2FA keeps working.',
        items: burned,
      }
    : {
        id: 'leaked-secrets',
        label: 'Leaked secrets replaced',
        status: 'pass',
        issue: 30,
        detail: 'No setting uses a value from the repository history.',
      }
}

function preflightCheck(env: NodeJS.ProcessEnv, mode: string): LaunchCheck {
  const result: { missing: string[]; warnings: string[] } = evaluateEnvironment(env, mode)
  // Leaked values have their own check above.
  const missing = result.missing.filter((item) => !item.includes('leaked value'))
  const label = 'Server configuration'
  if (missing.length)
    return {
      id: 'preflight',
      label,
      status: 'fail',
      detail: 'Fix these in the Coolify environment (or in Platform settings where offered) and redeploy.',
      items: missing,
      action: { href: '/admin/settings', label: 'Platform settings' },
    }
  if (result.warnings.length)
    return {
      id: 'preflight',
      label,
      status: 'warn',
      detail: 'Ready, with warnings.',
      items: result.warnings,
      action: { href: '/admin/settings', label: 'Platform settings' },
    }
  return { id: 'preflight', label, status: 'pass', detail: `Every required setting for ${mode} mode is valid.` }
}

async function emailCheck(): Promise<LaunchCheck> {
  const base = {
    id: 'email',
    label: 'Transactional email',
    issue: 70,
    action: { href: '/admin/email-delivery', label: 'Email delivery' },
  }
  try {
    const config = await configuredMailgun()
    return config
      ? { ...base, status: 'pass', detail: `Mailgun sends from ${config.domain}.` }
      : { ...base, status: 'fail', detail: 'Mailgun is not configured: sign-in codes and invitations cannot be sent.' }
  } catch {
    return { ...base, status: 'fail', detail: 'The saved Mailgun settings cannot be decrypted. Enter them again.' }
  }
}

function billingCheck(env: NodeJS.ProcessEnv, mode: string): LaunchCheck {
  const base = {
    id: 'billing',
    label: 'Stripe billing',
    issue: 71,
    action: { href: '/admin/settings', label: 'Platform settings' },
  }
  const missing = BILLING_KEYS.filter((key) => !present(env, key))
  if (missing.length)
    return mode === 'public'
      ? { ...base, status: 'fail', detail: 'Public mode needs every billing value.', items: missing }
      : { ...base, status: 'warn', detail: 'Not needed for the beta; required before public mode.', items: missing }
  const live = /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY?.trim() ?? '')
  if (mode === 'public' && !live)
    return { ...base, status: 'warn', detail: 'Billing uses a test-mode key in public mode: nobody is charged.' }
  return { ...base, status: 'pass', detail: `Configured in ${live ? 'live' : 'test'} mode.` }
}

function monitoringCheck(env: NodeJS.ProcessEnv): LaunchCheck {
  let valid = false
  try {
    valid = new URL(env.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? '').protocol === 'https:'
  } catch {
    valid = false
  }
  return valid
    ? { id: 'sentry', label: 'Error monitoring (Sentry)', status: 'pass', issue: 72, detail: 'Sentry DSN is set.' }
    : {
        id: 'sentry',
        label: 'Error monitoring (Sentry)',
        status: 'fail',
        issue: 72,
        detail: 'Set NEXT_PUBLIC_SENTRY_DSN in Coolify as a build and runtime variable, then redeploy.',
      }
}

function alertsCheck(env: NodeJS.ProcessEnv): LaunchCheck {
  const base = {
    id: 'alerts',
    label: 'Failure alert emails',
    issue: 72,
    action: { href: '/admin/settings', label: 'Platform settings' },
  }
  const to = env.OPS_ALERT_EMAIL?.trim()
  return to
    ? { ...base, status: 'pass', detail: `Failed jobs and server errors are emailed to ${to}.` }
    : { ...base, status: 'warn', detail: 'Set an alert email so failed jobs and server errors reach you.' }
}

async function databaseCheck(): Promise<LaunchCheck> {
  const base = { id: 'database', label: 'Database and migrations' }
  try {
    const rows = await prisma.$queryRaw<Array<{ failed: bigint | number }>>`
      SELECT count(*) AS failed FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`
    const failed = Number(rows[0]?.failed ?? 0)
    return failed
      ? { ...base, status: 'fail', detail: `${failed} migration(s) did not finish. Check the deploy logs.` }
      : { ...base, status: 'pass', detail: 'Connected; every migration finished.' }
  } catch {
    return { ...base, status: 'fail', detail: 'The database could not be queried.' }
  }
}

function deployCheck(env: NodeJS.ProcessEnv): LaunchCheck {
  const base = {
    id: 'deploy',
    label: 'Redeploy from this page',
    issue: 155,
    action: { href: '/admin/settings', label: 'Platform settings' },
  }
  if (!present(env, 'COOLIFY_DEPLOY_WEBHOOK') || !present(env, 'COOLIFY_API_TOKEN'))
    return {
      ...base,
      status: 'warn',
      detail: 'Optional: add the Coolify webhook and token to use the Redeploy button.',
    }
  return deployConfigured(env)
    ? { ...base, status: 'pass', detail: 'Coolify webhook and token are set.' }
    : {
        ...base,
        status: 'warn',
        detail: 'Set the Coolify webhook and token in the same place (both here or both in the environment).',
      }
}

/** Both set, and from the same source (see pages/api/admin/deploy.ts). */
export function deployConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    present(env, 'COOLIFY_DEPLOY_WEBHOOK') &&
    present(env, 'COOLIFY_API_TOKEN') &&
    isAdminValue('COOLIFY_DEPLOY_WEBHOOK') === isAdminValue('COOLIFY_API_TOKEN')
  )
}

const evidenceSelect = { outcome: true, performedAt: true, recordedByName: true } as const

function latestRecord(kind: OpsRecordKind) {
  return prisma.opsRecord.findFirst({ where: { kind }, orderBy: { performedAt: 'desc' }, select: evidenceSelect })
}

function decisionCheck(latest: EvidenceRow | null): LaunchCheck {
  const base = {
    id: 'decision',
    label: 'Go / no-go decision',
    issue: 76,
    action: { href: '#decision', label: 'Decide' },
  }
  if (!latest) return { ...base, status: 'warn', detail: 'No decision recorded yet.' }
  const by = latest.recordedByName ? ` by ${latest.recordedByName}` : ''
  return latest.outcome === 'go'
    ? { ...base, status: 'pass', detail: `Go recorded on ${day(latest.performedAt)}${by}.` }
    : { ...base, status: 'warn', detail: `No-go recorded on ${day(latest.performedAt)}${by}.` }
}

export async function launchChecks(env: NodeJS.ProcessEnv = process.env, now = new Date()): Promise<LaunchCheck[]> {
  const mode = releaseMode(env)
  const [email, database, backup, restore, monitoringTest, decision] = await Promise.all([
    emailCheck(),
    databaseCheck(),
    latestRecord('backup_drill'),
    latestRecord('restore_drill'),
    latestRecord('monitoring_test'),
    latestRecord('go_no_go'),
  ])
  return [
    secretsCheck(env),
    preflightCheck(env, mode),
    database,
    email,
    monitoringCheck(env),
    alertsCheck(env),
    evidenceCheck('monitoring-test', 'Monitoring alert tested', 'monitoring_test', monitoringTest, now),
    evidenceCheck('backup', 'Encrypted backup verified', 'backup_drill', backup, now),
    evidenceCheck('restore', 'Restore drill', 'restore_drill', restore, now),
    billingCheck(env, mode),
    deployCheck(env),
    decisionCheck(decision),
  ]
}

/** Checks that must pass before a "go" decision can be recorded. */
export function blockingChecks(checks: LaunchCheck[]): LaunchCheck[] {
  return checks.filter((check) => check.status === 'fail' && check.id !== 'decision')
}
