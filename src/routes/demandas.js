const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = require('../prismaClient')

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
    console.log('[START] Criando nova demanda...');
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

    // 1. Mapear valores para os enums corretos do MySQL
    const reincidenciaEnum = reincidencia === 'N_o' || reincidencia === 'Não' ? 'Não' : 'Sim';
    const meioSolicitacaoEnum = meioSolicitacao === 'WhatsApp' ? 'WhatsApp' : 'Presencial';
    
    // Status: mapear para valores do banco (com @map aplicado)
    let statusEnum = 'Pendente'; // default
    if (status === 'Aguardando_Retorno' || status === 'Aguardando Retorno') {
      statusEnum = 'Aguardando Retorno';
    } else if (status === 'Conclu_da' || status === 'Concluída') {
      statusEnum = 'Concluída';
    } else if (status === 'Cancelada') {
      statusEnum = 'Cancelada';
    }
    
    console.log('[DEBUG] Status mapeado:', status, '->', statusEnum);

    function parseData(data) {
      if (!data || isNaN(Date.parse(data))) return null;
      return new Date(data);
    }

    // 2. Criar a demanda usando INSERT direto (MySQL valida FK automaticamente)
    console.log('[START] Inserindo demanda no banco com solicitanteId:', solicitantId);
    const dataSolicitacaoParsed = parseData(dataSolicitacao) || new Date();
    const dataTerminoParsed = parseData(dataTermino);
    
    await Promise.race([
      prisma.$executeRaw`
        INSERT INTO demandas (
          protocolo, setor, prioridade, status, dataSolicitacao, dataTermino,
          solicitant, reincidencia, meioSolicitacao, anexarDocumentos,
          envioCobranca1, envioCobranca2, envioParaResponsavel, observacoes,
          solicitanteId, indicadoPor
        ) VALUES (
          ${protocolo}, ${setor}, ${prioridade}, ${statusEnum}, 
          ${dataSolicitacaoParsed}, ${dataTerminoParsed}, ${solicitant},
          ${reincidenciaEnum}, ${meioSolicitacaoEnum}, ${anexarDocumentos},
          ${envioCobranca1}, ${envioCobranca2}, ${envioParaResponsavel},
          ${observacoes}, ${parseInt(solicitantId)}, ${indicadoPor}
        )
      `,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao criar demanda')), 10000))
    ]);
    
    // Buscar a demanda criada
    const novaDemanda = await prisma.demandas.findFirst({
      where: { protocolo },
      orderBy: { id: 'desc' }
    });
    
    console.log('[DONE] Demanda criada com sucesso, ID:', novaDemanda?.id);
    res.json(novaDemanda);
  } catch (error) {
    console.error('[ERROR] Erro ao criar demanda:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    let errorMessage = 'Erro ao criar demanda';
    if (error.message.includes('Timeout')) {
      errorMessage = 'Timeout ao criar demanda. Banco travado.';
      return res.status(504).json({ 
        error: errorMessage,
        details: error.message
      });
    } else if (error.code === 'P2003') {
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

    const returnAll = String(req.query.all || '').toLowerCase() === 'true'

    let lista
    if (returnAll) {
      // Retorna todas as demandas (sem skip/take) - use com cuidado em bases grandes
      lista = await prisma.demandas.findMany({
        where,
        include: {
          solicitantes: {
            select: { id: true, nomeCompleto: true, cpf: true, telefoneContato: true, email: true }
          }
        },
        orderBy: { dataSolicitacao: 'desc' }
      })

      res.json({
        meta: { total, page: 1, limit: lista.length, pages: 1 },
        data: lista
      })
      return
    }

    const listaPaginated = await prisma.demandas.findMany({
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
      data: listaPaginated
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

    console.log('[START] Deletando demanda ID:', demandaId);
    
    // 1. Buscar a demanda original (com timeout)
    const demanda = await Promise.race([
      prisma.demandas.findUnique({
        where: { id: demandaId }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao buscar demanda')), 5000))
    ]);

    if (!demanda) {
      console.log('[ERROR] Demanda não encontrada:', demandaId);
      return res.status(404).json({ error: 'Demanda não encontrada' });
    }

    // Pega o usuário logado (do middleware auth)
    const userId = req.user?.id || null;

    // 2. Inserir na tabela de log usando INSERT direto (evita locks)
    console.log('[START] Inserindo em demandas_deletadas...');
    await Promise.race([
      prisma.$executeRaw`
        INSERT INTO demandas_deletadas (
          demandaId, protocolo, setor, prioridade, status, dataSolicitacao,
          dataTermino, solicitant, reincidencia, meioSolicitacao, anexarDocumentos,
          envioCobranca1, envioCobranca2, envioParaResponsavel, observacoes,
          solicitanteId, indicadoPor, deletadoPor
        ) VALUES (
          ${demanda.id}, ${demanda.protocolo}, ${demanda.setor}, ${demanda.prioridade},
          ${demanda.status}, ${demanda.dataSolicitacao}, ${demanda.dataTermino},
          ${demanda.solicitant}, ${demanda.reincidencia}, ${demanda.meioSolicitacao},
          ${demanda.anexarDocumentos}, ${demanda.envioCobranca1}, ${demanda.envioCobranca2},
          ${demanda.envioParaResponsavel}, ${demanda.observacoes}, ${demanda.solicitanteId},
          ${demanda.indicadoPor}, ${userId}
        )
      `,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao inserir log')), 5000))
    ]);
    console.log('[DONE] Log criado');

    // 3. Deletar da tabela original
    console.log('[START] Deletando demanda...');
    await Promise.race([
      prisma.demandas.delete({
        where: { id: demandaId }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao deletar demanda')), 5000))
    ]);
    console.log('[DONE] Demanda deletada');

    res.json({ success: true, message: 'Demanda deletada e registrada no log' });
  } catch (error) {
    console.error('[ERROR] Erro ao deletar demanda:', error.message);
    
    if (error.message.includes('Timeout')) {
      return res.status(504).json({ 
        error: 'Timeout ao deletar demanda. Banco travado.',
        details: error.message
      });
    }
    
    res.status(500).json({ error: 'Erro ao deletar demanda', details: error.message });
  }
});





module.exports = router;











