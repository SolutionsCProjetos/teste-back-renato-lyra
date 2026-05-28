const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

function timeoutPromise(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

(async () => {
  try {
    const timeoutMs = 3000;
    const start = Date.now();
    const op = prisma.demandas.findMany({
      take: 20,
      orderBy: { dataSolicitacao: 'desc' },
      select: { id: true, protocolo: true, solicitant: true, dataSolicitacao: true, status: true }
    });

    const result = await Promise.race([op, timeoutPromise(timeoutMs, `DB query exceeded ${timeoutMs}ms`)]);
    const duration = Date.now() - start;
    console.log({ ok: true, durationMs: duration, count: result.length });
  } catch (err) {
    console.error('Direct DB quick error:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
})();
