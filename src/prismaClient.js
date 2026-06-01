const { PrismaClient } = require('@prisma/client')

// Reuse PrismaClient across lambda invocations on serverless platforms
// to avoid exhausting database connections and cold-start overhead.
const globalWithPrisma = globalThis

let prisma
if (!globalWithPrisma.__prisma) {
  globalWithPrisma.__prisma = new PrismaClient({ 
    datasources: {
      db: {
        url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=20&connect_timeout=10'
      }
    },
    log: ['query', 'info', 'warn', 'error']
  })
}

prisma = globalWithPrisma.__prisma

module.exports = prisma
