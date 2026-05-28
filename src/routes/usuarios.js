const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

const authMiddleware = require('../../middlewares/auth');
router.use(authMiddleware);

const saltRounds = 10;

// CRUD igual ao de solicitantes


router.post('/', async (req, res) => {
  try {
    const { nome, email, empresa, rule, setorId, senha } = req.body;

    let senhaCriptografada = null;
    if (senha) {
      senhaCriptografada = await bcrypt.hash(senha, saltRounds);
    }

    const item = await prisma.usuarios.create({
      data: {
        nome,
        email,
        empresa,
        rule,
        setorId,
        senha: senhaCriptografada,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    res.json(item);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});




router.get('/', async (req, res) => {
  try {
    const list = await prisma.usuarios.findMany({
      include: {
        setores: true, // Isso traz o nome do setor vinculado pelo setorId
      },
      orderBy: { id: 'asc' } // opcional: organiza a lista
    });

    // Mapeia o resultado para formatar a resposta
    const response = list.map(user => ({
      id: user.id,
      nome: user.nome,
      email: user.email,
      empresa: user.empresa,
      rule: user.rule,
      adm: user.adm,
      setorId: user.setorId,
      setor: user.setores?.nome || 'Não informado',
      tipo: user.rule === 1 ? 'Administrador' : 'Supervisor',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários', detalhe: error.message });
  }
});


router.get('/:id', async (req, res) => {
  const item = await prisma.usuarios.findUnique({ where: { id: parseInt(req.params.id) } });
  res.json(item);
});

router.put('/:id', async (req, res) => {
  try {
    const { nome, email, empresa, rule, setorId, senha, novaSenha  } = req.body;

    console.log('Dados recebidos no update:', req.body);


    const dataToUpdate = {
      nome,
      email,
      empresa,
      rule,
      setorId,
      updatedAt: new Date()
    };

    if (novaSenha || senha) {
  const senhaCriptografada = await bcrypt.hash(novaSenha || senha, saltRounds);
  dataToUpdate.senha = senhaCriptografada;
}

    const item = await prisma.usuarios.update({
      where: { id: parseInt(req.params.id) },
      data: dataToUpdate
    });

    res.json(item);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
});



router.delete('/:id', async (req, res) => {
  await prisma.usuarios.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ deleted: true });
});

module.exports = router;
