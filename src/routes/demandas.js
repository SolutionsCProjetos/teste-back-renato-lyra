const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

const authMiddleware = require('../../middlewares/auth');
router.use(authMiddleware);

// Helper local de timeout (ms)
function timeoutPromise(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

// Rota rápida para checar se o servidor consegue obter algumas demandas rapidamente
router.get('/quick', async (req, res) => {
  const timeoutMs = parseInt(req.query.ms) || 3000; // 3s padrão
  try {
    const start = Date.now();
    const op = prisma.demandas.findMany({
      take: 20,
      orderBy: { dataSolicitacao: 'desc' },
      select: { id: true, protocolo: true, solicitant: true, dataSolicitacao: true, status: true }
    });

    const result = await Promise.race([op, timeoutPromise(timeoutMs, `DB query exceeded ${timeoutMs}ms`)]);
    const duration = Date.now() - start;
    res.json({ ok: true, durationMs: duration, count: result.length, data: result });
  } catch (err) {
    console.error('Quick demands error:', err.message || err);
    if ((err && err.message && err.message.includes('exceeded')) || err.message === 'Operation timed out') {
      return res.status(504).json({ ok: false, error: 'DB timeout', details: err.message });
    }
    res.status(500).json({ ok: false, error: 'Error fetching quick demands', details: err.message });
  }
});

// Criar

// router.post('/', async (req, res) => {
//   try {
//     const {
//       protocolo,
//       setor,
//       prioridade,
//       status,
//       dataSolicitacao,
//       dataTermino,
//       solicitant,
//       reincidencia,
//       meioSolicitacao,
//       anexarDocumentos,
//       envioCobranca1,
//       envioCobranca2,
//       envioParaResponsavel,
//       observacoes,
//       solicitantId,
//       indicadoPor
//     } = req.body;

//     console.log(req.body, '===============')

//     // 1. Verificar se o solicitante existe
//     const solicitanteExistente = await prisma.solicitantes_unicos.findUnique({
//       where: { id: parseInt(solicitantId) }
//     });

//     if (!solicitanteExistente) {
//       return res.status(400).json({ 
//         error: 'Solicitante não encontrado',
//         details: `Nenhum solicitante encontrado com o ID: ${solicitantId}`
//       });
//     }

//     // 2. Mapear valores para os enums corretos
//     const reincidenciaEnum = reincidencia === 'N_o' ? 'N_o' : 'Sim';
//     const meioSolicitacaoEnum = meioSolicitacao === 'WhatsApp' ? 'WhatsApp' : 'Presencial';
//     const statusEnum = status === 'Aguardando_Retorno' ? 'Aguardando_Retorno' :
//                       status === 'Conclu_da' ? 'Conclu_da' : 
//                       status === 'Cancelada' ? 'Cancelada' : 'Pendente';

//     // 3. Criar a demanda
//     const novaDemanda = await prisma.demandas.create({
//       data: {
//         protocolo,
//         setor,
//         prioridade,
//         status: statusEnum,
//         dataSolicitacao: dataSolicitacao ? new Date(new Date(dataSolicitacao).setDate(new Date(dataSolicitacao).getDate() + 1)) : new Date(),
//         dataTermino: dataTermino ? new Date(dataTermino) : null,
//         solicitant,
//         reincidencia: reincidenciaEnum,
//         meioSolicitacao: meioSolicitacaoEnum,
//         anexarDocumentos,
//         envioCobranca1,
//         envioCobranca2,
//         envioParaResponsavel,
//         observacoes,
//         solicitanteId: parseInt(solicitantId),
//         indicadoPor
//       }
//     });

//     res.json(novaDemanda);
//   } catch (error) {
//     console.error('Erro detalhado:', {
//       message: error.message,
//       code: error.code,
//       meta: error.meta
//     });
    
//     let errorMessage = 'Erro ao criar demanda';
//     if (error.code === 'P2003') {
//       errorMessage = 'Erro de relacionamento: O solicitante informado não existe';
//     } else if (error.code === 'P2002') {
//       errorMessage = 'Violação de restrição única: Protocolo já existe';
//     }

//     res.status(500).json({ 
//       error: errorMessage,
//       details: error.message,
//       code: error.code
//     });
//   }
// });


router.post('/', async (req, res) => {
  try {
    const {
      protocolo,
      setor,
      prioridade,
      status,
      dataSolicitacao,
      dataTermino,
      solicitant,
      reincidencia,
      meioSolicitacao,
      anexarDocumentos,
      envioCobranca1,
      envioCobranca2,
      envioParaResponsavel,
      observacoes,
      solicitantId,
      indicadoPor
    } = req.body;

    // 1. Verificar se o solicitante existe
    const solicitanteExistente = await prisma.solicitantes_unicos.findUnique({
      where: { id: parseInt(solicitantId) }
    });

    if (!solicitanteExistente) {
      return res.status(400).json({ 
        error: 'Solicitante não encontrado',
        details: `Nenhum solicitante encontrado com o ID: ${solicitantId}`
      });
    }

    // 2. Mapear valores para os enums corretos
    const reincidenciaEnum = reincidencia === 'N_o' ? 'N_o' : 'Sim';
    const meioSolicitacaoEnum = meioSolicitacao === 'WhatsApp' ? 'WhatsApp' : 'Presencial';
    const statusEnum = status === 'Aguardando_Retorno' ? 'Aguardando_Retorno' :
                      status === 'Conclu_da' ? 'Conclu_da' : 
                      status === 'Cancelada' ? 'Cancelada' : 'Pendente';

      function parseData(data) {
  if (!data || isNaN(Date.parse(data))) return null;
  return new Date(data);
}


    // 3. Criar a demanda com tratamento correto de datas
    const novaDemanda = await prisma.demandas.create({
      data: {
        protocolo,
        setor,
        prioridade,
        status: statusEnum,
        // dataSolicitacao: dataSolicitacao ? new Date(dataSolicitacao) : new Date(), // Corrigido aqui
        // dataTermino: dataTermino ? new Date(dataTermino) : null,
        dataSolicitacao: parseData(dataSolicitacao) || new Date(),
        dataTermino: parseData(dataTermino),
        solicitant,
        reincidencia: reincidenciaEnum,
        meioSolicitacao: meioSolicitacaoEnum,
        anexarDocumentos,
        envioCobranca1,
        envioCobranca2,
        envioParaResponsavel,
        observacoes,
        solicitanteId: parseInt(solicitantId),
        indicadoPor
      }
    });

    res.json(novaDemanda);
  } catch (error) {
    console.error('Erro detalhado:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    let errorMessage = 'Erro ao criar demanda';
    if (error.code === 'P2003') {
      errorMessage = 'Erro de relacionamento: O solicitante informado não existe';
    } else if (error.code === 'P2002') {
      errorMessage = 'Violação de restrição única: Protocolo já existe';
    }

    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      code: error.code
    });
  }
});


// Buscar próximo protocolo
// router.get('/proximo-protocolo', async (req, res) => {
//   const ultima = await prisma.demandas.findFirst({
//     orderBy: { id: 'desc' }
//   });

//   const ano = new Date().getFullYear();
//   const sequencial = (ultima?.id || 0) + 1;
//   const protocolo = `P${ano}${String(sequencial).padStart(4, '0')}`;

//   res.json({ protocolo });
// });

router.get('/proximo-protocolo', async (req, res) => {
  try {
    const ano = new Date().getFullYear();

    const result = await prisma.$queryRaw`
      SELECT MAX(CAST(SUBSTRING(protocolo, 6) AS UNSIGNED)) AS maxSeq
      FROM demandas
      WHERE protocolo LIKE ${`P${ano}%`}
    `;

    let maxSeq = result[0]?.maxSeq ?? 0;

    // Converte BigInt para Number se necessário
    if (typeof maxSeq === 'bigint') {
      maxSeq = Number(maxSeq);
    }

    const sequencial = maxSeq + 1;
    const protocolo = `P${ano}${String(sequencial).padStart(4, '0')}`;

    res.json({ protocolo });
  } catch (error) {
    console.error('Erro ao gerar protocolo:', error);
    res.status(500).json({ error: 'Erro ao gerar protocolo', details: error.message });
  }
});

//Listar
router.get('/', async (req, res) => {
  try {
    // Query params suportados: page, limit, solicitanteId, protocolo, status, dateFrom, dateTo, search
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 200); // protege contra requests gigantes
    const skip = (page - 1) * limit;

    const {
      solicitanteId,
      protocolo,
      status,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const where = {};

    if (solicitanteId) where.solicitanteId = parseInt(solicitanteId);
    if (protocolo) where.protocolo = { contains: protocolo };
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.dataSolicitacao = {};
      if (dateFrom && !isNaN(Date.parse(dateFrom))) where.dataSolicitacao.gte = new Date(dateFrom);
      if (dateTo && !isNaN(Date.parse(dateTo))) where.dataSolicitacao.lte = new Date(dateTo);
    }
    if (search) {
      // Busca simples em solicitant, protocolo e observacoes
      where.OR = [
        { solicitant: { contains: search } },
        { protocolo: { contains: search } },
        { observacoes: { contains: search } }
      ];
    }

    // Total para paginação
    const total = await prisma.demandas.count({ where });

    const lista = await prisma.demandas.findMany({
      where,
      include: {
        // incluir apenas campos necessários do solicitante para performance
        solicitantes: {
          select: { id: true, nomeCompleto: true, cpf: true, telefoneContato: true, email: true }
        }
      },
      orderBy: { dataSolicitacao: 'desc' },
      skip,
      take: limit
    });

    res.json({
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: lista
    });
  } catch (error) {
    console.error('Erro ao buscar demandas:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({ error: 'Erro ao buscar demandas', details: error.message });
  }
});







// ✅ Coloque antes do /:id
router.get('/setores', async (req, res) => {
  try {
    const setores = await prisma.setores.findMany({
      orderBy: { setor: 'asc' },
      select: { id: true, setor: true }
    });
    res.json(setores);
  } catch (error) {
    console.error('Erro ao buscar setores:', error);
    res.status(500).json({ error: 'Erro ao buscar setores', details: error.message });
  }
});




// Buscar por ID
router.get('/:id', async (req, res) => {
  try {
    const solicitante = await prisma.solicitantes_unicos.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!solicitante) {
      return res.status(404).json({ error: 'Solicitante não encontrado' });
    }

    res.json(solicitante);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar solicitante', detalhe: error.message });
  }
});





// Atualizar
// router.put('/:id', async (req, res) => {
//   try {
//     const demandaId = parseInt(req.params.id, 10);

//     if (isNaN(demandaId)) {
//       return res.status(400).json({ error: 'ID inválido.' });
//     }

//     const {
//       protocolo,
//       setor,
//       prioridade,
//       status,
//       dataSolicitacao,
//       dataTermino,
//       solicitant,
//       nomeCompleto,
//       cpf,
//       reincidencia,
//       meioSolicitacao,
//       anexarDocumentos,
//       envioCobranca1,
//       envioCobranca2,
//       envioParaResponsavel,
//       observacoes,
//       solicitantId,
//       indicadoPor
//     } = req.body;

//     // Validação de solicitantId
//     const solicitanteIdParsed = Number(solicitantId);
//     if (isNaN(solicitanteIdParsed)) {
//       return res.status(400).json({ error: 'SolicitanteId inválido' });
//     }

//     const demandaAtualizada = await prisma.demandas.update({
//       where: { id: demandaId },
//       data: {
//         protocolo,
//         setor,
//         prioridade,
//         status,
//         dataSolicitacao: new Date(dataSolicitacao),
//         dataTermino: dataTermino ? new Date(dataTermino) : null,
//         solicitant,
//         reincidencia,
//         meioSolicitacao,
//         anexarDocumentos,
//         envioCobranca1,
//         envioCobranca2,
//         envioParaResponsavel,
//         observacoes,
//         solicitantes: {
//           connect: { id: solicitanteIdParsed }
//         },
//         indicadoPor
//       }
//     });

//     // Atualização opcional do solicitante
//     if (nomeCompleto || cpf) {
//       await prisma.solicitantes.update({
//         where: { id: solicitanteIdParsed },
//         data: {
//           ...(nomeCompleto && { nomeCompleto }),
//           ...(cpf && { cpf })
//         }
//       });
//     }

//     res.json(demandaAtualizada);
//   } catch (error) {
//     console.error('Erro ao editar demanda:', error);
//     res.status(500).json({ error: 'Erro ao editar demanda' });
//   }
// });

router.put('/:id', async (req, res) => {
  try {
    const demandaId = parseInt(req.params.id, 10);

    if (isNaN(demandaId)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const {
      // protocolo,
      setor,
      prioridade,
      status,
      dataSolicitacao,
      dataTermino,
      solicitant,
      nomeCompleto,
      cpf,
      reincidencia,
      meioSolicitacao,
      anexarDocumentos,
      envioCobranca1,
      envioCobranca2,
      envioParaResponsavel,
      observacoes,
      solicitantId,
      indicadoPor
    } = req.body;

    // Validação de solicitantId
    const solicitanteIdParsed = Number(solicitantId);
    if (isNaN(solicitanteIdParsed)) {
      return res.status(400).json({ error: 'SolicitanteId inválido' });
    }

    // Atualização da demanda com tratamento correto de datas
    const demandaAtualizada = await prisma.demandas.update({
      where: { id: demandaId },
      data: {
        // protocolo,
        setor,
        prioridade,
        status,
        dataSolicitacao: dataSolicitacao ? new Date(dataSolicitacao) : undefined, // Corrigido aqui
        dataTermino: dataTermino ? new Date(dataTermino) : null,
        solicitant,
        reincidencia,
        meioSolicitacao,
        anexarDocumentos,
        envioCobranca1,
        envioCobranca2,
        envioParaResponsavel,
        observacoes,
        solicitantes: {
          connect: { id: solicitanteIdParsed }
        },
        indicadoPor
      }
    });

    // Atualização opcional do solicitante
    if (nomeCompleto || cpf) {
      await prisma.solicitantes.update({
        where: { id: solicitanteIdParsed },
        data: {
          ...(nomeCompleto && { nomeCompleto }),
          ...(cpf && { cpf: cpf.replace(/\D/g, '') }) // Normaliza CPF se for atualizado
        }
      });
    }

    res.json({
      success: true,
      demanda: demandaAtualizada,
      message: 'Demanda atualizada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao editar demanda:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });

    let errorMessage = 'Erro ao atualizar demanda';
    if (error.code === 'P2025') {
      errorMessage = 'Registro não encontrado';
    } else if (error.code === 'P2002') {
      errorMessage = 'Violação de restrição única';
    }

    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code
    });
  }
});


// Deletar
// router.delete('/:id', async (req, res) => {
//   await prisma.demandas.delete({ where: { id: parseInt(req.params.id) } });
//   res.json({ deleted: true });
// });


router.delete('/:id', async (req, res) => {
  try {
    const demandaId = parseInt(req.params.id);

    // 1. Buscar a demanda original
    const demanda = await prisma.demandas.findUnique({
      where: { id: demandaId }
    });

    if (!demanda) {
      return res.status(404).json({ error: 'Demanda não encontrada' });
    }

    // Pega o usuário logado (do middleware auth)
    const userId = req.user?.id || null;

    // 2. Inserir na tabela de log
    await prisma.demandas_deletadas.create({
      data: {
        demandaId: demanda.id,
        protocolo: demanda.protocolo,
        setor: demanda.setor,
        prioridade: demanda.prioridade,
        status: demanda.status,
        dataSolicitacao: demanda.dataSolicitacao,
        dataTermino: demanda.dataTermino,
        solicitant: demanda.solicitant,
        reincidencia: demanda.reincidencia,
        meioSolicitacao: demanda.meioSolicitacao,
        anexarDocumentos: demanda.anexarDocumentos,
        envioCobranca1: demanda.envioCobranca1,
        envioCobranca2: demanda.envioCobranca2,
        envioParaResponsavel: demanda.envioParaResponsavel,
        observacoes: demanda.observacoes,
        solicitanteId: demanda.solicitanteId,
        indicadoPor: demanda.indicadoPor,
        deletadoPor: userId,
      }
    });

    // 3. Deletar da tabela original
    await prisma.demandas.delete({
      where: { id: demandaId }
    });

    res.json({ success: true, message: 'Demanda deletada e registrada no log' });
  } catch (error) {
    console.error('Erro ao deletar demanda:', error);
    res.status(500).json({ error: 'Erro ao deletar demanda' });
  }
});





module.exports = router;











