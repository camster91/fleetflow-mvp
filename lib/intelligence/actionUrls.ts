/** Browser-safe canonical allowlist for every intelligence record link. */
export function safeFindingActionUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512 || !value.startsWith('/') || value.startsWith('//')) return null
  try {
    const parsed = new URL(value, 'https://fleetvera.invalid')
    if (parsed.origin !== 'https://fleetvera.invalid' || parsed.hash) return null
    const clientMatch = parsed.pathname.match(/^\/clients\/([^/]+)$/)
    if (clientMatch && !parsed.search) {
      const decoded = decodeURIComponent(clientMatch[1])
      return decoded.length > 0 && decoded.length <= 128 ? value : null
    }
    if (!new Set(['/vehicles', '/deliveries', '/maintenance']).has(parsed.pathname)) return null
    const keys = [...parsed.searchParams.keys()]
    const record = parsed.searchParams.get('record')
    return keys.length === 1 && keys[0] === 'record' && record && record.length <= 128 ? value : null
  } catch { return null }
}
