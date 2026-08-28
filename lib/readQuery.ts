type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export function parseSearchTerm(raw: unknown): Parsed<string | null> {
  if (raw === undefined) return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, error: 'Invalid search query' }

  const value = raw.trim()
  if (value.length < 2) return { ok: true, value: null }
  if (value.length > 100) return { ok: false, error: 'Search query is too long' }
  return { ok: true, value }
}

export function parseActivityFilters(
  limitRaw: unknown,
  typeRaw: unknown,
): Parsed<{ limit: number; entityType?: string }> {
  let limit = 20
  if (limitRaw !== undefined) {
    if (typeof limitRaw !== 'string' || !/^\d+$/.test(limitRaw)) {
      return { ok: false, error: 'Invalid activity limit' }
    }
    limit = Number(limitRaw)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return { ok: false, error: 'Activity limit must be between 1 and 100' }
    }
  }

  if (typeRaw === undefined) return { ok: true, value: { limit } }
  if (
    typeof typeRaw !== 'string'
    || typeRaw.length < 1
    || typeRaw.length > 64
    || !/^[A-Za-z0-9_-]+$/.test(typeRaw)
  ) {
    return { ok: false, error: 'Invalid activity type' }
  }
  return { ok: true, value: { limit, entityType: typeRaw } }
}

export function parseAuditMetadata(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}
