import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../lib/auth'
import { prisma } from '../../lib/prisma'

// Simple key-value storage using raw SQL (avoiding Prisma schema changes)
const validDataTypes = ['vehicles', 'deliveries', 'maintenance', 'clients', 'sop', 'vending-machines'] as const
type DataType = typeof validDataTypes[number]

// Initialize the user_data table if it doesn't exist
async function initTable() {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS user_data (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        data_type TEXT NOT NULL,
        data TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, data_type),
        FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
      )
    `
    console.log('user_data table ready')
  } catch (error) {
    console.error('Failed to create user_data table:', error)
    // Table might already exist with different schema
  }
}

// Call init on module load (once)
let initialized = false
if (!initialized) {
  initTable().catch(console.error)
  initialized = true
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  // Check if user is authenticated
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { dataType } = req.query
  
  // Validate dataType
  if (!dataType || typeof dataType !== 'string' || !validDataTypes.includes(dataType as DataType)) {
    return res.status(400).json({ 
      error: 'Invalid data type', 
      validTypes: validDataTypes 
    })
  }

  const userId = session.user.id
  const typedDataType = dataType as DataType

  // GET - Retrieve user data
  if (req.method === 'GET') {
    try {
      const result = await prisma.$queryRaw<Array<{ data: string, version: number, updated_at: Date }>>`
        SELECT data, version, updated_at
        FROM user_data
        WHERE user_id = ${userId} AND data_type = ${typedDataType}
        LIMIT 1
      `

      // Return empty array if no data exists
      if (!result || result.length === 0) {
        return res.status(200).json({ data: [] })
      }

      // Parse and return the JSON data
      try {
        const parsedData = JSON.parse(result[0].data)
        return res.status(200).json({ 
          data: parsedData,
          version: result[0].version,
          updatedAt: result[0].updated_at
        })
      } catch (parseError) {
        console.error(`Failed to parse data for user ${userId}, type ${typedDataType}:`, parseError)
        return res.status(200).json({ data: [] })
      }
    } catch (error) {
      console.error(`Failed to get user data for ${typedDataType}:`, error)
      return res.status(500).json({ error: 'Failed to retrieve data' })
    }
  }

  // POST - Update user data
  if (req.method === 'POST') {
    try {
      const { data } = req.body

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: 'Data must be an array' })
      }

      // Validate data size (prevent abuse)
      const dataString = JSON.stringify(data)
      if (dataString.length > 10 * 1024 * 1024) { // 10MB limit
        return res.status(413).json({ error: 'Data too large' })
      }

      // Use raw SQL for upsert (SQLite doesn't have UPSERT until v3.24, so use INSERT OR REPLACE)
      const id = `${userId}-${typedDataType}`
      
      await prisma.$executeRaw`
        INSERT OR REPLACE INTO user_data (id, user_id, data_type, data, version, updated_at)
        VALUES (
          ${id},
          ${userId},
          ${typedDataType},
          ${dataString},
          COALESCE((SELECT version + 1 FROM user_data WHERE user_id = ${userId} AND data_type = ${typedDataType}), 1),
          CURRENT_TIMESTAMP
        )
      `

      // Get the updated record
      const result = await prisma.$queryRaw<Array<{ version: number, updated_at: Date }>>`
        SELECT version, updated_at
        FROM user_data
        WHERE user_id = ${userId} AND data_type = ${typedDataType}
        LIMIT 1
      `

      return res.status(200).json({ 
        success: true,
        version: result[0]?.version || 1,
        updatedAt: result[0]?.updated_at || new Date()
      })
    } catch (error) {
      console.error(`Failed to save user data for ${typedDataType}:`, error)
      return res.status(500).json({ error: 'Failed to save data' })
    }
  }

  // DELETE - Clear user data
  if (req.method === 'DELETE') {
    try {
      await prisma.$executeRaw`
        DELETE FROM user_data
        WHERE user_id = ${userId} AND data_type = ${typedDataType}
      `

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error(`Failed to delete user data for ${typedDataType}:`, error)
      return res.status(500).json({ error: 'Failed to delete data' })
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' })
}