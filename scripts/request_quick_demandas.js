const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3333,
  path: '/demandas/quick?ms=3000',
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
};

const req = http.request(options, (res) => {
  let data = ''; 
  console.log('statusCode:', res.statusCode);
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try { console.log('body:', JSON.parse(data)); } catch (e) { console.log('body text:', data); }
  });
});

req.on('error', (err) => { console.error('request error:', err.message || err); });
req.end();
