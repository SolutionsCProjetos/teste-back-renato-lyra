const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['info','warn','error'] });

(async () => {
  try {
    console.log('Connecting to DB...');

    const current = await prisma.$queryRaw`SELECT CURRENT_USER() as user`;
    console.log('CURRENT_USER:', current);

    try {
      const grants = await prisma.$queryRaw`SHOW GRANTS FOR CURRENT_USER()`;
      console.log('GRANTS:');
      console.log(grants);
    } catch (gErr) {
      console.error('Error running SHOW GRANTS:', gErr.message || gErr);
    }

    // Test write permission with a temporary table (session-local)
    try {
      console.log('Attempting to CREATE TEMPORARY TABLE...');
      await prisma.$executeRawUnsafe('CREATE TEMPORARY TABLE temp_perm_test(id INT)');
      console.log('CREATE TEMPORARY TABLE OK');

      console.log('Attempting to INSERT into temp table...');
      await prisma.$executeRawUnsafe('INSERT INTO temp_perm_test (id) VALUES (1)');
      console.log('INSERT OK');

      console.log('Selecting from temp table...');
      const rows = await prisma.$queryRawUnsafe('SELECT * FROM temp_perm_test');
      console.log('SELECT rows:', rows);

      console.log('Dropping temp table...');
      await prisma.$executeRawUnsafe('DROP TEMPORARY TABLE IF EXISTS temp_perm_test');
      console.log('DROP OK');
    } catch (permErr) {
      console.error('Permission or SQL error during temp table operations:', permErr.message || permErr);
    }

  } catch (err) {
    console.error('General error:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
})();
