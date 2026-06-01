const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const router = express.Router();

// Reuse PrismaClient singleton
const prisma = require('../prismaClient')
const saltRounds = 10;
const jwt = require('jsonwebtoken')

// Helper retry wrapper for transient DB errors (e.g., lock wait timeout 1205)
async function withRetry(fn, retries = 3, baseDelay = 200) {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      const isLockWait = err && err.message && err.message.includes('Lock wait timeout')
      if (attempt > retries || !isLockWait) throw err
      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.warn(`Transient DB error detected (attempt ${attempt}/${retries}). Retrying after ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

// Helper: uma Promise que rejeita após ms
function timeoutPromise(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

// Rota de diagnóstico para testar latência do DB
router.get('/db-test', async (req, res) => {
  // timeout em ms (aceita ?ms=... no querystring)
  const timeoutMs = parseInt(req.query.ms) || 5000;
  try {
    const start = Date.now();
    // Promise.race entre a query rápida e o timeout 
    const result = await Promise.race([
      prisma.$queryRaw`SELECT 1 as ok`,
      timeoutPromise(timeoutMs, `DB query exceeded ${timeoutMs}ms`)
    ]);
    const duration = Date.now() - start;
    res.json({ ok: true, durationMs: duration, raw: result });
  } catch (err) {
    console.error('DB test error:', err.message || err);
    res.status(504).json({ ok: false, error: err.message || String(err) });
  }
});

// const authMiddleware = require('../../middlewares/auth');
// router.use(authMiddleware);

const SECRET = process.env.JWT_SECRET || 'PjTeste'

// Registrar novo solicitante
// router.post('/register', async (req, res) => {
//   const { cpf, senha, ...dados } = req.body;

//   if (!cpf || !senha) {
//     return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
//   }

//   try {
//     const existenteUnico = await prisma.solicitantes_unicos.findFirst({ where: { cpf } });
//     const senhaHash = await bcrypt.hash(senha, saltRounds);

//     let solicitanteUnicoId;

//     if (existenteUnico) {
//       await prisma.solicitantes_unicos.update({
//         where: { id: existenteUnico.id },
//         data: { senha: senhaHash }
//       });
//       solicitanteUnicoId = existenteUnico.id;
//     } else {
//       const novoUnico = await prisma.solicitantes_unicos.create({
//         data: {
//           cpf,
//           senha: senhaHash,
//           ...dados
//         }
//       });
//       solicitanteUnicoId = novoUnico.id;
//     }

//     // Cria na tabela de solicitantes com o mesmo ID do solicitantes_unicos
//     const novoSolicitante = await prisma.solicitantes.create({
//       data: {
//         id: solicitanteUnicoId, // mesmo id da tabela de unicos
//         cpf,
//         ...dados
//       }
//     });

//     return res.json({
//       message: 'Solicitante registrado com sucesso',
//       solicitante: novoSolicitante
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Erro ao registrar/login', detalhe: error.message });
//   }
// });

// router.post('/register', async (req, res) => {
//   const { cpf, senha, ...dados } = req.body;

//   console.log('🔵 Requisição recebida:', { cpf, senha, ...dados });

//   if (!cpf || !senha) {
//     console.log('❌ CPF ou senha não informados');
//     return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
//   }

//   const cpfLimpo = cpf.replace(/\D/g, '');
//   console.log('📌 CPF normalizado:', cpfLimpo);

//   try {
//     // Busca todos os registros e compara os CPFs já normalizados
//     const candidatos = await prisma.solicitantes_unicos.findMany({
//       select: { id: true, cpf: true, senha: true }
//     });

//     const existenteUnico = candidatos.find(entry => {
//       if (!entry.cpf) return false;
//       const cpfBanco = entry.cpf.replace(/\D/g, '');
//       return cpfBanco === cpfLimpo;
//     });

//     console.log('🔍 Resultado da busca (cpf comparado com e sem pontuação):', existenteUnico);

//     const senhaHash = await bcrypt.hash(senha, 10);
//     let solicitanteUnicoId;

//     if (existenteUnico) {
//       if (!existenteUnico.senha || existenteUnico.senha.trim() === '') {
//         console.log('✏️ Atualizando senha do solicitante existente (ID:', existenteUnico.id, ')');
//         await prisma.solicitantes_unicos.update({
//           where: { id: existenteUnico.id },
//           data: {
//             senha: senhaHash,
//             cpf: cpfLimpo // opcional: atualizar o CPF para o formato limpo no banco
//           }
//         });
//         solicitanteUnicoId = existenteUnico.id;
//       } else {
//         console.log('⚠️ CPF já registrado com senha. Bloqueando novo cadastro.');
//         return res.status(400).json({
//           error: 'Já existe um usuário com este CPF e senha definida. Faça login ou recupere sua senha.'
//         });
//       }
//     } else {
//       console.log('🆕 Criando novo registro em solicitantes_unicos...');
//       const novoUnico = await prisma.solicitantes_unicos.create({
//         data: {
//           cpf: cpfLimpo,
//           senha: senhaHash,
//           ...dados
//         }
//       });
//       console.log('✅ Registro criado:', novoUnico);
//       solicitanteUnicoId = novoUnico.id;
//     }

//     const existenteSolicitante = await prisma.solicitantes.findUnique({
//       where: { id: solicitanteUnicoId }
//     });

//     if (!existenteSolicitante) {
//       console.log('📥 Criando novo registro na tabela solicitantes...');
//       const novoSolicitante = await prisma.solicitantes.create({
//         data: {
//           id: solicitanteUnicoId,
//           cpf: cpfLimpo,
//           ...dados
//         }
//       });

//       console.log('✅ Novo solicitante criado:', novoSolicitante);
//       return res.json({
//         message: 'Solicitante registrado com sucesso',
//         solicitante: novoSolicitante
//       });
//     } else {
//       console.log('ℹ️ Solicitante já estava registrado anteriormente:', existenteSolicitante);
//       return res.json({
//         message: 'Solicitante já registrado anteriormente',
//         solicitante: existenteSolicitante
//       });
//     }

//   } catch (error) {
//     console.error('🔥 ERRO AO REGISTRAR:', error);
//     return res.status(500).json({
//       error: 'Erro ao registrar',
//       detalhe: error.message
//     });
//   }
// });


router.post('/register', async (req, res) => {
  const { cpf, senha, ...dados } = req.body;

  if (!cpf || !senha) {
    return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
  }

  const cpfLimpo = cpf.replace(/\D/g, '');

  console.log(req.body, 'body recebido')

  try {
    const startHash = Date.now();
    const senhaHash = await bcrypt.hash(senha, 10);
    console.log(`bcrypt.hash took ${Date.now() - startHash}ms`);

  // 🔍 1. Busca em solicitantes_unicos (com CPF normalizado)
  // Evita varredura completa: primeiro tenta buscar por cpf exato, depois fallback para comparar sem pontuação via SQL
  let existenteUnico = null
  try {
    const startFindUnicos = Date.now();
    existenteUnico = await prisma.solicitantes_unicos.findFirst({ where: { cpf: cpfLimpo } });
    console.log(`prisma.solicitantes_unicos.findFirst(exact) took ${Date.now() - startFindUnicos}ms`);

    if (!existenteUnico) {
      // Fallback: comparar removendo pontos/traços diretamente no SQL (mais robusto se DB armazenou com formatação)
      const startRaw = Date.now();
      const rows = await prisma.$queryRawUnsafe(
        "SELECT * FROM solicitantes_unicos WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ? LIMIT 1",
        cpfLimpo
      );
      console.log(`prisma.$queryRawUnsafe(find by normalized cpf) took ${Date.now() - startRaw}ms`);
      if (rows && rows.length) existenteUnico = rows[0];
    }
  } catch (err) {
    console.error('Erro buscando solicitantes_unicos:', err);
    // não falha aqui, continua para lógica de criação
  }

     console.log(req.body, 'body recebido dentro do try')

    // ❌ Se já tem senha definida → bloqueia
    if (existenteUnico && existenteUnico.senha?.trim()) {
      return res.status(400).json({
        error: 'Já existe um usuário com este CPF e senha definida. Faça login ou recupere sua senha.'
      });
    }

  // 🔍 2. Busca em solicitantes com CPF normalizado
  // 🔍 2. Busca em solicitantes com CPF normalizado (evita scan completo)
  let solicitanteExistente = null
  try {
    const startFindSolic = Date.now();
    solicitanteExistente = await prisma.solicitantes.findFirst({ where: { cpf: cpfLimpo } });
    console.log(`prisma.solicitantes.findFirst(exact) took ${Date.now() - startFindSolic}ms`);

    if (!solicitanteExistente) {
      const startRaw2 = Date.now();
      const rows2 = await prisma.$queryRawUnsafe(
        "SELECT * FROM solicitantes WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ? LIMIT 1",
        cpfLimpo
      );
      console.log(`prisma.$queryRawUnsafe(solicitantes normalized cpf) took ${Date.now() - startRaw2}ms`);
      if (rows2 && rows2.length) solicitanteExistente = rows2[0];
    }
  } catch (err) {
    console.error('Erro buscando solicitantes:', err);
  }

    const { meio, zonaEleitoral, observacoes, liderId, liderNome, ...dadosSemMeio } = dados;
    let idFinal;

     console.log(dadosSemMeio, 'dados sem meio antes de chamar unicos')

    if (solicitanteExistente) {
  idFinal = solicitanteExistente.id;

      // ✅ Cria ou atualiza em solicitantes_unicos com mesmo ID
      if (!existenteUnico) {
        const t0 = Date.now();
        // retry wrapper to handle occasional lock wait timeouts
        await withRetry(async () => {
          return await prisma.solicitantes_unicos.create({
            data: {
              id: idFinal,
              cpf: cpfLimpo,
              senha: senhaHash,
              meio: meio || null,
              zonaEleitoral: zonaEleitoral || null,
              ...dadosSemMeio
            }
          })
        })
        console.log(`prisma.solicitantes_unicos.create() took ${Date.now() - t0}ms`);
      } else {
        const t0 = Date.now();
        await withRetry(async () => {
          return await prisma.solicitantes_unicos.update({
            where: { id: existenteUnico.id },
            data: {
              senha: senhaHash,
              meio: meio || null,
              zonaEleitoral: zonaEleitoral || null,
              ...dadosSemMeio
            }
          })
        })
        console.log(`prisma.solicitantes_unicos.update() took ${Date.now() - t0}ms`);
      }

      return res.json({
        message: 'Solicitante vinculado ao CPF existente em solicitantes',
        id: idFinal
      });
    }

    // 🆕 3. Se não existe em nenhuma, cria nas duas com mesmo ID
    // Criar ambos em uma única transação para evitar condições de corrida/locks
    const startCreateTxn = Date.now();
    const txnResult = await withRetry(async () => {
      return await prisma.$transaction(async (tx) => {
        const novoSolicitante = await tx.solicitantes.create({
          data: {
            cpf: cpfLimpo,
            ...dadosSemMeio // "meio" não vai aqui
          }
        })

        const novoUnico = await tx.solicitantes_unicos.create({
          data: {
            id: novoSolicitante.id,
            cpf: cpfLimpo,
            senha: senhaHash,
            meio: meio || null,
            observacoes: observacoes || null,
            liderId: liderId || null,
            zonaEleitoral: zonaEleitoral || null,
            ...dadosSemMeio
          }
        })

        return { novoSolicitante, novoUnico }
      })
    })
    console.log(`prisma transaction (create solicitante + unico) took ${Date.now() - startCreateTxn}ms`);

    const novoSolicitante = txnResult.novoSolicitante
    const novoUnico = txnResult.novoUnico
    idFinal = novoSolicitante.id

    return res.json({
      message: 'Novo solicitante criado com sucesso nas duas tabelas',
      solicitante: novoSolicitante,
      solicitante_unico: novoUnico
    });

  } catch (error) {
    console.error('Erro ao registrar:', error);
    return res.status(500).json({
      error: 'Erro ao registrar solicitante',
      detalhe: error.message
    });
  }
});













// router.post('/login', async (req, res) => {
//   const { email, senha } = req.body;

//   // Validação dos campos de entrada
//   if (!email || !senha) {
//     return res.status(400).json({ 
//       error: 'Credenciais obrigatórias',
//       message: 'E-mail/CPF e senha são obrigatórios para login' 
//     });
//   }

//   try {
//     // 1. Primeiro tenta encontrar como usuário (apenas por email)
//     let user = await prisma.usuarios.findUnique({
//       where: { 
//         email: email.toLowerCase().trim() 
//       },
//       select: { // Adicione esta parte
//         id: true,
//         nome: true,
//         email: true,
//         senha: true,
//         empresa: true,
//         rule: true,
//         setorId: true,
//         adm: true, // Garante que o campo será retornado
//         createdAt: true,
//         updatedAt: true
//       }
//     });

//     console.log(user, 'user')

//     let tipo = 'usuario';

//     // 2. Se não encontrou como usuário, tenta como solicitante (por email ou CPF)
//     if (!user) {
//       user = await prisma.solicitantes_unicos.findFirst({
//         where: {
//           OR: [
//             { email: email.toLowerCase().trim() },
//             { cpf: email.replace(/\D/g, '') } // Remove não-números do CPF
//           ]
//         }
//       });
//       tipo = 'solicitante';
//     }

//     // 3. Se não encontrou em nenhuma tabela
//     if (!user) {
//       return res.status(404).json({ 
//         error: 'Credenciais inválidas',
//         message: 'Nenhuma conta encontrada com este e-mail/CPF' 
//       });
//     }

//     // 4. Verifica se a senha existe (para casos onde o usuário pode não ter senha)
//     if (!user.senha) {
//       return res.status(401).json({ 
//         error: 'Configuração incompleta',
//         message: 'Este usuário não possui senha definida' 
//       });
//     }

//     // 5. Compara a senha
//     const senhaValida = await bcrypt.compare(senha, user.senha);
//     if (!senhaValida) {
//       return res.status(401).json({ 
//         error: 'Credenciais inválidas',
//         message: 'Senha incorreta' 
//       });
//     }

//     console.log(user, 'user aqui')

//     // 6. Remove a senha do objeto de usuário antes de retornar
//     const { senha: _, ...userSemSenha } = user;

//     // 7. Gera o token JWT
//     const token = jwt.sign(
//       {
//         id: user.id,
//         email: user.email,
//         cpf: user.cpf || null, // Pode ser undefined para usuarios
//         adm: user.adm || false, // Assume false se não existir
//         tipo
//       },
//       process.env.JWT_SECRET || SECRET,
//       { expiresIn: '1d' }
//     );

//     // 8. Retorna resposta de sucesso
//     return res.json({
//       success: true,
//       message: 'Login realizado com sucesso',
//       usuario: userSemSenha,
//       token,
//       tipo
//     });

//   } catch (error) {
//     console.error('Erro no login:', error);
//     return res.status(500).json({ 
//       error: 'Erro no servidor',
//       message: 'Ocorreu um erro durante o login',
//       details: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// });


//novo login


// router.post('/login', async (req, res) => {
//   const { email, senha } = req.body;

//   if (!email || !senha) {
//     return res.status(400).json({
//       error: 'Credenciais obrigatórias',
//       message: 'E-mail/CPF e senha são obrigatórios para login'
//     });
//   }

//   try {
//     const emailBusca = email.trim().toLowerCase();
//     const isEmail = email.includes('@');
//     const cpfLimpo = email.replace(/\D/g, '');

//     let tipo = 'usuario';
//     let user = null;

//     console.log('[LOGIN] Email recebido formatado:', emailBusca);

//     // 1. Buscar como USUÁRIO
//     const usuarios = await prisma.usuarios.findMany({
//       where: {
//         email: {
//           contains: emailBusca
//         }
//       },
//       select: {
//         id: true,
//         nome: true,
//         email: true,
//         senha: true,
//         empresa: true,
//         rule: true,
//         setorId: true,
//         adm: true,
//         createdAt: true,
//         updatedAt: true
//       }
//     });

//     console.log(`[LOGIN] Usuários encontrados (potenciais): ${usuarios.length}`);

//     user = usuarios.find(u => 
//       u.email?.trim().toLowerCase() === emailBusca &&
//       !!u.senha
//     );

//     if (user) {
//       console.log('[LOGIN] Usuário encontrado como usuario:', user.email);
//     }

//     // 2. Buscar como SOLICITANTE, se não achou como usuário
//     if (!user) {
//       tipo = 'solicitante';

//       let solicitantesList = [];

//       if (isEmail) {
//         solicitantesList = await prisma.solicitantes_unicos.findMany({
//           where: {
//             email: {
//               contains: emailBusca
//             }
//           }
//         });
//       } else {
//         solicitantesList = await prisma.solicitantes_unicos.findMany({
//           where: {
//             cpf: cpfLimpo
//           }
//         });
//       }

//       console.log(`[LOGIN] Solicitantes encontrados (potenciais): ${solicitantesList.length}`);

//       user = solicitantesList.find(s =>
//         (
//           s.email?.trim().toLowerCase() === emailBusca ||
//           s.cpf?.replace(/\D/g, '') === cpfLimpo
//         ) &&
//         !!s.senha
//       );

//       if (user) {
//         console.log('[LOGIN] Usuário encontrado como solicitante:', user.email || user.cpf);
//       }
//     }

//     // 3. Se ainda não encontrou nenhum usuário com senha
//     if (!user) {
//       console.log('[LOGIN] Nenhum usuário com senha válida encontrado');
//       return res.status(401).json({
//         error: 'Credenciais inválidas',
//         message: 'E-mail/CPF ou senha incorretos ou conta sem senha definida'
//       });
//     }

//     // 4. Valida a senha
//     const senhaValida = await bcrypt.compare(senha, user.senha);
//     console.log('[LOGIN] Senha válida?', senhaValida);

//     if (!senhaValida) {
//       return res.status(401).json({
//         error: 'Credenciais inválidas',
//         message: 'Senha incorreta'
//       });
//     }

//     // 5. Gera token
//     const { senha: _, ...userSemSenha } = user;
//     const token = jwt.sign(
//       {
//         id: user.id,
//         email: user.email,
//         cpf: tipo === 'solicitante' ? user.cpf : null,
//         adm: user.adm || false,
//         tipo
//       },
//       process.env.JWT_SECRET || SECRET,
//       { expiresIn: '1d' }
//     );

//     console.log('[LOGIN] Login realizado com sucesso! Tipo:', tipo);

//     return res.json({
//       success: true,
//       message: 'Login realizado com sucesso',
//       usuario: userSemSenha,
//       token,
//       tipo
//     });

//   } catch (error) {
//     console.error('[LOGIN] Erro no login:', error);
//     return res.status(500).json({
//       error: 'Erro no servidor',
//       message: 'Ocorreu um erro durante o login',
//       details: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// });


router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({
      error: 'Credenciais obrigatórias',
      message: 'E-mail/CPF e senha são obrigatórios para login'
    });
  }

  console.log(email, senha, "email e senha ou cpf recebidos");

  try {
    const emailBusca = email.trim().toLowerCase();
    const isEmail = email.includes('@');
    const cpfLimpo = email.replace(/\D/g, '');

    console.log(emailBusca, isEmail, cpfLimpo, "email e cpf formatados");

    let tipo = 'usuario';
    let user = null;

    console.log('[LOGIN] Valor recebido:', email);

    // 1. Buscar como USUÁRIO
    const usuarios = await prisma.usuarios.findMany({
      where: {
        email: {
          contains: emailBusca
        }
      },
      select: {
        id: true,
        nome: true,
        email: true,
        senha: true,
        empresa: true,
        rule: true,
        setorId: true,
        adm: true,
        createdAt: true,
        updatedAt: true
      }
    });

    user = usuarios.find(u =>
      u.email?.trim().toLowerCase() === emailBusca &&
      !!u.senha
    );

    if (user) {
      console.log('[LOGIN] Usuário autenticado como USUÁRIO:', user.email);
    }

    // 2. Se não achou como usuário, busca como SOLICITANTE
    if (!user) {
      tipo = 'solicitante';

      const solicitantesList = await prisma.solicitantes_unicos.findMany();

      console.log(`[LOGIN] Solicitantes encontrados: ${solicitantesList.length}`);

      user = solicitantesList.find(s =>
        (
          s.email?.trim().toLowerCase() === emailBusca ||
          s.cpf?.replace(/\D/g, '') === cpfLimpo
        ) &&
        !!s.senha
      );

      if (user) {
        console.log('[LOGIN] Usuário autenticado como SOLICITANTE:', user.email || user.cpf);
      }
    }

    // 3. Se ainda não achou ninguém
    if (!user) {
      console.log('[LOGIN] Nenhum usuário encontrado com senha válida');
      return res.status(401).json({
        error: 'Credenciais inválidas',
        message: 'E-mail/CPF ou senha incorretos ou conta sem senha definida'
      });
    }

    // 4. Valida a senha
    const senhaValida = await bcrypt.compare(senha, user.senha);
    console.log('[LOGIN] Senha válida?', senhaValida);

    if (!senhaValida) {
  return res.status(401).json({
    error: true, // Adicione esta linha
    message: 'Senha incorreta' // Mantenha esta
  });
}

    // 5. Gera token JWT
    const { senha: _, ...userSemSenha } = user;
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email || null,
        cpf: tipo === 'solicitante' ? user.cpf : null,
        adm: user.adm || false,
        nome: user.nomeCompleto || user.nome,
        tipo
      },
      process.env.JWT_SECRET || 'PjTeste',
      { expiresIn: '1d' }
    );

    console.log('[LOGIN] Login realizado com sucesso! Tipo:', tipo);

    return res.json({
      success: true,
      message: 'Login realizado com sucesso',
      usuario: userSemSenha,
      token,
      tipo
    });

  } catch (error) {
    console.error('[LOGIN] Erro no login:', error);
    return res.status(500).json({
      error: 'Erro no servidor',
      message: 'Ocorreu um erro durante o login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});





// Listar todos os solicitantes únicos
router.get('/', async (req, res) => {
  const { cpf } = req.query;

  try {
    let lista;

    if (cpf) {
      lista = await prisma.solicitantes_unicos.findMany({
        where: { cpf: String(cpf) }
      });
    } else {
      lista = await prisma.solicitantes_unicos.findMany();
    }

    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar', detalhe: error.message });
  }
});


// Buscar solicitantes com CPF ausente ou duplicado
router.get('/duplicados', async (req, res) => {
  try {
    const solicitantesComProblema = await prisma.$queryRawUnsafe(`
      SELECT * FROM solicitantes
      WHERE cpf IS NULL OR cpf = ''
      OR cpf IN (
        SELECT cpf FROM solicitantes
        WHERE cpf IS NOT NULL AND cpf != ''
        GROUP BY cpf
        HAVING COUNT(*) > 1
      )
      ORDER BY id ASC
    `);

    return res.json({
      total: solicitantesComProblema.length,
      duplicados: solicitantesComProblema
    });

  } catch (error) {
    console.error('[🔥 DUPLICADOS] Erro ao buscar via raw SQL:', error);
    return res.status(500).json({
      error: 'Erro ao buscar duplicados',
      detalhe: error.message
    });
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
// Atualizar solicitante
// router.put('/:id', async (req, res) => {
//   try {
//     const {
//       nomeCompleto,
//       cpf,
//       titulo,
//       telefoneContato,
//       email,
//       cep,
//       endereco,
//       num,
//       bairro,
//       zona,
//       pontoReferencia,
//       secaoEleitoral
//     } = req.body;

//     const dataAtualizada = {
//       nomeCompleto,
//       cpf,
//       titulo,
//       telefoneContato,
//       email,
//       cep,
//       endereco,
//       num,
//       bairro,
//       zona,
//       pontoReferencia,
//       secaoEleitoral
//     };

//     console.log('Atualizando solicitante ID:', req.params.id, 'com dados:', dataAtualizada);

//     const item = await prisma.solicitantes_unicos.update({
//       where: { id: parseInt(req.params.id) },
//       data: dataAtualizada
//     });

//     res.json(item);
//   } catch (error) {
//     console.error('Erro no PUT /solicitantes/:id:', error);
//     res.status(500).json({ error: 'Erro ao atualizar', detalhe: error.message });
//   }
// });


router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { indicadoPor, ...dadosSolicitanteUnico } = req.body;

    // Se indicadoPor foi enviado, inclui nos dados de atualização de ambas tabelas
    if (indicadoPor !== undefined) {
      dadosSolicitanteUnico.indicadoPor = indicadoPor;
    }

    // Normaliza CPF se estiver sendo atualizado
    if (dadosSolicitanteUnico.cpf) {
      dadosSolicitanteUnico.cpf = dadosSolicitanteUnico.cpf.replace(/\D/g, '');
    }

    console.log(`Atualizando solicitante ID ${id}`, dadosSolicitanteUnico);

    // Atualiza a tabela solicitantes_unicos (todos os campos incluindo indicadoPor se existir)
    const updatedUnico = await prisma.solicitantes_unicos.update({
      where: { id },
      data: dadosSolicitanteUnico
    });

    // Atualiza apenas o indicadoPor na tabela solicitantes (se existir)
    let updatedSolicitante = null;
    if (indicadoPor !== undefined) {
      updatedSolicitante = await prisma.solicitantes.update({
        where: { id },
        data: { indicadoPor }
      });
    }

    res.json({
      message: 'Atualização realizada com sucesso',
      detalhes: {
        solicitantes_unicos: 'Todos os campos enviados foram atualizados' + 
          (indicadoPor !== undefined ? ' (incluindo indicadoPor)' : ''),
        solicitantes: indicadoPor !== undefined 
          ? `Campo 'indicadoPor' atualizado para: ${indicadoPor}`
          : 'Nenhum campo atualizado (indicadoPor não foi enviado)',
      },
      dados: {
        solicitante_unico: updatedUnico,
        solicitante: updatedSolicitante || 'Não modificado'
      }
    });

  } catch (error) {
    console.error('Erro na atualização:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        error: 'Registro não encontrado',
        detalhe: error.meta?.cause || 'O ID pode não existir nas tabelas'
      });
    }

    res.status(500).json({ 
      error: 'Erro ao atualizar', 
      detalhe: error.message 
    });
  }
});



// Deletar
router.delete('/:id', async (req, res) => {
  try {
    await prisma.solicitantes_unicos.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar', detalhe: error.message });
  }
});



router.post('/verificar-identidade', async (req, res) => {
  const { email, cpf } = req.body;

  if (!email || !cpf) {
    return res.status(400).json({ message: 'Email e CPF são obrigatórios' });
  }

  const emailBusca = email.trim().toLowerCase();
  const cpfLimpo = cpf.replace(/\D/g, '');

  try {
    // 1. Verificar em usuarios apenas por email
    const usuario = await prisma.usuarios.findFirst({
      where: {
        email: emailBusca
      }
    });

    if (usuario) {
      return res.json({ message: 'Identidade confirmada como usuário' });
    }

    console.log(emailBusca, cpfLimpo, 'formatados email e cpf após a busca de usuário');

    // 2. Verificar solicitantes_unicos por email + CPF (removendo pontuação manualmente)
    const solicitantesList = await prisma.solicitantes_unicos.findMany({
      where: {
        email: emailBusca
      }
    });

    const solicitante = solicitantesList.find(s =>
      s.cpf?.replace(/\D/g, '') === cpfLimpo
    );

    console.log(solicitante, 'solicitante após a busca');

    if (solicitante) {
      return res.json({ message: 'Identidade confirmada como solicitante' });
    }

    return res.status(404).json({ message: 'Nenhuma conta encontrada com essas credenciais' });
  } catch (error) {
    console.error('[VERIFICAR IDENTIDADE] Erro:', error);
    return res.status(500).json({ message: 'Erro ao verificar identidade' });
  }
});





router.post('/redefinir-senha', async (req, res) => {
  const { email, cpf, novaSenha } = req.body;

  if (!email || !cpf || !novaSenha) {
    return res.status(400).json({ message: 'Email, CPF e nova senha são obrigatórios' });
  }

  const emailBusca = email.trim().toLowerCase();
  const cpfLimpo = cpf.replace(/\D/g, '');

  try {
    const senhaHash = await bcrypt.hash(novaSenha, 10);

    // 1. Tenta redefinir senha de SOLICITANTE com email + CPF
    const solicitantes = await prisma.solicitantes_unicos.findMany({
      where: { email: emailBusca }
    });

    const solicitante = solicitantes.find(s =>
      s.cpf?.replace(/\D/g, '') === cpfLimpo
    );

    if (solicitante) {
      await prisma.solicitantes_unicos.update({
        where: { id: solicitante.id },
        data: { senha: senhaHash }
      });

      return res.json({ message: 'Senha redefinida com sucesso para solicitante' });
    }

    // 2. Se não encontrou solicitante, tenta como USUÁRIO apenas por email
    const usuario = await prisma.usuarios.findFirst({
      where: {
        email: emailBusca
      }
    });

    if (usuario) {
      await prisma.usuarios.update({
        where: { id: usuario.id },
        data: { senha: senhaHash }
      });

      return res.json({ message: 'Senha redefinida com sucesso para usuário' });
    }

    // 3. Se não achou nenhum
    return res.status(404).json({ message: 'Nenhuma conta encontrada com esses dados' });
  } catch (error) {
    console.error('[REDEFINIR SENHA] Erro:', error);
    return res.status(500).json({ message: 'Erro ao redefinir senha' });
  }
});




router.post('/registrarID', async (req, res) => {
  const { id, cpf, senha, ...dados } = req.body;

  if (!cpf || !senha || !id) {
    return res.status(400).json({ error: 'ID, CPF e senha são obrigatórios' });
  }

  const cpfLimpo = cpf.replace(/\D/g, ''); // Remove tudo que não for número

  // Valida se o CPF tem 11 dígitos
  if (cpfLimpo.length !== 11) {
    return res.status(400).json({ error: 'CPF inválido (deve ter 11 dígitos)' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const { meio, zonaEleitoral, ...dadosSemMeio } = dados;

    // 🔍 1. Busca TODOS os registros em `solicitantes_unicos` e compara os CPFs (com e sem formatação)
    const todosUnicos = await prisma.solicitantes_unicos.findMany();
    const cpfJaExiste = todosUnicos.some((registro) => {
      const cpfBancoLimpo = registro.cpf?.replace(/\D/g, '') || '';
      return cpfBancoLimpo === cpfLimpo; // Compara os CPFs "limpos"
    });

    if (cpfJaExiste) {
      return res.status(400).json({
        error: 'CPF já cadastrado em solicitantes_unicos (em qualquer formato)',
        code: 'DUPLICATE_CPF'
      });
    }

    // 🔍 2. Verifica se o ID já existe em `solicitantes_unicos`
    const idExistente = await prisma.solicitantes_unicos.findUnique({
      where: { id }
    });

    if (idExistente) {
      return res.status(400).json({
        error: 'ID já está em uso em solicitantes_unicos',
        code: 'DUPLICATE_ID'
      });
    }

    // 🔄 3. Atualiza o CPF em `solicitantes` (se o ID existir)
    await prisma.solicitantes.updateMany({
      where: { id },
      data: { 
        cpf: cpfLimpo, // Salva sem formatação
        ...dadosSemMeio 
      }
    });

    // ✅ 4. Cria em `solicitantes_unicos` (com CPF normalizado)
    const novoUnico = await prisma.solicitantes_unicos.create({
      data: {
        id,
        cpf: cpfLimpo,
        senha: senhaHash,
        meio: meio || null,
        zonaEleitoral: zonaEleitoral || null,
        ...dadosSemMeio
      }
    });

    return res.json({
      success: true,
      message: 'Registro criado/atualizado com sucesso!',
      data: novoUnico
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    return res.status(500).json({
      error: 'Erro interno',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});







module.exports = router;





