'use strict';
// 원본: plc-monitoring ver1.0 - google/src/usbFinsClient.js 에서 USB 하드웨어 의존성 없이
// TCP/UDP 클라이언트가 공용으로 쓰는 상수/유틸만 분리 (이 프로젝트는 USB를 쓰지 않음)

const AREA_CODES = {
  D: 0x82, // DM              - 검증됨 (Ethernet 캡처)
  CIO: 0xB0, // CIO           - 검증됨 (Ethernet 캡처)
  W: 0xB1, // Work Area       - 검증됨 (Ethernet 캡처)
  E0: 0xA0, // Extended DM Bank0 - 검증됨 (Ethernet + USB 캡처)
  H: 0xB2, // Holding Area    - 검증됨 (USB 캡처로 확인 완료)
  A: 0xB3, // Auxiliary Area (읽기 전용 시스템 영역 - 시계/스캔타임 등). Omron CS/CJ 표준 워드 read 코드
};

function emAreaCode(bank) {
  if (bank < 0 || bank > 24) {
    throw new Error(`지원하지 않는 EM 뱅크 번호: ${bank} (0~24 범위여야 함)`);
  }
  return bank <= 12 ? 0xa0 + bank : 0xe0 + (bank - 13);
}

const ERROR_CODE_DESCRIPTIONS = {
  0x00f1: '내부 플래시 메모리 에러 (Memory Error)',
  0x00f7: '배터리 전압 저하 에러 (Battery Error)',
  0x00f9: 'IO 버스 에러 (랙 장착 유닛 통신 불량 등)',
  0x00ea: '프로그램 에러 (존재하지 않는 주소 참조 등)',
  0x00e1: '사이클 타임 오버 (연산 시간이 설정치를 초과)',
};

function decodeErrorCode(code) {
  if (code >= 0x4100 && code <= 0x42ff) {
    return '인덱스 에러 (배열 인덱스 범위 초과 등)';
  }
  if (ERROR_CODE_DESCRIPTIONS[code]) {
    return ERROR_CODE_DESCRIPTIONS[code];
  }
  return `알 수 없는 에러 코드 (0x${code.toString(16).padStart(4, '0')})`;
}

function bcdByteToInt(b) {
  return ((b >> 4) & 0x0f) * 10 + (b & 0x0f);
}

function decodeBcdTimestamp(buf, offset) {
  const yy = bcdByteToInt(buf[offset]);
  const mm = bcdByteToInt(buf[offset + 1]);
  const dd = bcdByteToInt(buf[offset + 2]);
  const hh = bcdByteToInt(buf[offset + 3]);
  const mi = bcdByteToInt(buf[offset + 4]);
  const ss = bcdByteToInt(buf[offset + 5]);
  const pad = (n) => String(n).padStart(2, '0');
  return `20${pad(yy)}-${pad(mm)}-${pad(dd)} ${pad(hh)}:${pad(mi)}:${pad(ss)}`;
}

module.exports = { AREA_CODES, emAreaCode, decodeErrorCode, decodeBcdTimestamp };
