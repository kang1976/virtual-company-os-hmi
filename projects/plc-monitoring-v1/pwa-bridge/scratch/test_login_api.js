const http = require('http');
const https = require('https');

// 직접 로그인 API 호출 테스트
function testLogin(loginId, password) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ loginId, password });
    const req = https.request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Testing admin / admin1234! :');
  console.log(await testLogin('admin', 'admin1234!'));
  console.log('Testing test1234 / test1234 :');
  console.log(await testLogin('test1234', 'test1234'));
  console.log('Testing admin / admin :');
  console.log(await testLogin('admin', 'admin'));
}

run();
