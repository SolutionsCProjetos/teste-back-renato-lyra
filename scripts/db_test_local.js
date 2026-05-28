const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

function timeoutPromise(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

(async () => {
  try {
    const timeoutMs = 5000;
    const start = Date.now();
    const result = await Promise.race([
      prisma.$queryRaw`SELECT 1 as ok`,
      timeoutPromise(timeoutMs, `DB query exceeded ${timeoutMs}ms`)
    ]);
    const duration = Date.now() - start;
    console.log({ ok: true, durationMs: duration, raw: result });
  } catch (err) {
    console.error('DB test error:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
})();
