const http = require('http');

function test(path) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000' + path, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ path, status: res.statusCode, length: body.length, body: body.slice(0, 100) }));
    }).on('error', err => resolve({ path, error: err.message }));
  });
}

async function verifyQueryEndpoints() {
  const paths = [
    '/api/gms/valves?unit=1',
    '/api/gms/sub-sequence-config?unit=1',
    '/api/gms/equipment?unit=1',
    '/api/gms/screen-titles'
  ];

  console.log('=== GMS 파라미터 엔드포인트 응답 검증 ===');
  for (const p of paths) {
    const r = await test(encodeURI(p));
    console.log(`[${r.status === 200 ? 'SUCCESS 200' : 'STATUS ' + r.status}] ${p} (${r.length} bytes)`);
  }
}

verifyQueryEndpoints();
