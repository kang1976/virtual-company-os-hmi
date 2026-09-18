'use strict';

/**
 * Omron CJ2H-65EIP USB 통신 모듈
 *
 * Wireshark(USBPcap) 캡처를 통해 리버스 엔지니어링하여 확인한 프로토콜:
 *
 * [요청 프레임]
 *   AB [길이 2B,BE] [FINS헤더 10B] 01 04 07 00 01 00 [항목들...] [체크섬 2B,BE]
 *   FINS헤더 = 80 00 02 00 00 00 00 00 00 [SID]
 *   항목 1개(4B) = [영역코드][주소 상위][주소 하위][비트]
 *
 * [응답 프레임]
 *   AB [길이] [FINS헤더: C0 00 02 00 00 FB 00 00 00 [SID]] 01 04 [종료코드 2B] 07 01 [값들...] [체크섬]
 *   값 1개(3B) = [영역코드 echo][값 상위][값 하위]
 *
 * [체크섬]
 *   프레임 맨 앞(AB)부터 체크섬 직전까지 모든 바이트를 16비트로 단순 합산(오버플로우 버림), Big-Endian 2바이트.
 *
 * ⚠️ 주의: 이 프로토콜은 공식 문서가 아니라 실제 USB 트래픽을 캡처해서 역공학한 결과입니다.
 *   - D(82), CIO(B0), W(B1), E0(A0)는 Ethernet(FINS/UDP) 캡처로 직접 검증됨
 *   - H(B2)는 Omron 표준 FINS 메모리 영역 코드표 기준 추정치이며, 아직 실제 캡처로 검증되지 않음 (사용 전 확인 권장)
 */

const usb = require('usb');

const VENDOR_ID = 0x0590;  // Omron
const PRODUCT_ID = 0x005b; // OMRON SYSMAC PLC Device (USB)

const AREA_CODES = {
  D: 0x82,   // DM              - 검증됨 (Ethernet 캡처)
  CIO: 0xB0, // CIO             - 검증됨 (Ethernet 캡처)
  W: 0xB1,   // Work Area       - 검증됨 (Ethernet 캡처)
  E0: 0xA0,  // Extended DM Bank0 - 검증됨 (Ethernet + USB 캡처)
  H: 0xB2,   // Holding Area    - 검증됨 (USB 캡처로 확인 완료)
};

/**
 * EM(확장 DM) 뱅크 번호(0~24, 즉 CX-Programmer 표기 기준 0~18(hex))에 대응하는
 * FINS 메모리 영역 코드를 반환합니다.
 * Omron 공식 FINS 코드표: 뱅크 0~C(0~12)는 0xA0+n, 뱅크 D~18(13~24)는 0xE0+(n-13)
 * @param {number} bank 0~24 (뱅크 D는 13, 뱅크 18(hex)은 24)
 */
function emAreaCode(bank) {
  if (bank < 0 || bank > 24) {
    throw new Error(`지원하지 않는 EM 뱅크 번호: ${bank} (0~24 범위여야 함)`);
  }
  return bank <= 12 ? 0xA0 + bank : 0xE0 + (bank - 13);
}

/**
 * FINS 21 02 (ERROR LOG READ) 에러 코드 → 설명 매핑.
 * CPU_ERROR_CODE.txt (사용자 제공 참고자료) 기준 대표 에러코드 일부.
 * 표에 없는 코드는 알 수 없는 코드로 그대로 16진수 표기해 반환한다.
 */
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

/** BCD 1바이트(예: 0x26 → 26)를 10진수 정수로 변환 */
function bcdByteToInt(b) {
  return ((b >> 4) & 0x0f) * 10 + (b & 0x0f);
}

/** 에러 레코드의 시간 필드(6바이트 BCD: 년,월,일,시,분,초)를 'YYYY-MM-DD HH:mm:ss' 문자열로 변환 */
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

const READ_TIMEOUT_MS = 2000;

class UsbFinsClient {
  constructor(logger = () => {}) {
    this.device = null;
    this.iface = null;
    this.epOut = null;
    this.epIn = null;
    this.sid = 0;
    this.connected = false;
    this.log = logger; // (direction, message, hexOrNull) => void
    // 폴링 루프와 API(에러로그 조회/CPU정보/쓰기) 요청이 동시에 들어와도
    // SID(0~255) 재사용 충돌로 서로 다른 응답이 뒤섞이지 않도록,
    // 이 클라이언트를 통한 모든 요청은 이 체인을 통해 한 번에 하나씩만 실행한다.
    this._requestChain = Promise.resolve();
  }

  /** 이 클라이언트로 나가는 모든 요청을 순서대로 하나씩만 실행되도록 큐에 넣는다. */
  _enqueue(fn) {
    const run = () => fn();
    const result = this._requestChain.then(run, run);
    this._requestChain = result.then(
      () => {},
      () => {}
    );
    return result;
  }

  /** 사용 가능한 장치 목록에서 Omron PLC USB 장치를 찾아 연결 시도 */
  connect() {
    if (this.connected) return;

    const device = usb.findByIds(VENDOR_ID, PRODUCT_ID);
    if (!device) {
      throw new Error(
        `OMRON PLC USB 장치를 찾을 수 없습니다 (VID=0x${VENDOR_ID.toString(16)}, PID=0x${PRODUCT_ID.toString(16)}). ` +
        `USB 케이블 연결 상태와, Zadig로 WinUSB 드라이버가 설정되어 있는지 확인하세요.`
      );
    }

    device.open();

    const iface = device.interfaces[0];

    // Windows(WinUSB)는 커널 드라이버 개념 자체가 없어서 isKernelDriverActive()/
    // detachKernelDriver() 호출 자체가 LIBUSB_ERROR_NOT_SUPPORTED를 던집니다.
    // 리눅스/macOS에서만 이 체크를 수행합니다.
    if (process.platform !== 'win32') {
      try {
        if (iface.isKernelDriverActive && iface.isKernelDriverActive()) {
          iface.detachKernelDriver();
        }
      } catch (e) {
        this.log('WARN', '커널 드라이버 detach 시도 중 무시 가능한 오류: ' + e.message, null);
      }
    }

    iface.claim();

    let epOut = null;
    let epIn = null;
    const BULK = 2; // USB 표준 transferType 값 (0=CONTROL,1=ISOCHRONOUS,2=BULK,3=INTERRUPT)
    // usb 패키지 버전에 따라 usb.LIBUSB_TRANSFER_TYPE_BULK 상수가 없을 수 있어 리터럴 값으로 비교
    for (const ep of iface.endpoints) {
      if (ep.direction === 'out' && ep.transferType === BULK) epOut = ep;
      if (ep.direction === 'in' && ep.transferType === BULK) epIn = ep;
    }
    if (!epOut || !epIn) {
      throw new Error('Bulk IN/OUT 엔드포인트를 찾지 못했습니다. 장치 인터페이스 구성을 확인하세요.');
    }
    epIn.timeout = READ_TIMEOUT_MS;
    epOut.timeout = READ_TIMEOUT_MS;

    this.device = device;
    this.iface = iface;
    this.epOut = epOut;
    this.epIn = epIn;
    this.connected = true;
    this.log('SYSTEM', 'USB 장치 연결 성공', null);
  }

  disconnect() {
    if (!this.connected) return;
    try {
      this.iface.release(true, () => {
        try { this.device.close(); } catch (e) {}
      });
    } catch (e) {
      /* ignore */
    }
    this.connected = false;
    this.log('SYSTEM', 'USB 장치 연결 해제', null);
  }

  _nextSid() {
    this.sid = (this.sid + 1) & 0xff;
    return this.sid;
  }

  /**
   * 임의의 FINS 명령(cmd 2바이트 + 데이터)을 보내고 { endCode, payload }를 돌려준다.
   * payload = 종료코드 다음의 바이트들(체크섬 제외). finsCommands.js(CPU상태/시계/운전모드)에서 사용.
   */
  _command(cmdBuf, dataBuf = Buffer.alloc(0)) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('USB 장치가 연결되어 있지 않습니다.');
      const sid = this._nextSid();
      const header = Buffer.from([0x80, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, sid]);
      const body = Buffer.concat([header, cmdBuf, dataBuf]);
      const lenField = Buffer.alloc(2);
      lenField.writeUInt16BE(body.length + 2, 0);
      const prefixAndBody = Buffer.concat([Buffer.from([0xab]), lenField, body]);
      let sum = 0;
      for (const b of prefixAndBody) sum = (sum + b) & 0xffff;
      const checksum = Buffer.alloc(2);
      checksum.writeUInt16BE(sum, 0);
      const frame = Buffer.concat([prefixAndBody, checksum]);

      this.log('SEND', `명령 ${cmdBuf.toString('hex')} 요청 (SID=${sid})`, frame.toString('hex'));
      const resp = await this._transfer(frame);
      this.log('RECV', `명령 응답 수신 (SID=${sid})`, resp.toString('hex'));
      if (resp.length < 17 || resp[0] !== 0xab) {
        throw new Error('명령 응답 프레임 형식이 올바르지 않습니다: ' + resp.toString('hex'));
      }
      const endCode = resp.readUInt16BE(15);
      return { endCode, payload: resp.slice(17, Math.max(17, resp.length - 2)) };
    });
  }

  /** items: [{ area: 0x82, addr: 0, bit: 0 }, ...] */
  _buildReadFrame(items, sid) {
    const header = Buffer.from([0x80, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, sid]);
    const cmd = Buffer.from([0x01, 0x04, 0x07, 0x00, 0x01, 0x00]);
    const itemBufs = items.map((it) =>
      Buffer.from([it.area, (it.addr >> 8) & 0xff, it.addr & 0xff, it.bit || 0])
    );
    const body = Buffer.concat([header, cmd, ...itemBufs]);
    const lenField = Buffer.alloc(2);
    lenField.writeUInt16BE(body.length + 2, 0); // +2 = 체크섬 길이 포함
    const prefixAndBody = Buffer.concat([Buffer.from([0xab]), lenField, body]);

    let sum = 0;
    for (const b of prefixAndBody) sum = (sum + b) & 0xffff;
    const checksum = Buffer.alloc(2);
    checksum.writeUInt16BE(sum, 0);

    return Buffer.concat([prefixAndBody, checksum]);
  }

  /**
   * @param {Array} items 요청 시 보낸 항목 목록. 응답 항목 하나의 크기가
   *   워드 영역(3B: echo+값2B)인지 비트 영역(2B: echo+값1B)인지는 요청한 영역코드로만
   *   판단할 수 있어(응답 자체에 크기 정보가 없음), 파싱 시 반드시 필요하다.
   *   (영역코드 < 0x80 이면 비트 영역 - usbFinsClient.js 상단 주석 참고)
   */
  _parseReadResponse(buf, items) {
    if (buf.length < 19 || buf[0] !== 0xab) {
      throw new Error('응답 프레임 형식이 올바르지 않습니다: ' + buf.toString('hex'));
    }
    const sid = buf[12];
    const endCode = buf.readUInt16BE(15);
    const dataStart = 19; // FINS헤더(10)+cmd(2)+endcode(2)+상수(2)=idx3+16=19
    const dataEnd = buf.length - 2; // 체크섬 제외
    const values = [];
    let offset = dataStart;
    for (const it of items) {
      const isBit = it.area < 0x80;
      const size = isBit ? 2 : 3;
      if (offset + size > dataEnd) break;
      const area = buf[offset];
      const value = isBit ? buf[offset + 1] : buf.readUInt16BE(offset + 1);
      values.push({ area, value });
      offset += size;
    }
    return { sid, endCode, values };
  }

  _transfer(writeBuf) {
    return new Promise((resolve, reject) => {
      this.epOut.transfer(writeBuf, (errOut) => {
        if (errOut) return reject(new Error('USB 쓰기 실패: ' + errOut.message));

        const tryRead = (attemptsLeft) => {
          this.epIn.transfer(512, (errIn, data) => {
            if (errIn) return reject(new Error('USB 읽기 실패: ' + errIn.message));
            if ((!data || data.length === 0) && attemptsLeft > 0) {
              // PLC가 아직 응답을 준비 못한 경우 - 짧게 대기 후 재시도
              setTimeout(() => tryRead(attemptsLeft - 1), 20);
              return;
            }
            resolve(data);
          });
        };
        tryRead(5);
      });
    });
  }

  /** items 목록을 한번에 읽어서 [{area, addr, value}] 형태로 반환 */
  readItems(items) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('USB 장치가 연결되어 있지 않습니다.');
      const sid = this._nextSid();
      const reqFrame = this._buildReadFrame(items, sid);
      this.log('SEND', `읽기 요청 (${items.length}개 항목, SID=${sid})`, reqFrame.toString('hex'));

      const respBuf = await this._transfer(reqFrame);
      this.log('RECV', `응답 수신 (SID=${sid})`, respBuf.toString('hex'));

      const parsed = this._parseReadResponse(respBuf, items);
      if (parsed.sid !== sid) {
        this.log('WARN', `SID 불일치: 요청=${sid}, 응답=${parsed.sid}`, null);
      }
      if (parsed.endCode !== 0) {
        throw new Error(`PLC 응답 에러 코드: 0x${parsed.endCode.toString(16).padStart(4, '0')}`);
      }
      if (parsed.values.length !== items.length) {
        throw new Error(
          `응답 항목 수(${parsed.values.length})가 요청 항목 수(${items.length})와 다릅니다. ` +
            `다른 요청의 응답과 뒤섞였거나 프레임 파싱이 어긋났을 가능성이 있습니다.`
        );
      }
      return items.map((it, idx) => ({
        area: it.area,
        addr: it.addr,
        value: parsed.values[idx].value,
      }));
    });
  }
  /**
   * ⚠️ 쓰기 명령(FINS 01 02, MEMORY AREA WRITE)은 아직 실제 USB 캡처로 검증되지 않았습니다.
   * 읽기(0104)에서 확인된 "AB+길이+FINS헤더+명령+데이터+체크섬" 외곽 구조와
   * Omron 공식 FINS 규격의 0102 명령 데이터 구조([영역][주소2][비트][항목수2][데이터])를
   * 조합해 구성한 것으로, 실제 PLC로 테스트하기 전에는 100% 신뢰할 수 없습니다.
   * 처음 사용 시 영향이 없는 임시 주소(예: W 영역)로 먼저 테스트하는 것을 권장합니다.
   */
  /**
   * @param {boolean} isBit true면 비트 영역 쓰기 - FINS 규격상 항목당 데이터가 1바이트
   *   (0x00/0x01)이어야 한다. false(워드 영역)면 항목당 2바이트.
   *   이 구분 없이 항상 2바이트(word)로 보내면, 비트 쓰기 시 PLC가 실제로 읽는 첫 바이트가
   *   항상 상위바이트(0x00)라서 ON(1)을 써도 항상 OFF(0)가 전송되는 버그가 있었다.
   */
  _buildWriteFrame(area, addr, value, sid, bit = 0, isBit = false) {
    const header = Buffer.from([0x80, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, sid]);
    const cmd = Buffer.from([0x01, 0x02]);
    const addrBuf = Buffer.from([area, (addr >> 8) & 0xff, addr & 0xff, bit & 0xff]);
    const itemCount = Buffer.from([0x00, 0x01]); // 항목 1개
    const data = isBit ? Buffer.from([value ? 0x01 : 0x00]) : Buffer.alloc(2);
    if (!isBit) data.writeUInt16BE(value & 0xffff, 0);
    const body = Buffer.concat([header, cmd, addrBuf, itemCount, data]);
    const lenField = Buffer.alloc(2);
    lenField.writeUInt16BE(body.length + 2, 0);
    const prefixAndBody = Buffer.concat([Buffer.from([0xab]), lenField, body]);
    let sum = 0;
    for (const b of prefixAndBody) sum = (sum + b) & 0xffff;
    const checksum = Buffer.alloc(2);
    checksum.writeUInt16BE(sum, 0);
    return Buffer.concat([prefixAndBody, checksum]);
  }

  _parseWriteResponse(buf) {
    if (buf.length < 17 || buf[0] !== 0xab) {
      throw new Error('쓰기 응답 프레임 형식이 올바르지 않습니다: ' + buf.toString('hex'));
    }
    const sid = buf[12];
    const endCode = buf.readUInt16BE(15);
    return { sid, endCode };
  }

  /** 단일 워드 쓰기 (area: AREA_CODES.* 값, addr: 0-based 주소, value: 0~65535) */
  writeWord(area, addr, value) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('USB 장치가 연결되어 있지 않습니다.');
      const sid = this._nextSid();
      const reqFrame = this._buildWriteFrame(area, addr, value, sid, 0);
      this.log('SEND', `쓰기 요청 (영역=0x${area.toString(16)}, 주소=${addr}, 값=${value}, SID=${sid})`, reqFrame.toString('hex'));

      const respBuf = await this._transfer(reqFrame);
      this.log('RECV', `쓰기 응답 수신 (SID=${sid})`, respBuf.toString('hex'));

      const parsed = this._parseWriteResponse(respBuf);
      if (parsed.sid !== sid) {
        this.log('WARN', `SID 불일치: 요청=${sid}, 응답=${parsed.sid}`, null);
      }
      if (parsed.endCode !== 0) {
        throw new Error(`PLC 쓰기 에러 코드: 0x${parsed.endCode.toString(16).padStart(4, '0')}`);
      }
      return true;
    });
  }

  /**
   * 비트 단위 쓰기. area는 반드시 "비트 전용 영역 코드"(워드코드-0x80)를 넘겨야 한다.
   * (예: D는 0x02, CIO는 0x30, W는 0x31, H는 0x32 - gridManager.js의 areaNameToBitCode 참고)
   */
  writeBit(area, addr, bit, value) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('USB 장치가 연결되어 있지 않습니다.');
      const sid = this._nextSid();
      const reqFrame = this._buildWriteFrame(area, addr, value ? 1 : 0, sid, bit, true);
      this.log('SEND', `비트 쓰기 요청 (영역=0x${area.toString(16)}, 주소=${addr}.${bit}, 값=${value ? 1 : 0}, SID=${sid})`, reqFrame.toString('hex'));

      const respBuf = await this._transfer(reqFrame);
      this.log('RECV', `비트 쓰기 응답 수신 (SID=${sid})`, respBuf.toString('hex'));

      const parsed = this._parseWriteResponse(respBuf);
      if (parsed.sid !== sid) {
        this.log('WARN', `SID 불일치: 요청=${sid}, 응답=${parsed.sid}`, null);
      }
      if (parsed.endCode !== 0) {
        throw new Error(`PLC 쓰기 에러 코드: 0x${parsed.endCode.toString(16).padStart(4, '0')}`);
      }
      return true;
    });
  }
  /**
   * FINS 05 01 (CONTROLLER DATA READ) - CPU 모델명/버전 조회
   * 응답 데이터: 모델명(20B ASCII) + 버전(20B ASCII) + 기타(예약) 순.
   * CPU 모델(CJ2H-CPU64/65/66/67/68-EIP 등)에 따라 EM(확장 DM) 뱅크 개수가 다르므로,
   * 접속 직후 이 값을 읽어 UI에 표시하면 실제 장착된 CPU를 바로 확인할 수 있다.
   */
  async readControllerData() {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('USB 장치가 연결되어 있지 않습니다.');
      const sid = this._nextSid();
      const header = Buffer.from([0x80, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, sid]);
      const cmd = Buffer.from([0x05, 0x01]);
      const body = Buffer.concat([header, cmd]);
      const lenField = Buffer.alloc(2);
      lenField.writeUInt16BE(body.length + 2, 0);
      const prefixAndBody = Buffer.concat([Buffer.from([0xab]), lenField, body]);
      let sum = 0;
      for (const b of prefixAndBody) sum = (sum + b) & 0xffff;
      const checksum = Buffer.alloc(2);
      checksum.writeUInt16BE(sum, 0);
      const reqFrame = Buffer.concat([prefixAndBody, checksum]);

      this.log('SEND', `CPU 모델/버전 조회 (SID=${sid})`, reqFrame.toString('hex'));
      const respBuf = await this._transfer(reqFrame);
      this.log('RECV', `CPU 모델/버전 응답 수신 (SID=${sid})`, respBuf.toString('hex'));

      if (respBuf.length < 19 || respBuf[0] !== 0xab) {
        throw new Error('CPU 데이터 응답 프레임이 올바르지 않습니다: ' + respBuf.toString('hex'));
      }
      const endCode = respBuf.readUInt16BE(15);
      if (endCode !== 0) {
        throw new Error(`PLC 응답 에러 코드: 0x${endCode.toString(16).padStart(4, '0')}`);
      }
      if (respBuf.length < 57) {
        throw new Error('CPU 데이터 응답 프레임이 너무 짧습니다: ' + respBuf.toString('hex'));
      }
      const model = respBuf.slice(17, 37).toString('ascii').replace(/\0/g, '').trim();
      const version = respBuf.slice(37, 57).toString('ascii').replace(/\0/g, '').trim();
      return { model, version };
    });
  }
  /**
   * FINS 21 02 (ERROR LOG READ) - PLC CPU 에러 로그 조회.
   * @param {object} opts
   * @param {number} [opts.start=0] 시작 레코드 번호 (0=가장 최근 것부터)
   * @param {number} [opts.count=20] 읽을 레코드 개수 (최대 20)
   */
  async readErrorLog(opts = {}) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('USB 장치가 연결되어 있지 않습니다.');
      const start = Number.isFinite(opts.start) ? opts.start : 0;
      const count = Math.max(1, Math.min(20, Number.isFinite(opts.count) ? opts.count : 20));

      const sid = this._nextSid();
      const header = Buffer.from([0x80, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, sid]);
      // FINS 21 02 (ERROR LOG READ) - 09 20은 MESSAGE READ/CLEAR로 다른 명령이었음 (오적용 수정)
      const cmd = Buffer.from([
        0x21, 0x02,
        (start >> 8) & 0xff, start & 0xff,
        (count >> 8) & 0xff, count & 0xff,
      ]);
      const body = Buffer.concat([header, cmd]);
      const lenField = Buffer.alloc(2);
      lenField.writeUInt16BE(body.length + 2, 0);
      const prefixAndBody = Buffer.concat([Buffer.from([0xab]), lenField, body]);
      let sum = 0;
      for (const b of prefixAndBody) sum = (sum + b) & 0xffff;
      const checksum = Buffer.alloc(2);
      checksum.writeUInt16BE(sum, 0);
      const reqFrame = Buffer.concat([prefixAndBody, checksum]);

      this.log('SEND', `에러 로그 조회 (SID=${sid})`, reqFrame.toString('hex'));
      const respBuf = await this._transfer(reqFrame);
      this.log('RECV', `에러 로그 응답 수신 (SID=${sid})`, respBuf.toString('hex'));

      if (respBuf.length < 19 || respBuf[0] !== 0xab) {
        throw new Error('에러 로그 응답 프레임이 올바르지 않습니다: ' + respBuf.toString('hex'));
      }
      const endCode = respBuf.readUInt16BE(15);
      if (endCode !== 0) {
        throw new Error(`PLC 응답 에러 코드: 0x${endCode.toString(16).padStart(4, '0')}`);
      }
      if (respBuf.length < 23) {
        throw new Error('에러 로그 응답 프레임이 너무 짧습니다: ' + respBuf.toString('hex'));
      }
      const maxRecords = respBuf.readUInt16BE(17);
      const currentCount = respBuf.readUInt16BE(19);
      const returnedCount = respBuf.readUInt16BE(21);
      // 방어 코드: 21 02 규격상 최대 저장 개수는 항상 20(0x14) 근방이어야 한다.
      // 이보다 훨씬 큰 값이 나오면 다른 요청의 응답과 뒤섞였다는 신호이므로,
      // 잘못된 값을 그대로 보여주지 않고 명확한 에러로 알린다.
      if (maxRecords > 100 || currentCount > 100 || returnedCount > 100) {
        throw new Error(
          `에러 로그 응답 값이 비정상적입니다 (maxRecords=${maxRecords}, currentCount=${currentCount}, ` +
            `returnedCount=${returnedCount}). 다른 요청의 응답과 뒤섞였을 가능성이 있습니다. 다시 시도해 보세요.`
        );
      }
      const records = [];
      let offset = 23;
      for (let i = 0; i < returnedCount && offset + 10 <= respBuf.length - 2; i++) {
        const code = respBuf.readUInt16BE(offset);
        const detail = respBuf.readUInt16BE(offset + 2);
        const time = decodeBcdTimestamp(respBuf, offset + 4);
        records.push({ code, detail, time, description: decodeErrorCode(code) });
        offset += 10;
      }
      return { maxRecords, currentCount, returnedCount, records };
    });
  }
}

module.exports = {
  UsbFinsClient,
  AREA_CODES,
  VENDOR_ID,
  PRODUCT_ID,
  emAreaCode,
  decodeErrorCode,
  bcdByteToInt,
  decodeBcdTimestamp,
};
