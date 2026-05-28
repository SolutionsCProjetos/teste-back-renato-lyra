const express = require('express');
const net = require('net');
const router = express.Router();

function parseDatabaseUrl(dbUrl) {
  try {
    const cleaned = dbUrl.replace(/^jdbc:/, '');
    const u = new URL(cleaned);
    return { host: u.hostname, port: parseInt(u.port) || 3306 };
  } catch (err) {
    return null;
  }
}

router.get('/db-tcp-check', async (req, res) => {
  const raw = process.env.DATABASE_URL;
  if (!raw) return res.status(500).json({ ok: false, error: 'DATABASE_URL not set in env' });

  const info = parseDatabaseUrl(raw);
  if (!info) return res.status(400).json({ ok: false, error: 'Could not parse DATABASE_URL' });

  const { host, port } = info;
  const timeoutMs = parseInt(req.query.ms) || 3000;

  const start = Date.now();
  const socket = net.createConnection({ host, port }, () => {
    const duration = Date.now() - start;
    socket.end();
    return res.json({ ok: true, host, port, durationMs: duration });
  });

  socket.setTimeout(timeoutMs, () => {
    socket.destroy();
    return res.status(504).json({ ok: false, error: `TCP connect timed out after ${timeoutMs}ms`, host, port });
  });

  socket.on('error', (err) => {
    return res.status(502).json({ ok: false, error: 'TCP connection error', details: err.message, host, port });
  });
});

module.exports = router;
