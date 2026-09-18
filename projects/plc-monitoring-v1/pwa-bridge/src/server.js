'use strict';
// Design Ref: docs/02-design/design.md §1, §2 — 독립 브릿지 서버(Express+WebSocket), 기존 GMS 서버와 별개 프로세스

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const express = require('express');
const session = require('express-session');
const { WebSocketServer } = require('ws');

const db = require('./db');
const auditLog = require('./auditLog');
const { router: authRouter, requireAuth, requireRole } = require('./auth');
const commandGuard = require('./commandGuard');
const { importTags } = require('./tagImport');
const { TcpFinsClient } = require('./plcClient/tcpFinsClient');
const { readTagValue, wordAreaCode, TYPE_WORDS, normType } = require('./plcRead');
const trendLog = require('./trendLog');
const finsCommands = require('./plcClient/finsCommands');
const config = require('./config');

const PORT = process.env.PORT || 3001;
// PLC 접속 대상/폴링 주기는 config(data/config.json)에서 관리 — ADMIN이 /api/config로 변경 가능

const app = express();
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json());

// HTTP(S) 선택은 인증서 유무로 결정 — 세션 쿠키 secure 플래그도 이 값을 그대로 따름(아래 참고)
const CERT_DIR = path.join(__dirname, '..', 'certs');
const CERT_PATH = path.join(CERT_DIR, 'server.pem');
const KEY_PATH = path.join(CERT_DIR, 'server-key.pem');
const hasCerts = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

// Security Ref: /security-review 지적 사항 — 세션 쿠키에 secure 플래그 누락 시
// 평문 HTTP(인증서 없을 때의 자동 폴백 모드)로 쿠키가 노출되어, 같은 공장 와이파이의
// 누군가가 세션을 가로채 PLC 전면 제어 권한을 탈취할 수 있었음.
// HTTPS(인증서 있음)일 때만 secure를 켠다 — HTTP 폴백은 개발/테스트 전용으로 간주.
// Design Ref: design.md §3-1 — 세션 기반 인증(JWT 아님). MemoryStore는 단일 프로세스 로컬 운영 전제.
const sessionParser = session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: hasCerts, // HTTPS일 때만 쿠키가 전송되도록 강제
    maxAge: 8 * 60 * 60 * 1000,
  },
});
app.use(sessionParser);

app.use('/api', authRouter);

// ---- Tags ----
const listTagsStmt = db.prepare(`
  SELECT tag_id, symbol, name, address, area_type, data_type, bit_index, access, description, risk_level, source
  FROM tags
  WHERE (@search = '' OR symbol LIKE @searchLike OR name LIKE @searchLike OR description LIKE @searchLike)
    AND (@access = '' OR access = @access)
  ORDER BY symbol
  LIMIT @limit OFFSET @offset
`);
const countTagsStmt = db.prepare(`
  SELECT COUNT(*) AS n FROM tags
  WHERE (@search = '' OR symbol LIKE @searchLike OR name LIKE @searchLike OR description LIKE @searchLike)
    AND (@access = '' OR access = @access)
`);
const getTagStmt = db.prepare('SELECT * FROM tags WHERE tag_id = ?');
const setRiskLevelStmt = db.prepare("UPDATE tags SET risk_level = ?, updated_at = datetime('now') WHERE tag_id = ?");
const setAddressStmt = db.prepare(
  "UPDATE tags SET area_type = @areaType, address = @address, data_type = @dataType, bit_index = @bitIndex, updated_at = datetime('now') WHERE tag_id = @tagId"
);
const addWhitelistStmt = db.prepare('INSERT OR IGNORE INTO operator_whitelist (tag_id) VALUES (?)');
const removeWhitelistStmt = db.prepare('DELETE FROM operator_whitelist WHERE tag_id = ?');

// Plan SC: plan.md F3 — 약 2,000개 태그, 검색/페이지네이션 필수(고정 목록 아님)
app.get('/api/tags', requireAuth, (req, res) => {
  const search = String(req.query.search || '').trim();
  const access = String(req.query.access || '');
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const offset = Number(req.query.offset) || 0;
  // node:sqlite는 SQL에 없는 named parameter가 바인딩 객체에 섞여 있으면 에러를 던지므로
  // (better-sqlite3와 달리 여분 키를 허용하지 않음) 쿼리별로 필요한 키만 넘김
  const filterParams = { search, searchLike: `%${search}%`, access };
  const listParams = { ...filterParams, limit, offset };

  res.json({
    tags: listTagsStmt.all(listParams),
    total: countTagsStmt.get(filterParams).n,
    limit,
    offset,
  });
});

// Plan SC: schema.md §2-2 — Import 파이프라인(매핑표 도착 후 사용)
app.post('/api/tags/import', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const records = req.body?.records;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records 배열이 필요합니다.' });
  res.json(importTags(records));
});

// Plan SC: schema.md §2-1 — ADMIN이 개별 태그 위험등급을 수동 조정
app.patch('/api/tags/:id/risk', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const { riskLevel } = req.body || {};
  if (!['safe', 'caution', 'danger'].includes(riskLevel)) {
    return res.status(400).json({ error: 'riskLevel은 safe|caution|danger 중 하나여야 합니다.' });
  }
  const tag = getTagStmt.get(req.params.id);
  if (!tag) return res.status(404).json({ error: '태그를 찾을 수 없습니다.' });
  setRiskLevelStmt.run(riskLevel, tag.tag_id);
  auditLog.record({
    userId: req.user.userId,
    actionType: 'command_request', // 위험등급 조정도 감사 대상 — 별도 action_type 없이 target/before/after로 구분
    target: tag.tag_id,
    beforeValue: tag.risk_level,
    afterValue: riskLevel,
    result: 'success',
  });
  res.json({ ok: true });
});

// Plan B: 매핑표 도착 전, ADMIN이 개별 태그에 PLC 주소를 직접 배정(소수 태그 실기 검증용)
app.patch('/api/tags/:id/address', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const tag = getTagStmt.get(req.params.id);
  if (!tag) return res.status(404).json({ error: '태그를 찾을 수 없습니다.' });

  let { areaType, address, dataType, bitIndex } = req.body || {};
  if (areaType === '' || areaType == null) {
    // 주소 해제
    setAddressStmt.run({ tagId: tag.tag_id, areaType: null, address: null, dataType: null, bitIndex: null });
    return res.json({ ok: true, cleared: true });
  }
  try {
    wordAreaCode(areaType); // 유효한 영역인지 검증(D/W/CIO/H/E0..)
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const addrNum = Number(address);
  if (!Number.isInteger(addrNum) || addrNum < 0) {
    return res.status(400).json({ error: 'address는 0 이상의 정수여야 합니다.' });
  }
  let bit = null;
  if (bitIndex !== '' && bitIndex != null) {
    bit = Number(bitIndex);
    if (!Number.isInteger(bit) || bit < 0 || bit > 15) {
      return res.status(400).json({ error: 'bitIndex는 0~15 여야 합니다.' });
    }
  }
  let dt = bit != null ? 'BOOL' : normType(dataType || 'UINT');
  if (bit == null && !TYPE_WORDS[dt]) {
    return res.status(400).json({ error: `지원하지 않는 데이터 타입: ${dataType}` });
  }

  setAddressStmt.run({ tagId: tag.tag_id, areaType, address: String(addrNum), dataType: dt, bitIndex: bit });
  auditLog.record({
    userId: req.user.userId,
    actionType: 'command_request',
    target: tag.tag_id,
    beforeValue: `${tag.area_type || '-'}:${tag.address || '-'}`,
    afterValue: `${areaType}:${addrNum}${bit != null ? '.' + bit : ''}`,
    result: 'success',
  });
  res.json({ ok: true });
});

// Plan B: 단일 태그 실시간 값 읽기 (design.md §6 — 캐시 없이 매 요청 PLC 조회)
app.get('/api/tags/:id/value', requireAuth, async (req, res) => {
  const tag = getTagStmt.get(req.params.id);
  if (!tag) return res.status(404).json({ error: '태그를 찾을 수 없습니다.' });
  try {
    const r = await readTagValue(tag, plcClient);
    res.json({ tagId: tag.tag_id, symbol: tag.symbol, ...r });
  } catch (err) {
    const status = err.code === 'NO_ADDRESS' ? 409 : err.code === 'PLC_OFFLINE' ? 503 : 502;
    res.status(status).json({ error: err.message, code: err.code || null });
  }
});

// 태그 이름(심볼)·설명 수정 (ADMIN)
const renameTagStmt = db.prepare("UPDATE tags SET symbol=@symbol, name=@name, description=@description, updated_at=datetime('now') WHERE tag_id=@tagId");
const symbolTakenStmt = db.prepare('SELECT 1 FROM tags WHERE symbol = ? AND tag_id != ?');
app.patch('/api/tags/:id', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const tag = getTagStmt.get(req.params.id);
  if (!tag) return res.status(404).json({ error: '태그를 찾을 수 없습니다.' });
  const symbol = String(req.body?.symbol ?? tag.symbol).trim();
  if (!symbol) return res.status(400).json({ error: '심볼(이름)은 비울 수 없습니다.' });
  if (symbolTakenStmt.get(symbol, tag.tag_id)) return res.status(409).json({ error: '이미 같은 심볼의 태그가 있습니다.' });
  const name = req.body?.name != null ? String(req.body.name).trim() : tag.name;
  const description = req.body?.description != null ? String(req.body.description).trim() : tag.description;
  renameTagStmt.run({ tagId: tag.tag_id, symbol, name: name || null, description: description || null });
  auditLog.record({
    userId: req.user.userId, actionType: 'command_request', target: tag.tag_id,
    beforeValue: tag.symbol, afterValue: symbol, result: 'success',
  });
  res.json({ ok: true });
});

// ---- 트렌드 로깅 (design.md §9) ----
app.get('/api/trend/status', requireAuth, (req, res) => res.json(trendLog.status()));
app.get('/api/trend/series', requireAuth, (req, res) => res.json({ series: trendLog.listSeries() }));

app.post('/api/trend/series', requireAuth, requireRole(['ADMIN']), (req, res) => {
  try {
    const s = trendLog.addSeries(req.body || {});
    auditLog.record({ userId: req.user.userId, actionType: 'command_request', target: 'trend.series', afterValue: s.label, result: 'success' });
    res.json({ ok: true, series: s });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/trend/series/:id', requireAuth, requireRole(['ADMIN']), (req, res) => {
  trendLog.removeSeries(Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/trend/logging', requireAuth, requireRole(['ADMIN']), (req, res) => {
  trendLog.setLogging(req.body?.enabled !== false);
  res.json({ logging: trendLog.isLogging() });
});

app.get('/api/trend/samples', requireAuth, (req, res) => {
  const windowSec = Math.min(72 * 3600, Math.max(10, Number(req.query.window) || 300));
  const maxPoints = Math.min(2000, Math.max(100, Number(req.query.max) || 600));
  const toMs = Number(req.query.to) || 0;
  res.json(trendLog.samples({ windowSec, maxPoints, toMs }));
});

app.get('/api/trend/export.csv', requireAuth, (req, res) => {
  const to = Number(req.query.to) || Date.now();
  const from = Number(req.query.from) || to - trendLog.RETENTION_MS;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="trend_${stamp}.csv"`);
  for (const chunk of trendLog.exportCsvRows({ from, to })) res.write(chunk);
  res.end();
});

app.post('/api/trend/import', requireAuth, requireRole(['ADMIN']),
  express.text({ type: ['text/csv', 'text/plain', 'application/octet-stream'], limit: '80mb' }),
  (req, res) => {
    try {
      const r = trendLog.importCsv(String(req.body || ''));
      auditLog.record({ userId: req.user.userId, actionType: 'command_request', target: 'trend.import', afterValue: `${r.importedSamples} samples`, result: 'success' });
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

app.post('/api/tags/:id/whitelist', requireAuth, requireRole(['ADMIN']), (req, res) => {
  addWhitelistStmt.run(req.params.id);
  res.json({ ok: true });
});
app.delete('/api/tags/:id/whitelist', requireAuth, requireRole(['ADMIN']), (req, res) => {
  removeWhitelistStmt.run(req.params.id);
  res.json({ ok: true });
});

// ---- Command (Design Ref: design.md §4, 2단계 확인 흐름) ----
app.post('/api/command', requireAuth, (req, res) => {
  const { tagId, value } = req.body || {};
  const tag = getTagStmt.get(tagId);
  if (!tag) return res.status(404).json({ error: '태그를 찾을 수 없습니다.' });
  const result = commandGuard.requestCommand({ tag, user: req.user, value });
  res.status(result.status).json(result.body);
});

app.post('/api/command/:id/confirm', requireAuth, async (req, res) => {
  const { confirmToken } = req.body || {};
  const result = await commandGuard.confirmCommand({
    commandId: req.params.id,
    confirmToken,
    user: req.user,
    plcClient,
  });
  res.status(result.status).json(result.body);
});

// ---- AuditLog 조회 (ADMIN 전용, Plan F6) ----
app.get('/api/auditlog', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 100);
  const offset = Number(req.query.offset) || 0;
  res.json({ entries: auditLog.list({ limit, offset }) });
});

// ---- Device 상태 ----
app.get('/api/device/status', requireAuth, (req, res) => {
  const c = config.get();
  res.json({ host: c.plcHost, port: c.plcPort, connected: plcClient.connected, enabled: plcEnabled });
});

// PLC 연결 사용/해제 (ADMIN). 해제하면 감시 루프가 재접속하지 않는다.
// PLC에 값을 쓰는 조작이 아니라 '브릿지 서버의 관측 연결'만 끊는 것이므로 사유/비밀번호까지는 요구하지 않음.
app.post('/api/device/link', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const enabled = req.body?.enabled !== false;
  plcEnabled = enabled;
  if (enabled) {
    reconnectSeq++;
    connectPlc();
  } else {
    reconnectSeq++;
    try { plcClient.disconnect(); } catch {}
  }
  auditLog.record({
    userId: req.user.userId,
    actionType: 'command_request',
    target: 'device.link',
    afterValue: enabled ? 'connect' : 'disconnect',
    result: 'success',
  });
  res.json({ enabled: plcEnabled, connected: plcClient.connected });
});

// ---- CPU · 펌웨어 · 운전상태 · 시계 (기존 PC GMS의 'CPU 정보' 화면 대응) ----
// 05 01(모델/버전)은 실기 검증됨(QA_LOG Q-017). 06 01(운전상태)/07 01(시계)은 원본 코드 주석상
// 실기 미검증 — 실패해도 화면이 뜨도록 각각 독립적으로 best-effort 조회한다. 쓰기(운전모드 변경/
// 시계 설정)는 라이브 안전 PLC라 이 앱에서 제공하지 않는다.
app.get('/api/device/info', requireAuth, async (req, res) => {
  const c = config.get();
  const out = { host: c.plcHost, port: c.plcPort, connected: plcClient.connected, transport: 'TCP' };

  if (!plcClient.connected) return res.json({ ...out, error: 'PLC에 연결되어 있지 않습니다.' });

  try {
    out.controller = await finsCommands.readControllerFull(plcClient); // { model, version, memory }
  } catch (e) {
    out.controllerError = e.message;
  }
  try {
    out.status = await finsCommands.readCpuStatus(plcClient); // 실기 미검증
  } catch (e) {
    out.statusError = e.message;
  }
  try {
    out.clock = await finsCommands.readClock(plcClient); // 실기 미검증
  } catch (e) {
    out.clockError = e.message;
  }
  res.json(out);
});

// ---- 런타임 설정 (PLC 주소 / 포트 / 폴링 주기) ----
app.get('/api/config', requireAuth, (req, res) => {
  res.json(config.get());
});

app.patch('/api/config', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  const before = config.get();
  let next;
  try {
    next = config.set(req.body || {});
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const targetChanged = next.plcHost !== before.plcHost || next.plcPort !== before.plcPort;
  auditLog.record({
    userId: req.user.userId,
    actionType: 'command_request',
    target: 'config',
    beforeValue: `${before.plcHost}:${before.plcPort} / ${before.pollIntervalMs}ms`,
    afterValue: `${next.plcHost}:${next.plcPort} / ${next.pollIntervalMs}ms`,
    result: 'success',
  });
  if (targetChanged) reconnectPlc();
  res.json({ ...next, reconnecting: targetChanged });
});

// ---- 위험 장비 조작 (운전 모드 변경 / 시계 설정) ----
// 기존 PC GMS 화면의 기능을 모바일에 옮기되, 라이브 안전 PLC(SK Hynix M16 GC)임을 감안해
// ADMIN + 2단계 확인창 + 사유 필수 + 비밀번호 재입력을 모두 통과해야 실행된다. 모든 시도는 감사 로그.
// setCpuMode(04 01/04 02) / writeClock(07 02)는 원본 코드 주석상 실기 미검증 FINS 명령.
const getUserHashStmt = db.prepare('SELECT password_hash FROM users WHERE user_id = ?');

async function verifyDangerRequest(req) {
  const { reason, password } = req.body || {};
  if (!reason || String(reason).trim().length < 5) {
    return { ok: false, status: 400, error: '사유를 5자 이상 입력하세요.' };
  }
  if (!password) return { ok: false, status: 400, error: '비밀번호를 입력하세요.' };
  const row = getUserHashStmt.get(req.user.userId);
  const match = row ? await bcrypt.compare(String(password), row.password_hash) : false;
  if (!match) {
    auditLog.record({
      userId: req.user.userId, actionType: 'permission_denied',
      target: req.path, afterValue: { reason: String(reason).slice(0, 200) }, result: 'rejected',
    });
    return { ok: false, status: 401, error: '비밀번호가 일치하지 않습니다.' };
  }
  return { ok: true, reason: String(reason).trim() };
}

app.post('/api/device/mode', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  const mode = String(req.body?.mode || '').toUpperCase();
  if (!['RUN', 'MONITOR', 'PROGRAM'].includes(mode)) {
    return res.status(400).json({ error: 'mode는 RUN|MONITOR|PROGRAM 이어야 합니다.' });
  }
  const chk = await verifyDangerRequest(req);
  if (!chk.ok) return res.status(chk.status).json({ error: chk.error });

  try {
    await finsCommands.setCpuMode(plcClient, mode);
    auditLog.record({
      userId: req.user.userId, actionType: 'command_confirm', target: 'device.mode',
      afterValue: { mode, reason: chk.reason }, result: 'success',
    });
    res.json({ ok: true, mode });
  } catch (err) {
    auditLog.record({
      userId: req.user.userId, actionType: 'command_confirm', target: 'device.mode',
      afterValue: { mode, reason: chk.reason }, result: 'failed',
    });
    res.status(502).json({ error: 'PLC 운전 모드 변경 실패: ' + err.message });
  }
});

app.post('/api/device/clock', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  const chk = await verifyDangerRequest(req);
  if (!chk.ok) return res.status(chk.status).json({ error: chk.error });

  const now = new Date();
  const dt = req.body?.dt || {
    year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
    hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds(),
  };
  try {
    await finsCommands.writeClock(plcClient, dt);
    auditLog.record({
      userId: req.user.userId, actionType: 'command_confirm', target: 'device.clock',
      afterValue: { dt, reason: chk.reason }, result: 'success',
    });
    res.json({ ok: true, dt });
  } catch (err) {
    auditLog.record({
      userId: req.user.userId, actionType: 'command_confirm', target: 'device.clock',
      afterValue: { dt, reason: chk.reason }, result: 'failed',
    });
    res.status(502).json({ error: 'PLC 시계 설정 실패: ' + err.message });
  }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- PLC 연결 (Design Ref: design.md §1 — FINS/TCP, QA_LOG Q-017 실기 검증 완료) ----
const plcClient = new TcpFinsClient((dir, msg) => {
  if (dir === 'ERROR' || dir === 'WARN') console.warn(`[PLC ${dir}] ${msg}`);
});

let reconnectSeq = 0;
let plcConnecting = false;
let plcEnabled = true; // ADMIN이 /api/device/link 로 해제하면 false — 감시 루프가 재접속 안 함

async function connectPlc() {
  if (!plcEnabled || plcConnecting || plcClient.connected) return;
  plcConnecting = true;
  const mySeq = reconnectSeq;
  const { plcHost, plcPort } = config.get();
  try {
    await plcClient.connect({ host: plcHost, port: plcPort });
    console.log(`PLC 연결됨: ${plcHost}:${plcPort}`);
  } catch (err) {
    if (mySeq === reconnectSeq) console.error('PLC 연결 실패:', err.message, '- 감시 루프가 재시도');
  } finally {
    plcConnecting = false;
  }
}

// PLC 연결이 끊기면(ECONNRESET, 소켓 close 등) 자동 재접속.
// 원본 connectPlc는 '최초 연결 실패'만 재시도했고, 연결 후 끊김은 복구하지 못했음.
setInterval(() => {
  if (plcEnabled && !plcClient.connected && !plcConnecting) connectPlc();
}, 5000);

// ADMIN이 PLC 주소/포트를 바꾸면 기존 연결을 끊고 새 대상으로 재연결
async function reconnectPlc() {
  reconnectSeq++;
  const { plcHost, plcPort } = config.get();
  console.log(`PLC 재연결 시도: ${plcHost}:${plcPort}`);
  try {
    plcClient.disconnect();
  } catch {
    /* 이미 끊겨 있으면 무시 */
  }
  setTimeout(connectPlc, 300);
}

connectPlc();

// ---- 트렌드 로깅 루프 (design.md §9): 1초마다 시리즈 값 적재, 10분마다 72h 초과분 정리 ----
let trendTicking = false;
setInterval(async () => {
  if (trendTicking) return;
  trendTicking = true;
  try { await trendLog.tick(plcClient); } catch (e) { console.warn('[trend] tick 실패:', e.message); }
  finally { trendTicking = false; }
}, trendLog.SAMPLE_INTERVAL_MS);
setInterval(() => { try { trendLog.prune(); } catch {} }, 10 * 60 * 1000);

// 종료 시 PLC 소켓을 깨끗이 닫는다 — 강제 종료를 반복하면 PLC의 FINS/TCP 연결 테이블에
// 좀비 연결이 쌓여(CJ2H는 동시 연결 수 제한) 이후 접속이 거부/리셋될 수 있다.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try { plcClient.disconnect(); } catch {}
    setTimeout(() => process.exit(0), 200);
  });
}

// ---- HTTP(S) 서버 생성 ----
// PWA 서비스워커/홈화면추가 설치는 HTTPS(또는 localhost)에서만 동작하므로 mkcert 인증서를 사용
// (certs/ 폴더가 없으면 평범한 HTTP로 자동 대체 — 로컬 API 테스트 등에는 지장 없음)
// hasCerts는 파일 상단에서 이미 계산됨(세션 쿠키 secure 플래그와 동일 기준 사용)
const server = hasCerts
  ? https.createServer({ cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) }, app)
  : http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  sessionParser(req, {}, () => {
    if (!req.session.user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
});

wss.on('connection', (ws, req) => {
  const user = req.session.user;
  ws.send(JSON.stringify({ type: 'connected', user: { name: user.name, role: user.role } }));
  // TODO(Do 단계 후속): 태그 실시간 값 브로드캐스트는 심볼→주소 매핑표 도착 후 배치 폴링 구현
  // (design.md §7 리스크 — 2,000개는 한 번에 못 읽으므로 배치 폴링 필요)
});

server.listen(PORT, () => {
  const scheme = hasCerts ? 'https' : 'http';
  console.log(`서버 시작: ${scheme}://localhost:${PORT} (인증서: ${hasCerts ? '사용' : '없음, 평문 HTTP'})`);
});
