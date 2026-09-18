const https = require('https');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/',
  method: 'GET',
  rejectUnauthorized: false
};

const req = https.request(options, res => {
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Response Size:', data.length, 'bytes'));
});

req.on('error', e => {
  console.error('Error:', e);
});

req.end();
