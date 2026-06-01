const { PrismaClient } = require('@prisma/client')

// Reuse PrismaClient across lambda invocations on serverless platforms
// to avoid exhausting database connections and cold-start overhead.
const globalWithPrisma = globalThis

let prisma
if (!globalWithPrisma.__prisma) {
  globalWithPrisma.__prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] })
}

prisma = globalWithPrisma.__prisma

module.exports = prisma
