'use strict';
// 단일 태그 실시간 값 읽기 (Plan B — 매핑표 도착 전, 주소를 직접 배정한 소수 태그로 검증)
// Design Ref: design.md §6 — PLC 실시간 값은 캐시 금지, 요청 시마다 PLC에서 조회
//
// 데이터 타입은 Omron CX-Programmer 목록에 맞춘다. 다중 워드(DINT/REAL 등)는 하위 워드가
// 낮은 주소에 오는 Omron 관례(LSW-first)로 조합한다. 실수/BCD/64비트/STRING 디코딩은
// 실기 미검증 — 실제 매핑표(주소+타입) 도착 시 값 대조 필요.
// 대량(약 2,000개) 배치 폴링은 매핑표 도착 후 별도 구현(design.md §7).

const { AREA_CODES, emAreaCode } = require('./plcClient/finsShared');

/** area_type 문자열("D","W","CIO","H","E0","E1"...) → FINS 워드 영역 코드 */
function wordAreaCode(areaType) {
  if (AREA_CODES[areaType] != null) return AREA_CODES[areaType];
  const m = /^E(\d{1,2})$/.exec(areaType || '');
  if (m) return emAreaCode(Number(m[1]));
  throw new Error(`알 수 없는 메모리 영역: ${areaType}`);
}

// 타입별 읽을 워드 수. 구버전 별칭(UINT16/INT16)도 매핑.
const TYPE_WORDS = {
  BOOL: 1,
  INT: 1, UINT: 1, WORD: 1, CHANNEL: 1, '16BIT': 1, ASCII: 1,
  UINT_BCD: 1, TIMER: 1, COUNTER: 1,
  DINT: 2, UDINT: 2, DWORD: 2, REAL: 2, UDINT_BCD: 2,
  LINT: 4, ULINT: 4, LWORD: 4, LREAL: 4, ULINT_BCD: 4,
  STRING: 16,
};
const TYPE_ALIAS = { UINT16: 'UINT', INT16: 'INT', HEX: 'WORD', BObit: 'BOOL' };

function normType(dt) {
  const t = String(dt || 'UINT').toUpperCase();
  return TYPE_ALIAS[t] || t;
}

const u16 = (w) => w & 0xffff;
const u32 = (w) => (w[1] * 65536 + w[0]) >>> 0; // LSW first
const s16 = (x) => (x >= 0x8000 ? x - 0x10000 : x);
const s32 = (w) => {
  const v = u32(w);
  return v >= 0x80000000 ? v - 0x100000000 : v;
};
const u64 = (w) =>
  (BigInt(w[3]) << 48n) | (BigInt(w[2]) << 32n) | (BigInt(w[1]) << 16n) | BigInt(w[0]);
const s64 = (w) => {
  const v = u64(w);
  return v >= 1n << 63n ? v - (1n << 64n) : v;
};
function hexStr(w) {
  let s = '0x';
  for (let i = w.length - 1; i >= 0; i--) s += w[i].toString(16).toUpperCase().padStart(4, '0');
  return s;
}
function bcdOfWord(x) {
  let s = '';
  for (let sh = 12; sh >= 0; sh -= 4) {
    const d = (x >> sh) & 0xf;
    if (d > 9) return null;
    s += d;
  }
  return s;
}
function bcd(w) {
  let s = '';
  for (let i = w.length - 1; i >= 0; i--) {
    const p = bcdOfWord(w[i]);
    if (p === null) return '(BCD 아님)';
    s += p;
  }
  return Number(s) || 0;
}
function realVal(w) {
  const b = Buffer.alloc(4);
  b.writeUInt16LE(w[0], 0);
  b.writeUInt16LE(w[1], 2);
  return Math.round(b.readFloatLE(0) * 1e6) / 1e6;
}
function lrealVal(w) {
  const b = Buffer.alloc(8);
  for (let i = 0; i < 4; i++) b.writeUInt16LE(w[i], i * 2);
  return b.readDoubleLE(0);
}
const printable = (c) => (c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : '·');
function asciiVal(w) {
  return printable((w[0] >> 8) & 0xff) + printable(w[0] & 0xff);
}
function stringVal(w) {
  let s = '';
  for (const x of w) {
    const hi = (x >> 8) & 0xff;
    const lo = x & 0xff;
    if (hi === 0) return s;
    s += String.fromCharCode(hi);
    if (lo === 0) return s;
    s += String.fromCharCode(lo);
  }
  return s;
}

/** words: 주소 오름차순 배열(LSW first). type: normType() 결과 */
function decode(type, words) {
  switch (type) {
    case 'BOOL':
      return words[0] !== 0 ? 1 : 0;
    case 'INT':
      return s16(words[0]);
    case 'UINT':
    case 'CHANNEL_DEC':
      return words[0];
    case 'DINT':
      return s32(words);
    case 'UDINT':
      return u32(words);
    case 'LINT':
      return s64(words).toString();
    case 'ULINT':
      return u64(words).toString();
    case 'UINT_BCD':
    case 'UDINT_BCD':
    case 'ULINT_BCD':
    case 'TIMER':
    case 'COUNTER':
      return bcd(words);
    case 'REAL':
      return realVal(words);
    case 'LREAL':
      return lrealVal(words);
    case 'WORD':
    case 'DWORD':
    case 'LWORD':
    case 'CHANNEL':
      return hexStr(words);
    case '16BIT':
      return words[0].toString(2).padStart(16, '0');
    case 'ASCII':
      return asciiVal(words);
    case 'STRING':
      return stringVal(words);
    default:
      return words[0];
  }
}

/**
 * @param {object} tag  tags 행 (address, area_type, data_type, bit_index)
 * @param {object} plcClient  TcpFinsClient
 * @returns {Promise<{value:(number|string), words:number[], bit:(number|null), type:string, ts:number}>}
 */
async function readTagValue(tag, plcClient) {
  if (!tag.address || !tag.area_type) {
    const err = new Error(`태그 "${tag.symbol}"에 PLC 주소가 배정되지 않았습니다.`);
    err.code = 'NO_ADDRESS';
    throw err;
  }
  if (!plcClient.connected) {
    const err = new Error('PLC에 연결되어 있지 않습니다.');
    err.code = 'PLC_OFFLINE';
    throw err;
  }

  const addr = Number(tag.address);
  if (!Number.isInteger(addr) || addr < 0) throw new Error(`잘못된 주소: ${tag.address}`);
  const area = wordAreaCode(tag.area_type);

  // 비트가 지정되면 워드 1개를 읽어 해당 비트만 추출(검증된 워드 읽기 경로)
  if (tag.bit_index != null) {
    const [r] = await plcClient.readItems([{ area, addr, bit: 0 }]);
    const word = u16(r.value);
    return { value: (word >> tag.bit_index) & 1, words: [word], bit: tag.bit_index, type: 'BOOL', ts: Date.now() };
  }

  const type = normType(tag.data_type);
  const n = TYPE_WORDS[type] || 1;
  const items = Array.from({ length: n }, (_, i) => ({ area, addr: addr + i, bit: 0 }));
  const results = await plcClient.readItems(items);
  const words = results.map((r) => u16(r.value));

  return { value: decode(type, words), words, bit: null, type, ts: Date.now() };
}

module.exports = { readTagValue, wordAreaCode, TYPE_WORDS, normType };
