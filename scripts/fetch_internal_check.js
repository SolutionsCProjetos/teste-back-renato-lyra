const https = require('https');

https.get('https://renato-lyra-back.vercel.app/internal/db-tcp-check?ms=5000', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('statusCode:', res.statusCode);
    try { console.log('body:', JSON.parse(data)); } catch (e) { console.log('body text:', data); }
  });
}).on('error', (err) => {
  console.error('request error:', err);
});
