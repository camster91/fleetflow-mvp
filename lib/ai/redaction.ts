import { safeFindingsSchema, type SafeFinding } from './types'

export type AllowlistShape = true | { readonly [key: string]: AllowlistShape } | readonly [AllowlistShape]

const BLOCKED_KEYS =
  /^(?:email|phone|address|contact|contactperson|accesstoken|token|secret|password|apikey|authorization|cookie|notes?)$/i

export function redactSensitiveText(value: string): string {
  let result = value
  result = result.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
  result = result.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, '[REDACTED_SECRET]')
  result = result.replace(
    /\b(?:api[_ -]?key|access[_ -]?token|secret|password|token)\s*[:=]\s*["']?[^\s,;"']+["']?/gi,
    '[REDACTED_SECRET]'
  )
  result = result.replace(/\beyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+){1,2}\b/g, '[REDACTED_SECRET]')
  result = result.replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/gi, '[REDACTED_SECRET]')
  result = result.replace(/[A-Za-z0-9+/_=-]{32,}/g, (candidate) => {
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[+/_=-]/].filter((pattern) => pattern.test(candidate)).length
    return classes >= 2 && new Set(candidate).size >= 8 ? '[REDACTED_SECRET]' : candidate
  })
  result = result.replace(
    /(?:\+\d{1,3}[\s.-]*)?(?:\(\d{2,4}\)[\s.-]*|\d{3}[\s.-]+)\d{3}[\s.-]+\d{4}\b/g,
    '[REDACTED_PHONE]'
  )
  return result
}

export function redactAllowlisted(value: unknown, shape: AllowlistShape): unknown {
  if (shape === true) {
    if (typeof value === 'string') return redactSensitiveText(value)
    return value === null || ['number', 'boolean'].includes(typeof value) ? value : undefined
  }
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return undefined
    return value.map((item) => redactAllowlisted(item, shape[0])).filter((item) => item !== undefined)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const output: Record<string, unknown> = Object.create(null)
  for (const [key, childShape] of Object.entries(shape)) {
    if (BLOCKED_KEYS.test(key) || !Object.prototype.hasOwnProperty.call(source, key)) continue
    const child = redactAllowlisted(source[key], childShape)
    if (child !== undefined) output[key] = child
  }
  return output
}

const SOURCE_KEYS = new Set([
  'id',
  'severity',
  'title',
  'explanation',
  'recommendedAction',
  'action',
  'score',
  'type',
  'confidence',
  'ruleVersion',
  'actionUrl',
  'status',
  'statusValid',
  'feedback',
  'feedbackValid',
  'generatedAt',
  'expiresAt',
  'resolvedAt',
  'evidence',
  'evidenceValid',
  'evidenceTotal',
  'evidenceTruncated',
  'expired',
  'effectiveStatus',
  'email',
  'phone',
  'address',
  'contact',
  'contactPerson',
  'accessToken',
  'token',
  'secret',
  'password',
  'apiKey',
  'authorization',
  'cookie',
  'note',
  'notes',
])

export function projectSafeFindings(input: unknown): SafeFinding[] {
  if (!Array.isArray(input)) throw new Error('AI findings must be an array')
  const projected = input.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`AI finding ${index} must be an object`)
    const source = raw as Record<string, unknown>
    const unsupported = Object.keys(source).filter((key) => !SOURCE_KEYS.has(key))
    if (unsupported.length) throw new Error(`AI finding ${index} has unsupported fields`)
    return {
      id: source.id,
      severity: source.severity,
      title: typeof source.title === 'string' ? redactSensitiveText(source.title) : source.title,
      explanation:
        typeof source.explanation === 'string' ? redactSensitiveText(source.explanation) : source.explanation,
      recommendedAction:
        typeof (source.recommendedAction ?? source.action) === 'string'
          ? redactSensitiveText((source.recommendedAction ?? source.action) as string)
          : (source.recommendedAction ?? source.action),
      score: source.score,
    }
  })
  const parsed = safeFindingsSchema.safeParse(projected)
  if (!parsed.success)
    throw new Error(`Invalid AI findings: ${parsed.error.errors.map((issue) => issue.message).join(', ')}`)
  return parsed.data
}
