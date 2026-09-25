import path from 'path'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import {
  AdapterRegistry,
  cleanupExpiredDocuments,
  documentScannerRegistry,
  privateDocumentPath,
  PrivateDocumentStorage,
  runMalwareScan,
  scannerFromEnv,
} from '@/lib/documents/storage'

describe('private document storage', () => {
  test('resolves randomized keys only inside the configured private root', () => {
    const root = path.resolve('private-test-documents')
    expect(privateDocumentPath(root, `ab/${'a'.repeat(32)}`)).toContain(root)
    expect(() => privateDocumentPath(root, '../public/file')).toThrow(/storage key/i)
    expect(() => privateDocumentPath(root, 'https://evil.example/a')).toThrow(/storage key/i)
  })

  test('production scanning fails closed when no scanner is configured', async () => {
    const scanner = scannerFromEnv({ NODE_ENV: 'production' })
    await expect(scanner.scan(Buffer.from('x'), { signal: new AbortController().signal })).rejects.toThrow(/scanner/i)
  })

  test('an explicitly registered production scanner can operate without weakening fail-closed defaults', async () => {
    const name = `qa-${Date.now()}`
    documentScannerRegistry.register(name, () => ({ scan: async () => ({ status: 'CLEAN' }) }))
    await expect(
      runMalwareScan(
        scannerFromEnv({ NODE_ENV: 'production', DOCUMENT_SCANNER_PROVIDER: name }),
        Buffer.from('clean'),
        { production: true, timeoutMs: 100 }
      )
    ).resolves.toEqual({ status: 'CLEAN' })
    expect(() => new AdapterRegistry().register('../bad', () => ({}))).toThrow()
  })

  test('rejects storage under the web public directory', () => {
    expect(() => new PrivateDocumentStorage(path.join(process.cwd(), 'public', 'documents'))).toThrow(/public/i)
  })

  test('development scanner is explicitly marked skipped', async () => {
    await expect(
      runMalwareScan(scannerFromEnv({ NODE_ENV: 'test' }), Buffer.from('x'), { production: false, timeoutMs: 100 })
    ).resolves.toEqual({ status: 'SKIPPED' })
  })

  test('production rejects skipped, malformed, failed, and timed-out scanner verdicts', async () => {
    await expect(
      runMalwareScan({ scan: async () => ({ status: 'SKIPPED' }) }, Buffer.from('x'), {
        production: true,
        timeoutMs: 100,
      })
    ).rejects.toThrow(/clean verdict/i)
    await expect(
      runMalwareScan({ scan: async () => ({ status: 'UNKNOWN' }) }, Buffer.from('x'), {
        production: true,
        timeoutMs: 100,
      })
    ).rejects.toThrow()
    await expect(
      runMalwareScan({ scan: async () => new Promise(() => undefined) }, Buffer.from('x'), {
        production: true,
        timeoutMs: 10,
      })
    ).rejects.toThrow(/timed out/i)
  })

  test('retention cleanup deletes bytes before marking rows deleted', async () => {
    const order: string[] = []
    const result = await cleanupExpiredDocuments({
      now: new Date('2026-08-08T00:00:00Z'),
      batchSize: 10,
      findExpired: async () => [{ id: 'd1', storageKey: `ab/${'a'.repeat(32)}` }],
      deleteObject: async () => {
        order.push('object')
      },
      markDeleted: async () => {
        order.push('row')
      },
    })
    expect(result).toBe(1)
    expect(order).toEqual(['object', 'row'])
  })

  test('concurrent same-key puts remain ownership-safe and produce one intact object', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fleetvera-docs-'))
    const storage = new PrivateDocumentStorage(root)
    const key = `ab/${'b'.repeat(64)}`
    try {
      await Promise.all([storage.put(key, Buffer.from('same bytes')), storage.put(key, Buffer.from('same bytes'))])
      expect(await readFile(privateDocumentPath(root, key), 'utf8')).toBe('same bytes')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
