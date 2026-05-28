const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

const authMiddleware = require('../../middlewares/auth');
router.use(authMiddleware);

// 📌 Criar um novo líder
router.post('/', async (req, res) => {
  try {
    const { nome, bairro } = req.body;

    const novoLider = await prisma.lider.create({
      data: {
        nome,
        bairro
      }
    });

    res.json(novoLider);
  } catch (error) {
    console.error('Erro ao criar líder:', error);
    res.status(500).json({ error: 'Erro ao criar líder.' });
  }
});

// 📌 Listar todos os líderes
router.get('/', async (req, res) => {
  try {
    const lista = await prisma.lider.findMany({
      orderBy: { id: 'asc' }
    });

    res.json(lista);
  } catch (error) {
    console.error('Erro ao listar líderes:', error);
    res.status(500).json({ error: 'Erro ao buscar líderes.' });
  }
});

// 📌 Obter um líder por ID
router.get('/:id', async (req, res) => {
  try {
    const lider = await prisma.lider.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!lider) {
      return res.status(404).json({ error: 'Líder não encontrado.' });
    }

    res.json(lider);
  } catch (error) {
    console.error('Erro ao buscar líder:', error);
    res.status(500).json({ error: 'Erro ao buscar líder.' });
  }
});

// 📌 Atualizar um líder por ID
router.put('/:id', async (req, res) => {
  try {
    const { nome, bairro } = req.body;

    const liderAtualizado = await prisma.lider.update({
      where: { id: parseInt(req.params.id) },
      data: {
        nome,
        bairro
      }
    });

    res.json(liderAtualizado);
  } catch (error) {
    console.error('Erro ao atualizar líder:', error);
    res.status(500).json({ error: 'Erro ao atualizar líder.' });
  }
});

// 📌 Deletar um líder por ID
router.delete('/:id', async (req, res) => {
  try {
    await prisma.lider.delete({
      where: { id: parseInt(req.params.id) }
    });

    res.json({ deleted: true });
  } catch (error) {
    console.error('Erro ao deletar líder:', error);
    res.status(500).json({ error: 'Erro ao deletar líder.' });
  }
});

module.exports = router;
