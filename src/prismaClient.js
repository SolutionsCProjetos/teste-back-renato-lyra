const { PrismaClient } = require('@prisma/client')

// Reuse PrismaClient across lambda invocations on serverless platforms
// to avoid exhausting database connections and cold-start overhead.
const globalWithPrisma = globalThis

let prisma
if (!globalWithPrisma.__prisma) {
  // Configuração otimizada para Vercel/Coolify serverless
  const databaseUrl = process.env.DATABASE_URL
  
  // Adiciona parâmetros de pool na connection string se não existirem
  let connectionUrl = databaseUrl
  if (databaseUrl && !databaseUrl.includes('connection_limit')) {
    const separator = databaseUrl.includes('?') ? '&' : '?'
    connectionUrl = `${databaseUrl}${separator}connection_limit=5&pool_timeout=10&connect_timeout=10`
  }

  globalWithPrisma.__prisma = new PrismaClient({ 
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: connectionUrl
      }
    }
  })
  
  // Cleanup ao desligar (importante para Vercel/Coolify)
  const cleanup = () => {
    globalWithPrisma.__prisma.$disconnect().catch(console.error)
  }
  process.on('beforeExit', cleanup)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

prisma = globalWithPrisma.__prisma

module.exports = prisma
