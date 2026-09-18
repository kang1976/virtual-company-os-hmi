'use strict';

/**
 * CJ 시리즈(FINS) 공통 명령 - CPU 상세 정보 팝업에서 쓰는 읽기/쓰기 명령들.
 * usb/udp/tcp 세 클라이언트가 각자 구현한 `_command(cmdBuf, dataBuf)`를 통해 프레임을 주고받으며,
 * `_command`는 { endCode, payload } 를 돌려준다(payload = FINS 종료코드 다음 바이트들).
 *
 * ⚠️ 이 파일의 명령(06 01 상태, 07 01/07 02 시계, 04 01/04 02 운전모드, 05 01 상세)은
 *    기존에 실기 검증된 명령(01 04 읽기 / 01 02 쓰기 / 05 01 모델·버전 / 21 02 에러로그) 밖의
 *    명령들로, 실제 하드웨어로 아직 검증되지 않았습니다. 특히 쓰기(07 02 시계, 04 01/04 02 모드)는
 *    살아있는 PLC 상태를 바꾸므로 UI에서 확인창을 거쳐 실행합니다.
 */

const { decodeErrorCode } = require('./usbFinsClient');
const { AREA_WORD_COUNTS, EM_BANK_WORD_COUNT, emBankCountFor, programCapacityStepsFor } = require('./memoryAreas');

function toBcd(n) {
  n = Math.max(0, Math.floor(n));
  return (((Math.floor(n / 10) % 10) << 4) | (n % 10)) & 0xff;
}
function fromBcd(b) {
  return ((b >> 4) & 0x0f) * 10 + (b & 0x0f);
}

function endCodeHex(endCode) {
  return '0x' + endCode.toString(16).padStart(4, '0');
}

const MODE_TEXT = { 0x00: 'PROGRAM', 0x02: 'MONITOR', 0x04: 'RUN' };
const DOW_TEXT = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * FINS 06 01 (CPU UNIT STATUS READ) - 운전 상태/모드/에러 상태.
 * payload: status(1) mode(1) fatal(2) nonFatal(2) message(2) FAL/FALS(2) errorMessage(16)
 */
async function readCpuStatus(client) {
  const { endCode, payload } = await client._command(Buffer.from([0x06, 0x01]));
  if (endCode !== 0) throw new Error(`PLC 응답 에러 코드: ${endCodeHex(endCode)}`);
  if (payload.length < 10) throw new Error('CPU 상태 응답이 너무 짧습니다: ' + payload.toString('hex'));

  const status = payload[0];
  const mode = payload[1];
  const fatal = payload.readUInt16BE(2);
  const nonFatal = payload.readUInt16BE(4);
  const message = payload.readUInt16BE(6);
  const falCode = payload.readUInt16BE(8);
  const errorMessage = payload.length >= 26
    ? payload.slice(10, 26).toString('ascii').replace(/[^\x20-\x7e]/g, '').trim()
    : '';

  const runText = status === 0x00 ? '정지(Stop)' : status === 0x01 ? '실행 중(Run)' : status === 0x80 ? '대기(Standby)' : `0x${status.toString(16).padStart(2, '0')}`;
  const modeText = MODE_TEXT[mode] || `알 수 없음(0x${mode.toString(16).padStart(2, '0')})`;

  return {
    status, runText,
    mode, modeText,
    fatal, nonFatal, message, falCode,
    fatalHex: '0x' + fatal.toString(16).padStart(4, '0'),
    nonFatalHex: '0x' + nonFatal.toString(16).padStart(4, '0'),
    hasFatal: fatal !== 0,
    hasNonFatal: nonFatal !== 0,
    falText: falCode ? decodeErrorCode(falCode) : '',
    errorMessage,
  };
}

/** FINS 07 01 (CLOCK READ) - PLC 내장 시계 읽기. payload: 년월일시분초(BCD)+요일 */
async function readClock(client) {
  const { endCode, payload } = await client._command(Buffer.from([0x07, 0x01]));
  if (endCode !== 0) throw new Error(`PLC 응답 에러 코드: ${endCodeHex(endCode)}`);
  if (payload.length < 6) throw new Error('시계 응답이 너무 짧습니다: ' + payload.toString('hex'));
  const year = 2000 + fromBcd(payload[0]);
  const month = fromBcd(payload[1]);
  const day = fromBcd(payload[2]);
  const hour = fromBcd(payload[3]);
  const minute = fromBcd(payload[4]);
  const second = fromBcd(payload[5]);
  const dow = payload.length >= 7 ? fromBcd(payload[6]) : null;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    year, month, day, hour, minute, second,
    dayOfWeek: dow,
    dayOfWeekText: dow != null && DOW_TEXT[dow] ? DOW_TEXT[dow] : '',
    text: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
  };
}

/**
 * FINS 07 02 (CLOCK WRITE) - PLC 내장 시계 설정.
 * @param {{year,month,day,hour,minute,second}} dt
 */
async function writeClock(client, dt) {
  const y = ((Number(dt.year) % 100) + 100) % 100;
  const dow = new Date(Number(dt.year), Number(dt.month) - 1, Number(dt.day)).getDay(); // 0=일 .. 6=토 (FINS와 동일)
  const data = Buffer.from([
    toBcd(y), toBcd(dt.month), toBcd(dt.day),
    toBcd(dt.hour), toBcd(dt.minute), toBcd(dt.second), toBcd(dow),
  ]);
  const { endCode } = await client._command(Buffer.from([0x07, 0x02]), data);
  if (endCode !== 0) throw new Error(`PLC 시계 쓰기 에러 코드: ${endCodeHex(endCode)}`);
  return true;
}

/**
 * 운전 모드 변경.
 *  - PROGRAM: STOP(04 02)  → PLC 프로그램 정지
 *  - MONITOR: RUN(04 01) + 모드 0x02
 *  - RUN:     RUN(04 01) + 모드 0x04
 */
async function setCpuMode(client, mode) {
  let cmd;
  let data = Buffer.alloc(0);
  if (mode === 'PROGRAM') {
    cmd = Buffer.from([0x04, 0x02]);
  } else if (mode === 'MONITOR') {
    cmd = Buffer.from([0x04, 0x01]);
    data = Buffer.from([0xff, 0xff, 0x02]); // 프로그램 번호 0xFFFF + 모드 0x02
  } else if (mode === 'RUN') {
    cmd = Buffer.from([0x04, 0x01]);
    data = Buffer.from([0xff, 0xff, 0x04]);
  } else {
    throw new Error('알 수 없는 운전 모드: ' + mode);
  }
  const { endCode } = await client._command(cmd, data);
  if (endCode !== 0) throw new Error(`PLC 운전 모드 변경 에러 코드: ${endCodeHex(endCode)}`);
  return true;
}

/**
 * FINS 05 01 (CONTROLLER DATA READ) 전체 파싱 - 모델/버전 + 메모리 영역 정보.
 * payload: 모델(20) 버전(20) 시스템용(40) 이후 "영역 데이터"(offset 80~, IOM/DM/
 * 타이머카운터/확장DM 크기 등). 실제 CJ2H-CPU65-EIP 응답(2026-07-16 캡처, logs/session_main_*.log)을
 * 바이트 단위로 분석해 offset 82(IOM)·83-84(DM)·85(타이머/카운터)·86(확장DM 뱅크 수)를 확인했다.
 * DM=32768워드·EM=4뱅크는 Omron 공식 스펙(웹 검색으로 확인, 2026-07-16)과 정확히 일치해 신뢰도가 높다.
 *
 * ⚠️ offset 80-81("프로그램 영역")만은 raw 값(CPU65에서 200)이 공식 스펙(100,000 steps)과
 *    500배라는 애매한 비율이라 이 필드의 실제 단위/의미를 신뢰할 수 없다고 판단해 UI에 노출하지
 *    않는다. 대신 모델명으로 공식 스펙표(memoryAreas.js CPU_PROGRAM_CAPACITY_STEPS, Omron 웹사이트
 *    검색으로 확인한 실제 값)를 찾아 그 값을 사용한다. 표에 없는 모델은 "확인 불가"로 표시한다.
 *
 * 그 외(CIO/W/H 워드 수)는 FINS 응답에 없는, CS/CJ 시리즈 공통 고정 규격값이라 memoryAreas.js
 * 상수를 그대로 함께 반환한다.
 * 영역 데이터는 CPU/펌웨어에 따라 없을 수 있어(응답 길이 부족) 있을 때만 채운다.
 */
async function readControllerFull(client) {
  const { endCode, payload } = await client._command(Buffer.from([0x05, 0x01]));
  if (endCode !== 0) throw new Error(`PLC 응답 에러 코드: ${endCodeHex(endCode)}`);
  if (payload.length < 40) throw new Error('컨트롤러 데이터 응답이 너무 짧습니다: ' + payload.toString('hex'));

  const model = payload.slice(0, 20).toString('ascii').replace(/\0/g, '').trim();
  const version = payload.slice(20, 40).toString('ascii').replace(/\0/g, '').trim();

  // 영역 데이터: 시스템용 40바이트 다음(offset 80)부터. 응답이 충분히 길 때만 파싱한다.
  const memory = {};
  const areaOff = 80;
  if (payload.length >= areaOff + 5) {
    const iomSizeK = payload[areaOff + 2]; // K bytes
    const dmWords = payload.readUInt16BE(areaOff + 3);
    // 값이 상식적인 범위일 때만 노출(엉뚱한 값이면 표시하지 않음)
    if (iomSizeK > 0 && iomSizeK <= 256) memory.iomSizeK = iomSizeK;
    if (dmWords > 0 && dmWords <= 0xffff) memory.dmWords = dmWords;
  }
  // 공식 스펙표 기준 프로그램 용량(steps). 모델을 모르면 null - 위 주석 참고.
  memory.programCapacitySteps = programCapacityStepsFor(model);
  if (payload.length >= areaOff + 7) {
    const timerCounterK = payload[areaOff + 5]; // K개 단위 (표준 CS/CJ: 8 → 8192개)
    const expansionDmBanks = payload[areaOff + 6]; // 확장 DM(EM) 뱅크 수
    if (timerCounterK > 0 && timerCounterK <= 64) memory.timerCounterCount = timerCounterK * 1024;
    if (expansionDmBanks > 0 && expansionDmBanks <= 25) memory.expansionDmBanks = expansionDmBanks;
  }
  // CIO/W/H는 FINS 응답에 없는 CS/CJ 시리즈 공통 고정 규격값 - memoryAreas.js 상수를 그대로 표시
  memory.cioWords = AREA_WORD_COUNTS.CIO;
  memory.workWords = AREA_WORD_COUNTS.W;
  memory.holdingWords = AREA_WORD_COUNTS.H;

  // 실측 EM 뱅크 수(응답에서 읽은 값)와 모델명 기반 하드코딩 표(memoryAreas.js)가 일치하는지 참고용으로 비교.
  // 값이 다르면 화면 브라우징(area 탭)이 실제 CPU 용량과 어긋날 수 있다는 신호이므로 함께 보여준다.
  const knownBanks = emBankCountFor(model);
  memory.emBanksFromTable = knownBanks;
  if (memory.expansionDmBanks != null) {
    memory.emBanksMismatch = memory.expansionDmBanks !== knownBanks;
  }

  // 팝업의 "용량 비교 막대그래프"용 목록. PLC가 알려주는 값은 각 영역의 "최대 용량"이지
  // 실사용량이 아니다(D/W/H/CIO/EM 등 데이터 영역은 CPU가 사용률을 추적하지 않음 - 래더 프로그램을
  // 분석해야 알 수 있는데 이 앱엔 그 기능이 없다). 그래서 여기서는 용량을 그대로 나열해 상대
  // 크기를 비교하는 용도로만 쓴다. 단위가 서로 달라(스텝/워드/바이트/개수) 막대 길이는 정확한
  // 동일 단위 비교가 아니라 참고용 상대 비교임을 UI 쪽에서 안내한다.
  const banksForChart = memory.expansionDmBanks != null ? memory.expansionDmBanks : knownBanks;
  const areas = [
    { key: 'program', label: '프로그램 영역', value: memory.programCapacitySteps, unit: 'steps', group: 'other' },
    { key: 'dm', label: 'DM', value: memory.dmWords, unit: '워드', group: 'word' },
    { key: 'iom', label: 'IOM', value: memory.iomSizeK, unit: 'K bytes', group: 'other' },
    { key: 'tc', label: '타이머/카운터', value: memory.timerCounterCount, unit: '개', group: 'other' },
    { key: 'cio', label: 'CIO', value: memory.cioWords, unit: '워드', group: 'word' },
    { key: 'w', label: 'W(Work)', value: memory.workWords, unit: '워드', group: 'word' },
    { key: 'h', label: 'H(Holding)', value: memory.holdingWords, unit: '워드', group: 'word' },
  ];
  for (let i = 0; i < banksForChart; i++) {
    areas.push({ key: `em${i}`, label: `EM${i}`, value: EM_BANK_WORD_COUNT, unit: '워드', group: 'em' });
  }
  memory.areas = areas.filter((a) => a.value != null && a.value > 0);

  return { model, version, memory };
}

module.exports = {
  readCpuStatus,
  readClock,
  writeClock,
  setCpuMode,
  readControllerFull,
};
