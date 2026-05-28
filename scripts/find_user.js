const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function find(term) {
  const isCpf = /\d/.test(term) && term.replace(/\D/g, '').length >= 8; // crude
  const cpfClean = term.replace(/\D/g, '');
  console.log('Searching for:', term, 'clean cpf:', cpfClean);

  try {
    const usuarios = await prisma.usuarios.findMany({
      where: {
        OR: [
          { email: { contains: term.trim().toLowerCase() } }
        ]
      },
      select: { id: true, nome: true, email: true, senha: true, adm: true }
    });

    const solicitantes = await prisma.solicitantes_unicos.findMany({
      where: {
        OR: [
          { email: { contains: term.trim().toLowerCase() } },
          { cpf: cpfClean }
        ]
      },
      select: { id: true, nomeCompleto: true, email: true, cpf: true, senha: true }
    });

    console.log('\n--- usuarios matches ---');
    console.log(usuarios);
    console.log('\n--- solicitantes_unicos matches ---');
    console.log(solicitantes);
  } catch (err) {
    console.error('Error:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

const term = process.argv[2];
if (!term) {
  console.error('Usage: node scripts/find_user.js <email-or-cpf>');
  process.exit(1);
}

find(term);
