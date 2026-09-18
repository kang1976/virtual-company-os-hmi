'use strict';
// 런타임 설정(PLC 접속 대상 / 폴링 주기) — data/config.json 에 저장. 없으면 env 또는 기본값.
// 1차 범위는 PLC 1대(schema.md)라 단일 host/port. ADMIN이 앱에서 변경 가능(server.js /api/config).

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');

const defaults = {
  plcHost: process.env.PLC_HOST || '192.168.0.80',
  plcPort: Number(process.env.PLC_PORT) || 9600,
  pollIntervalMs: 3000,
};

let current = { ...defaults };
try {
  const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (saved && typeof saved === 'object') current = { ...current, ...saved };
} catch {
  /* 파일 없음 — 기본값 사용 */
}

function get() {
  return { ...current };
}

function set(patch = {}) {
  // 빈 문자열/공백은 "변경 안 함"으로 취급(빈 폼 필드가 저장값을 덮어쓰지 않게)
  const has = (v) => v != null && String(v).trim() !== '';
  if (has(patch.plcHost)) {
    const h = String(patch.plcHost).trim();
    if (!/^[0-9a-zA-Z.\-]{1,255}$/.test(h)) throw new Error('올바르지 않은 PLC 주소 형식입니다.');
    current.plcHost = h;
  }
  if (has(patch.plcPort)) {
    const p = Number(patch.plcPort);
    if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error('포트는 1~65535 사이여야 합니다.');
    current.plcPort = p;
  }
  if (has(patch.pollIntervalMs)) {
    const ms = Number(patch.pollIntervalMs);
    if (!Number.isInteger(ms) || ms < 500 || ms > 60000) throw new Error('폴링 주기는 500~60000ms 사이여야 합니다.');
    current.pollIntervalMs = ms;
  }
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(current, null, 2));
  return get();
}

module.exports = { get, set, CONFIG_PATH };
