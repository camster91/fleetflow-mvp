import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  prismaD1?: PrismaClient
}

function sqlitePathFromEnv(): string {
  const path = require('node:path') as typeof import('node:path')
  const url = process.env.DATABASE_URL || 'file:./dev.db'
  if (url.startsWith('file:')) {
    return path.resolve(url.slice('file:'.length))
  }
  return path.resolve('dev.db')
}

export function createSqliteClient(): PrismaClient {
  const fs = require('node:fs') as typeof import('node:fs')
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3') as {
    PrismaBetterSqlite3: new (config: { url: string }) => unknown
  }
  const dbPath = sqlitePathFromEnv()
  fs.mkdirSync(pathDirname(dbPath), { recursive: true })
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: dbPath }) as never,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

function pathDirname(dbPath: string) {
  const path = require('node:path') as typeof import('node:path')
  return path.dirname(dbPath)
}

function tryCloudflareD1(): PrismaClient | undefined {
  try {
    // Sync context is available during a Worker request.
    // Load the D1 adapter lazily so Jest (CommonJS) never imports its ESM deps.
    const { getCloudflareContext } = require('@opennextjs/cloudflare') as {
      getCloudflareContext: (opts?: { async?: boolean }) => { env?: { DB?: unknown } }
    }
    const { env } = getCloudflareContext()
    if (!env?.DB) return undefined
    const { PrismaD1 } = require('@prisma/adapter-d1') as { PrismaD1: new (db: unknown) => unknown }
    return new PrismaClient({
      adapter: new PrismaD1(env.DB) as never,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  } catch {
    return undefined
  }
}

function getClient(): PrismaClient {
  const d1 = tryCloudflareD1()
  if (d1) {
    globalForPrisma.prismaD1 ??= d1
    return globalForPrisma.prismaD1
  }
  globalForPrisma.prisma ??= createSqliteClient()
  return globalForPrisma.prisma
}

export async function getPrisma(): Promise<PrismaClient> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext({ async: true })
    const db = (env as { DB?: unknown } | undefined)?.DB
    if (db) {
      const { PrismaD1 } = await import('@prisma/adapter-d1')
      globalForPrisma.prismaD1 ??= new PrismaClient({
        adapter: new PrismaD1(db as ConstructorParameters<typeof PrismaD1>[0]),
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
      return globalForPrisma.prismaD1
    }
  } catch {
    // Local Next.js, tests, and scripts have no Cloudflare context.
  }
  return getClient()
}

// Keep a `prisma` export so existing route and test mocks stay stable.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient()
    const value = Reflect.get(client, prop, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
