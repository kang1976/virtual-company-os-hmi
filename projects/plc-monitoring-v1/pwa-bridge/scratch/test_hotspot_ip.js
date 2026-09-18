const https = require('https');

const options = {
  hostname: '10.219.30.135',
  port: 3001,
  path: '/',
  method: 'GET',
  rejectUnauthorized: false
};

const req = https.request(options, res => {
  console.log('Status Code via 10.219.30.135:3001 ->', res.statusCode);
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Response Size:', data.length, 'bytes'));
});

req.on('error', e => {
  console.error('Error via 10.219.30.135:', e);
});

req.end();
