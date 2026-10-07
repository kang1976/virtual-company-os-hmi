// ============================================================
// server.js — P&ID HMI 전용 웹 서버 & WebSocket 실시간 브로드캐스터
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

// node_modules 경로 참조 (plc-monitoring 모듈 공유)
let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  try {
    WebSocket = require('D:/AI_Work/Antigravity/plc-monitoring/pc-app/node_modules/ws');
  } catch (err) {
    console.log('[Notice] ws module not found, fallback to pure HTTP server.');
  }
}

const PORT = 3005;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.json': 'application/json',
};

// ── HTTP 정적 파일 서빙 ─────────────────────────────────────
const server = http.createServer((req, res) => {
  // Query String(?v=...) 제거하여 정확한 로컬 파일 경로 매핑
  const cleanUrl = req.url.split('?')[0];
  let filePath = path.join(__dirname, cleanUrl === '/' ? 'index.html' : cleanUrl);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// ── WebSocket 서버 & 실시간 Tag 시뮬레이터 ──────────────────
if (WebSocket) {
  const wss = new WebSocket.Server({ server, path: '/pid' });

  // 가상 Tag 상태 메모리
  const state = {
    A_HPT: 1813.0, A_MPT: 116.0, A_LPT: 43.0, A_FPT: 36.0,
    A_HPI: false, A_LPI: false, A_FPV: false, A_VS: false, A_AG: true,
    A_TEMP: 65.0, A_WEIGHT: 45.2, A_LEVEL: 100,

    B_HPT: 1813.0, B_MPT: 116.0, B_LPT: 43.0, B_FPT: 36.0,
    B_HPI: false, B_LPI: false, B_FPV: false, B_VS: false, B_AG: true,
    B_TEMP: 65.0, B_WEIGHT: 45.2, B_LEVEL: 100,
  };

  wss.on('connection', (ws) => {
    console.log('[HMI-WS] 브라우저 클라이언트 연결됨');
    // 초기 전체 상태 전송
    ws.send(JSON.stringify(state));

    // 클라이언트 명령 수신 (밸브 수동 제어 등)
    ws.on('message', (msg) => {
      try {
        const payload = JSON.parse(msg);
        if (payload.action === 'set_tag' && state.hasOwnProperty(payload.tag)) {
          state[payload.tag] = payload.value;
          console.log(`[HMI-WS] Tag 변경: ${payload.tag} = ${payload.value}`);
          // 전체 브로드캐스트
          broadcast(wss, { [payload.tag]: payload.value });
        }
      } catch (err) {}
    });
  });

  function broadcast(serverInstance, data) {
    const json = JSON.stringify(data);
    serverInstance.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    });
  }

  // 1초 주기로 실시간 센서값 변동 브로드캐스트
  setInterval(() => {
    const delta = {};
    ['A_HPT', 'B_HPT'].forEach(k => delta[k] = +(1813.0 + (Math.random() - 0.5) * 5.0).toFixed(1));
    ['A_MPT', 'B_MPT'].forEach(k => delta[k] = +(116.0 + (Math.random() - 0.5) * 2.0).toFixed(1));
    ['A_LPT', 'B_LPT'].forEach(k => delta[k] = +(43.0 + (Math.random() - 0.5) * 1.0).toFixed(1));
    ['A_FPT', 'B_FPT'].forEach(k => delta[k] = +(36.0 + (Math.random() - 0.5) * 0.6).toFixed(1));
    ['A_TEMP', 'B_TEMP'].forEach(k => delta[k] = +(65.0 + (Math.random() - 0.5) * 0.4).toFixed(1));

    ['A_LEVEL', 'B_LEVEL'].forEach(k => {
      let cur = state[k] || 100;
      let next = cur - 1;
      if (next <= 5) next = 100;
      delta[k] = next;
    });

    ['A_WEIGHT', 'B_WEIGHT'].forEach(k => {
      let cur = state[k] || 45.2;
      let next = +(cur - 0.05).toFixed(1);
      if (next <= 10.0) next = 45.2;
      delta[k] = next;
    });

    Object.assign(state, delta);
    broadcast(wss, delta);
  }, 1000);
}

server.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🚀 [P&ID HMI Server] 실행 중: http://localhost:${PORT}`);
  console.log('========================================================');
});
