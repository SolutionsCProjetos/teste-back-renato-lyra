const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'PjTeste';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const [_, token] = authHeader.split(' ');

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // agora disponível em qualquer rota com req.user
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido' });
  }
}

module.exports = authMiddleware;
