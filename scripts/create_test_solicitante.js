const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

function timeoutPromise(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

(async () => {
  const payload = {
    nomeCompleto: 'Joyce Alinie Aguiar Deó ',
    cpf: '059.031.524-22',
    titulo: '8272 3773 7373',
    telefoneContato: '(81) 99770-3405',
    email: 'Joyce_Alinie@Hotmail.com',
    cep: '55024-650',
    endereco: 'Avenida Estanislau Cordeiro de Melo',
    num: '170',
    bairro: 'Indianópolis',
    zona: 'Urbana',
    pontoReferencia: 'Varejão ',
    secaoEleitoral: '2870',
    senha: '059031',
    indicadoPor: 'Artur Deó Lyra ',
    meio: 'WhatsApp',
    zonaEleitoral: '105'
  };

  const timeoutMs = 10000; // 10s timeout for the whole operation

  try {
    const start = Date.now();

    const op = (async () => {
      // normalize cpf
      const cpfLimpo = payload.cpf.replace(/\D/g, '');
      const senhaHash = await bcrypt.hash(payload.senha, 10);

      // transaction: create solicitantes then solicitantes_unicos with same id
      const result = await prisma.$transaction(async (tx) => {
        const novoSolicitante = await tx.solicitantes.create({
          data: {
            nomeCompleto: payload.nomeCompleto,
            cpf: cpfLimpo,
            titulo: payload.titulo,
            telefoneContato: payload.telefoneContato,
            email: payload.email,
            cep: payload.cep,
            endereco: payload.endereco,
            num: payload.num,
            bairro: payload.bairro,
            zona: payload.zona,
            pontoReferencia: payload.pontoReferencia,
            secaoEleitoral: payload.secaoEleitoral,
            indicadoPor: payload.indicadoPor
          }
        });

        await tx.solicitantes_unicos.create({
          data: {
            id: novoSolicitante.id,
            nomeCompleto: payload.nomeCompleto,
            cpf: cpfLimpo,
            titulo: payload.titulo,
            telefoneContato: payload.telefoneContato,
            email: payload.email,
            cep: payload.cep,
            endereco: payload.endereco,
            num: payload.num,
            bairro: payload.bairro,
            zona: payload.zona,
            pontoReferencia: payload.pontoReferencia,
            secaoEleitoral: payload.secaoEleitoral,
            indicadoPor: payload.indicadoPor,
            senha: senhaHash,
            meio: payload.meio,
            zonaEleitoral: payload.zonaEleitoral
          }
        });

        return { createdId: novoSolicitante.id };
      });

      return result;
    })();

    const result = await Promise.race([op, timeoutPromise(timeoutMs, `Create operation exceeded ${timeoutMs}ms`)]);
    const duration = Date.now() - start;

    console.log('Create result:', result, 'durationMs:', duration);
  } catch (err) {
    console.error('Create error:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
})();
