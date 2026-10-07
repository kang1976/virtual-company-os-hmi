const http = require('http');

function testUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, length: data.length, data: data.slice(0, 100) }));
    }).on('error', err => reject(err));
  });
}

async function runTests() {
  console.log('=== 서버 동작 검증 시작 ===');
  const urls = [
    'http://localhost:3000/gms.html',
    'http://localhost:3000/api/config',
    'http://localhost:3000/api/gms-data',
    'http://localhost:3000/gms-diagram.svg',
    'http://localhost:3000/Operation.js',
    'http://localhost:3000/OPERATION%20HTML/%EA%B0%80%EC%8A%A4%EA%B3%B5%EA%B8%89_%EC%A4%80%EB%B9%84%EC%99%84%EB%A3%8C.html'
  ];

  for (const url of urls) {
    try {
      const res = await testUrl(url);
      console.log(`[PASS] ${url} -> Status: ${res.status}, Size: ${res.length} bytes`);
    } catch (e) {
      console.log(`[FAIL] ${url} -> Error: ${e.message}`);
    }
  }
  console.log('=== 서버 동작 검증 완료 ===');
}

runTests();
