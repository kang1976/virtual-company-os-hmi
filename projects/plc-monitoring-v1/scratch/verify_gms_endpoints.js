const http = require('http');

function test(path) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000' + path, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ path, status: res.statusCode, length: body.length }));
    }).on('error', err => resolve({ path, error: err.message }));
  });
}

async function verifyAll() {
  const paths = [
    '/gms.html',
    '/gms.js',
    '/gms.css',
    '/Operation.js',
    '/gms-diagram.svg',
    '/api/health',
    '/api/variables',
    '/api/gms/valves',
    '/api/gms/pts',
    '/api/gms/main-sequence',
    '/api/gms/users',
    '/OPERATION HTML/가스공급_준비완료.html',
    '/grid/'
  ];

  console.log('=== GMS 주요 엔드포인트 응답 검증 ===');
  for (const p of paths) {
    const r = await test(encodeURI(p));
    console.log(`[${r.status === 200 ? 'SUCCESS 200' : 'STATUS ' + r.status}] ${p} (${r.length} bytes)`);
  }
}

verifyAll();
