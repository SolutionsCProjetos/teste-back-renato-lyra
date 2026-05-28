const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['info','warn','error'] });

(async () => {
  try {
    console.log('Running DB diagnostics via Prisma...');

    const processlist = await prisma.$queryRawUnsafe('SHOW FULL PROCESSLIST');
    console.log('\n--- PROCESSLIST (first 30 rows) ---');
    console.log(processlist.slice(0,30));

    const threads = await prisma.$queryRawUnsafe("SHOW GLOBAL STATUS LIKE 'Threads_connected'");
    console.log('\n--- Threads_connected ---');
    console.log(threads);

    const maxConn = await prisma.$queryRawUnsafe("SHOW VARIABLES LIKE 'max_connections'");
    console.log('\n--- max_connections ---');
    console.log(maxConn);

    const waitTimeout = await prisma.$queryRawUnsafe("SHOW VARIABLES LIKE 'wait_timeout'");
    const connectTimeout = await prisma.$queryRawUnsafe("SHOW VARIABLES LIKE 'connect_timeout'");
    console.log('\n--- timeouts ---');
    console.log(waitTimeout);
    console.log(connectTimeout);

    const slowLog = await prisma.$queryRawUnsafe("SHOW VARIABLES LIKE 'slow_query_log'");
    const longTime = await prisma.$queryRawUnsafe("SHOW VARIABLES LIKE 'long_query_time'");
    console.log('\n--- slow query settings ---');
    console.log(slowLog);
    console.log(longTime);

    console.log('\nDiagnostics complete.');
  } catch (err) {
    console.error('Error running diagnostics:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
})();
