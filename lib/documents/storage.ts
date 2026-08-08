import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

export interface MalwareScanner { scan(bytes: Buffer, options: { signal: AbortSignal }): Promise<{ status: string; authoritativeDocumentSafety?: boolean }> }
export interface DocumentStorage { put(storageKey: string, bytes: Buffer): Promise<void>; read(storageKey: string): Promise<Buffer>; delete(storageKey: string): Promise<void> }
type Env = Record<string, string | undefined>
const adapterName = /^[a-z][a-z0-9-]{0,31}$/

export class AdapterRegistry<T> {
  private factories = new Map<string, (env: Env) => T>()
  register(name: string, factory: (env: Env) => T): this { if (!adapterName.test(name) || this.factories.has(name)) throw new Error('Invalid or duplicate document adapter'); this.factories.set(name, factory); return this }
  create(name: string, env: Env): T { const factory = this.factories.get(name); if (!adapterName.test(name) || !factory) throw new Error(`Document adapter '${name}' is not registered`); return factory(env) }
}

export const documentScannerRegistry = new AdapterRegistry<MalwareScanner>()
  .register('disabled', env => ({ scan: async () => { if (env.NODE_ENV === 'production') throw new Error('A malware scanner adapter is required in production'); return { status: 'SKIPPED' } } }))
export const documentStorageRegistry = new AdapterRegistry<DocumentStorage>()
  .register('filesystem', env => { if (!env.DOCUMENT_STORAGE_PATH) throw new Error('DOCUMENT_STORAGE_PATH is required'); return new PrivateDocumentStorage(env.DOCUMENT_STORAGE_PATH) })

export function scannerFromEnv(env: Record<string, string | undefined>): MalwareScanner {
  return documentScannerRegistry.create(env.DOCUMENT_SCANNER_PROVIDER || 'disabled', env)
}

export function storageFromEnv(env: Env): DocumentStorage {
  return documentStorageRegistry.create(env.DOCUMENT_STORAGE_PROVIDER || 'filesystem', env)
}

export async function runMalwareScan(scanner: MalwareScanner, bytes: Buffer, options: { production: boolean; timeoutMs: number }): Promise<{ status: 'CLEAN' | 'SKIPPED'; authoritativeDocumentSafety?: true }> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.min(60_000, Math.max(10, options.timeoutMs)))
  try {
    const abort = new Promise<never>((_resolve, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Malware scan timed out')), { once: true }))
    const verdict = await Promise.race([scanner.scan(bytes, { signal: controller.signal }), abort])
    if (!verdict || !['CLEAN', 'SKIPPED'].includes(verdict.status) || (options.production && verdict.status !== 'CLEAN')) throw new Error('Malware scan did not return a clean verdict')
    return { status: verdict.status as 'CLEAN' | 'SKIPPED', ...(verdict.authoritativeDocumentSafety === true ? { authoritativeDocumentSafety: true as const } : {}) }
  } finally { clearTimeout(timer) }
}

export function privateDocumentPath(root: string, storageKey: string): string {
  if (!/^[a-f0-9]{2}\/[a-f0-9]{32,128}$/.test(storageKey)) throw new Error('Invalid storage key')
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, storageKey)
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('Invalid storage key')
  return resolved
}

export class PrivateDocumentStorage {
  constructor(private readonly root: string) {
    const resolved = path.resolve(root); const publicRoot = path.resolve(process.cwd(), 'public')
    if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) throw new Error('Document storage must not be inside the public directory')
  }
  async put(storageKey: string, bytes: Buffer) {
    const target = privateDocumentPath(this.root, storageKey)
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
    const temp = `${target}.tmp-${process.pid}-${randomUUID()}`
    await writeFile(temp, bytes, { mode: 0o600, flag: 'wx' })
    try { await rename(temp, target) } catch (error) {
      if (['EEXIST', 'EPERM'].includes((error as NodeJS.ErrnoException).code || '')) { try { await unlink(temp) } catch { /* Cleanup can be retried by operations tooling. */ }; return }
      try { await unlink(temp) } catch { /* Preserve the original storage failure. */ }
      throw error
    }
  }
  read(storageKey: string) { return readFile(privateDocumentPath(this.root, storageKey)) }
  async delete(storageKey: string) { try { await unlink(privateDocumentPath(this.root, storageKey)) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error } }
}

export async function cleanupExpiredDocuments(options: {
  now: Date
  batchSize: number
  findExpired: (now: Date, limit: number) => Promise<Array<{ id: string; storageKey: string }>>
  deleteObject: (storageKey: string) => Promise<void>
  markDeleted: (id: string, now: Date) => Promise<void>
}): Promise<number> {
  const limit = Math.min(500, Math.max(1, options.batchSize))
  const rows = await options.findExpired(options.now, limit)
  for (const row of rows) {
    await options.deleteObject(row.storageKey)
    await options.markDeleted(row.id, options.now)
  }
  return rows.length
}
