'use strict';

/**
 * 그리드 변수의 데이터 타입별로 필요한 워드 개수와, 읽어온 워드 배열을
 * 실제 표시값으로 디코딩하는 유틸리티.
 *
 * 워드 순서 규약(Omron 관례): 여러 워드로 구성된 값은 주소가 낮은 워드가
 * 하위(LOW) 워드, 주소가 높은 워드가 상위(HIGH) 워드다.
 * 즉 32비트 값 = word[0] | (word[1] << 16), 64비트 값도 같은 방식으로 확장.
 */

const TYPE_WORD_COUNT = {
  BOOL: 1,
  INT: 1,
  UINT: 1,
  WORD: 1,
  UBCD: 1,
  DINT: 2,
  UDINT: 2,
  DWORD: 2,
  UDBCD: 2,
  REAL: 2,
  LINT: 4,
  ULINT: 4,
  LWORD: 4,
  ULBCD: 4,
  LREAL: 4,
  // STRING은 사용자가 지정한 길이(length, 워드 수)를 그대로 사용
};

/** 데이터 타입 + STRING 길이에 따라 필요한 워드 개수 반환 */
function wordCountFor(dataType, length) {
  if (dataType === 'STRING') {
    return Math.max(1, Number(length) || 1);
  }
  return TYPE_WORD_COUNT[dataType] || 1;
}

function bcdNibblesToInt(word) {
  const d0 = (word >> 12) & 0xf;
  const d1 = (word >> 8) & 0xf;
  const d2 = (word >> 4) & 0xf;
  const d3 = word & 0xf;
  return d0 * 1000 + d1 * 100 + d2 * 10 + d3;
}

function bcdWordToDigits(word) {
  const d0 = (word >> 12) & 0xf;
  const d1 = (word >> 8) & 0xf;
  const d2 = (word >> 4) & 0xf;
  const d3 = word & 0xf;
  return `${d0}${d1}${d2}${d3}`;
}

function toInt16(word) {
  return word > 0x7fff ? word - 0x10000 : word;
}

function toInt32(low, high) {
  const v = (high << 16) | low;
  return v | 0; // 32비트 부호있는 정수로 강제
}

function toBigIntUnsigned(words) {
  // words: [w0(최하위) ... wN(최상위)], 각 16비트
  let result = 0n;
  for (let i = words.length - 1; i >= 0; i--) {
    result = (result << 16n) | BigInt(words[i] & 0xffff);
  }
  return result;
}

function toBigIntSigned64(words) {
  let v = toBigIntUnsigned(words);
  const SIGN_BIT = 1n << 63n;
  if (v & SIGN_BIT) {
    v -= 1n << 64n;
  }
  return v;
}

/**
 * items: readItems()로 읽어온 [{area, addr, value}] 중 이 변수에 해당하는
 *        연속된 워드들의 value만 순서대로 뽑은 배열 (word[0]이 최하위 워드)
 * bit: BOOL일 때 사용할 비트 위치(0~15)
 */
function decodeValue(dataType, words, bit) {
  if (!words || words.length === 0 || words.some((w) => w === null || w === undefined)) {
    return null;
  }

  switch (dataType) {
    case 'BOOL':
      // 비트 전용 영역 코드(워드코드-0x80)로 읽으면 응답값 자체가 이미
      // 해당 비트의 상태(0 또는 1)이므로, 워드에서 비트를 추출할 필요가 없다.
      return (words[0] & 1) === 1 ? 1 : 0;

    case 'INT':
      return toInt16(words[0]);
    case 'UINT':
      return words[0] & 0xffff;
    case 'WORD':
      return `0x${(words[0] & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
    case 'UBCD':
      return bcdNibblesToInt(words[0]);

    case 'DINT':
      return toInt32(words[0], words[1]);
    case 'UDINT':
      return ((words[1] << 16) | words[0]) >>> 0;
    case 'DWORD':
      return `0x${(((words[1] << 16) | words[0]) >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
    case 'UDBCD':
      return Number(bcdWordToDigits(words[1]) + bcdWordToDigits(words[0]));
    case 'REAL': {
      const buf = Buffer.alloc(4);
      buf.writeUInt16BE(words[1] & 0xffff, 0);
      buf.writeUInt16BE(words[0] & 0xffff, 2);
      return buf.readFloatBE(0);
    }

    case 'LINT':
      return toBigIntSigned64(words).toString();
    case 'ULINT':
      return toBigIntUnsigned(words).toString();
    case 'LWORD':
      return `0x${toBigIntUnsigned(words).toString(16).toUpperCase().padStart(16, '0')}`;
    case 'ULBCD':
      // 4워드 = 16자리 BCD. Number 안전정수 범위를 넘을 수 있어 문자열로 반환.
      return words
        .slice()
        .reverse()
        .map(bcdWordToDigits)
        .join('')
        .replace(/^0+(?=\d)/, '');
    case 'LREAL': {
      const buf = Buffer.alloc(8);
      buf.writeUInt16BE(words[3] & 0xffff, 0);
      buf.writeUInt16BE(words[2] & 0xffff, 2);
      buf.writeUInt16BE(words[1] & 0xffff, 4);
      buf.writeUInt16BE(words[0] & 0xffff, 6);
      return buf.readDoubleBE(0);
    }

    case 'STRING': {
      const bytes = [];
      for (const w of words) {
        bytes.push((w >> 8) & 0xff, w & 0xff); // 상위 바이트가 먼저 오는 문자 순서(Omron 관례)
      }
      return Buffer.from(bytes)
        .toString('ascii')
        .replace(/\0.*$/, '') // 첫 널문자 이후 잘라냄
        .trim();
    }

    default:
      return words[0];
  }
}

/** "100" 또는 "100.5"(워드.비트) 형식의 주소 문자열을 { address, bit }로 변환 */
function parseAddress(raw) {
  const s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (s.includes('.')) {
    const [a, b] = s.split('.');
    return { address: Number(a) || 0, bit: Number(b) || 0 };
  }
  return { address: Number(s) || 0, bit: 0 };
}

/** { address, bit }를 화면에 표시할 주소 문자열로 변환 (BOOL이거나 bit!=0이면 "주소.비트") */
function formatAddress(address, bit, dataType) {
  if (dataType === 'BOOL' || bit) {
    return `${address}.${bit || 0}`;
  }
  return String(address);
}

/**
 * 사용자가 입력한 값(rawValue)을 해당 dataType의 워드 배열로 변환한다 (쓰기용).
 * BOOL은 워드 전체가 아니라 비트 하나만 바꿔야 하므로 이 함수로 인코딩하지 않고
 * gridManager.js에서 read-modify-write로 별도 처리한다.
 */
function encodeValue(dataType, rawValue, wordCount) {
  switch (dataType) {
    case 'INT':
    case 'UINT':
      return [Number(rawValue) & 0xffff];
    case 'WORD': {
      const n = typeof rawValue === 'string' && rawValue.startsWith('0x') ? parseInt(rawValue, 16) : Number(rawValue);
      return [n & 0xffff];
    }
    case 'UBCD': {
      const n = Math.max(0, Math.min(9999, Math.trunc(Number(rawValue) || 0)));
      const s = String(n).padStart(4, '0');
      return [parseInt(s, 16)]; // 각 자리 숫자를 그대로 니블에 배치 = BCD
    }
    case 'DINT':
    case 'UDINT': {
      const n = Number(rawValue) >>> 0;
      return [n & 0xffff, (n >>> 16) & 0xffff];
    }
    case 'DWORD': {
      const s = String(rawValue).trim();
      const n = (s.startsWith('0x') ? parseInt(s, 16) : Number(s)) >>> 0;
      return [n & 0xffff, (n >>> 16) & 0xffff];
    }
    case 'UDBCD': {
      const n = Math.max(0, Math.min(99999999, Math.trunc(Number(rawValue) || 0)));
      const s = String(n).padStart(8, '0');
      return [parseInt(s.slice(4, 8), 16), parseInt(s.slice(0, 4), 16)];
    }
    case 'REAL': {
      const buf = Buffer.alloc(4);
      buf.writeFloatBE(Number(rawValue), 0);
      const high = buf.readUInt16BE(0);
      const low = buf.readUInt16BE(2);
      return [low, high];
    }
    case 'LINT':
    case 'ULINT': {
      // Number를 거치면 2^53을 넘는 정수가 반올림되므로(예: 9007199254740993 → ...992),
      // 문자열 그대로 BigInt로 변환한다. 정수 형식이 아닐 때만 Number로 절사 후 변환.
      let v;
      try {
        v = BigInt(String(rawValue).trim());
      } catch (e) {
        v = BigInt(Math.trunc(Number(rawValue) || 0));
      }
      if (v < 0n) v += 1n << 64n;
      const words = [];
      for (let i = 0; i < 4; i++) {
        words.push(Number(v & 0xffffn));
        v >>= 16n;
      }
      return words;
    }
    case 'LWORD': {
      const s = String(rawValue).trim();
      let v = BigInt(s.startsWith('0x') ? s : `0x${s}`);
      const words = [];
      for (let i = 0; i < 4; i++) {
        words.push(Number(v & 0xffffn));
        v >>= 16n;
      }
      return words;
    }
    case 'ULBCD': {
      const s = String(rawValue).trim().padStart(16, '0').slice(-16);
      const words = [];
      for (let i = 0; i < 4; i++) {
        const chunk = s.slice(i * 4, i * 4 + 4); // i=0이 최상위 4자리
        words.unshift(parseInt(chunk, 16)); // 최상위 자릿수가 뒤(높은 주소 워드)로 가도록 앞에 삽입
      }
      return words; // words[0]=최하위 워드 (decodeValue의 ULBCD와 동일한 순서)
    }
    case 'LREAL': {
      const buf = Buffer.alloc(8);
      buf.writeDoubleBE(Number(rawValue), 0);
      return [buf.readUInt16BE(6), buf.readUInt16BE(4), buf.readUInt16BE(2), buf.readUInt16BE(0)];
    }
    case 'STRING': {
      const str = String(rawValue === undefined || rawValue === null ? '' : rawValue);
      const words = [];
      for (let i = 0; i < wordCount; i++) {
        const c1 = str.charCodeAt(i * 2) || 0;
        const c2 = str.charCodeAt(i * 2 + 1) || 0;
        words.push(((c1 & 0xff) << 8) | (c2 & 0xff));
      }
      return words;
    }
    default:
      return [Number(rawValue) & 0xffff];
  }
}

module.exports = {
  TYPE_WORD_COUNT,
  wordCountFor,
  decodeValue,
  encodeValue,
  parseAddress,
  formatAddress,
};
