'use strict';

/**
 * Omron CJ2H-CPU68EIP FINS/UDP 통신 모듈
 *
 * PROJECT_SUMMARY_AND_PROTOCOL.md 문서에 정리된 대로,
 * USB와 달리 `AB`+길이(2B)+체크섬(2B) 같은 별도 프레임 래핑이 없고
 * 순수 FINS 헤더(10B) + 명령 데이터만 UDP 페이로드로 주고받는다.
 * 명령 데이터 구조(01 04 읽기 / 01 02 쓰기, "07 00 01 00" 상수, "07 01" 응답 상수 등)는
 * usbFinsClient.js와 동일하며, 차이는 다음 두 가지뿐이다:
 *   1) AB/길이/체크섬 래핑 없음
 *   2) FINS 헤더의 DNA/DA1/DA2/SNA/SA1/SA2에 실제 네트워크·노드 번호 사용
 *      (기본값: PLC 노드 0x50(80), PC 노드 0x01(1), DNA/SNA=0)
 *
 * ⚠️ 아직 실제 PLC로 검증 전입니다. 최초 연결 시 영향 없는 주소(W 등)로 먼저 확인 권장.
 */

const dgram = require('dgram');
const { AREA_CODES, emAreaCode, decodeErrorCode, decodeBcdTimestamp } = require('./usbFinsClient');

const DEFAULT_PORT = 9600;
const DEFAULT_PLC_NODE = 0x50; // 80
const DEFAULT_PC_NODE = 0x01; // 1
const RESPONSE_TIMEOUT_MS = 2000;

class UdpFinsClient {
  constructor(logger = () => {}) {
    this.socket = null;
    this.connected = false;
    this.log = logger; // (direction, message, hexOrNull) => void
    this.sid = 0;
    this.pending = new Map(); // sid -> { resolve, reject, timer, type }
    // 폴링 루프와 API(에러로그 조회/CPU정보/쓰기) 요청이 동시에 들어와도
    // SID(0~255) 재사용 충돌로 서로 다른 응답이 뒤섞이지 않도록,
    // 이 클라이언트를 통한 모든 요청은 이 체인을 통해 한 번에 하나씩만 실행한다.
    this._requestChain = Promise.resolve();

    this.host = null;
    this.port = DEFAULT_PORT;
    this.plcNode = DEFAULT_PLC_NODE;
    this.pcNode = DEFAULT_PC_NODE;
  }

  /** 이 클라이언트로 나가는 모든 요청을 순서대로 하나씩만 실행되도록 큐에 넣는다. */
  _enqueue(fn) {
    const run = () => fn();
    const result = this._requestChain.then(run, run);
    // 체인 자체는 이전 요청의 성공/실패와 무관하게 계속 이어지되,
    // 호출자에게는 실제 결과/에러(result)를 그대로 반환한다.
    this._requestChain = result.then(
      () => {},
      () => {}
    );
    return result;
  }

  /**
   * @param {object} opts
   * @param {string} opts.host PLC IP 주소 (필수)
   * @param {number} [opts.port=9600] PLC FINS/UDP 포트
   * @param {number} [opts.plcNode=0x50] PLC측 FINS 노드 번호
   * @param {number} [opts.pcNode=0x01] PC측 FINS 노드 번호
   * @param {number} [opts.localPort] 로컬 바인드 포트 (미지정 시 OS가 임의 할당)
   */
  connect(opts = {}) {
    if (this.connected) return Promise.resolve();

    const { host, port = DEFAULT_PORT, plcNode = DEFAULT_PLC_NODE, pcNode = DEFAULT_PC_NODE, localPort } = opts;
    if (!host) {
      throw new Error('UDP 연결에는 PLC IP 주소(host)가 필요합니다.');
    }

    this.host = host;
    this.port = Number(port) || DEFAULT_PORT;
    this.plcNode = Number(plcNode) & 0xff;
    this.pcNode = Number(pcNode) & 0xff;

    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      let settled = false;

      socket.once('error', (err) => {
        this.connected = false;
        if (!settled) {
          settled = true;
          reject(new Error('UDP 소켓 오류: ' + err.message));
        } else {
          this.log('ERROR', 'UDP 소켓 오류: ' + err.message, null);
        }
      });

      socket.on('message', (msg) => this._handleMessage(msg));

      socket.bind(localPort || 0, () => {
        this.socket = socket;
        this.connected = true;
        settled = true;
        this.log(
          'SYSTEM',
          `UDP 연결 준비 완료 (${this.host}:${this.port}, PLC노드=0x${this.plcNode
            .toString(16)
            .padStart(2, '0')}, PC노드=0x${this.pcNode.toString(16).padStart(2, '0')})`,
          null
        );
        resolve();
      });
    });
  }

  disconnect() {
    if (!this.connected) return;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('연결이 해제되었습니다.'));
    }
    this.pending.clear();
    try {
      this.socket.close();
    } catch (e) {
      /* ignore */
    }
    this.connected = false;
    this.log('SYSTEM', 'UDP 연결 해제', null);
  }

  _nextSid() {
    this.sid = (this.sid + 1) & 0xff;
    return this.sid;
  }

  /** FINS 헤더 10바이트 (AB/길이 래핑 없이 이 자체가 UDP 페이로드의 시작) */
  _buildHeader(sid) {
    return Buffer.from([
      0x80, // ICF
      0x00, // RSV
      0x02, // GCT
      0x00, // DNA
      this.plcNode, // DA1
      0x00, // DA2
      0x00, // SNA
      this.pcNode, // SA1
      0x00, // SA2
      sid, // SID
    ]);
  }

  /** items: [{ area, addr, bit }, ...] */
  _buildReadFrame(items, sid) {
    const header = this._buildHeader(sid);
    const cmd = Buffer.from([0x01, 0x04, 0x07, 0x00, 0x01, 0x00]);
    const itemBufs = items.map((it) =>
      Buffer.from([it.area, (it.addr >> 8) & 0xff, it.addr & 0xff, it.bit || 0])
    );
    return Buffer.concat([header, cmd, ...itemBufs]);
  }

  /**
   * @param {Array} items 요청 시 보낸 항목 목록. 응답 항목 하나의 크기가
   *   워드 영역(3B: echo+값2B)인지 비트 영역(2B: echo+값1B)인지는 요청한 영역코드로만
   *   판단할 수 있어(응답 자체에 크기 정보가 없음), 파싱 시 반드시 필요하다.
   *   (영역코드 < 0x80 이면 비트 영역)
   */
  _parseReadResponse(buf, items) {
    // 최소한 헤더(10)+명령echo(2)+종료코드(2)=14바이트는 있어야 함
    if (buf.length < 14) {
      throw new Error('UDP 읽기 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
    }
    const sid = buf[9];
    const endCode = buf.readUInt16BE(12);

    // PLC가 에러로 응답한 경우, "07 01" 상수와 값 데이터 없이 여기서 끝남(14바이트).
    // 이걸 "프레임이 너무 짧다"고 잘못 판단하지 않도록 endCode부터 먼저 확인한다.
    if (endCode !== 0) {
      return { sid, endCode, values: [] };
    }

    // 정상 응답: 헤더(10)+명령echo(2)+종료코드(2)+상수 07 01(2)=16, 이후 값(비트=2B/워드=3B)*N
    if (buf.length < 16) {
      throw new Error('UDP 읽기 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
    }
    const values = [];
    let offset = 16;
    for (const it of items) {
      const isBit = it.area < 0x80;
      const size = isBit ? 2 : 3;
      if (offset + size > buf.length) break;
      const area = buf[offset];
      const value = isBit ? buf[offset + 1] : buf.readUInt16BE(offset + 1);
      values.push({ area, value });
      offset += size;
    }
    return { sid, endCode, values };
  }

  /**
   * @param {boolean} isBit true면 비트 영역 쓰기 - FINS 규격상 항목당 데이터가 1바이트
   *   (0x00/0x01)이어야 한다. false(워드 영역)면 항목당 2바이트.
   *   이 구분 없이 항상 2바이트(word)로 보내면, 비트 쓰기 시 PLC가 실제로 읽는 첫 바이트가
   *   항상 상위바이트(0x00)라서 ON(1)을 써도 항상 OFF(0)가 전송되는 버그가 있었다.
   */
  _buildWriteFrame(area, addr, value, sid, bit = 0, isBit = false) {
    const header = this._buildHeader(sid);
    const cmd = Buffer.from([0x01, 0x02]);
    const addrBuf = Buffer.from([area, (addr >> 8) & 0xff, addr & 0xff, bit & 0xff]);
    const itemCount = Buffer.from([0x00, 0x01]); // 항목 1개
    const data = isBit ? Buffer.from([value ? 0x01 : 0x00]) : Buffer.alloc(2);
    if (!isBit) data.writeUInt16BE(value & 0xffff, 0);
    return Buffer.concat([header, cmd, addrBuf, itemCount, data]);
  }

  _parseWriteResponse(buf) {
    // 헤더(10) + 명령echo(2) + 종료코드(2) = 14, 데이터 없음
    if (buf.length < 14) {
      throw new Error('UDP 쓰기 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
    }
    const sid = buf[9];
    const endCode = buf.readUInt16BE(12);
    return { sid, endCode };
  }

  /**
   * FINS 05 01 (CONTROLLER DATA READ) 응답 파서.
   * 헤더(10)+명령echo(2)+종료코드(2)=14, 이후 모델명(20B)+버전(20B) ASCII.
   */
  _parseControllerResponse(buf) {
    if (buf.length < 14) {
      throw new Error('CPU 데이터 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
    }
    const sid = buf[9];
    const endCode = buf.readUInt16BE(12);
    if (endCode !== 0) {
      return { sid, endCode, model: '', version: '' };
    }
    if (buf.length < 54) {
      throw new Error('CPU 데이터 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
    }
    const model = buf.slice(14, 34).toString('ascii').replace(/\0/g, '').trim();
    const version = buf.slice(34, 54).toString('ascii').replace(/\0/g, '').trim();
    return { sid, endCode, model, version };
  }

  /**
   * FINS 21 02 (ERROR LOG READ) 응답 파서.
   * 헤더(10)+명령echo(2)+종료코드(2)=14, 이후 최대레코드(2)+현재개수(2)+응답개수(2)=20, 이후 레코드(10B)*N.
   */
  _parseErrorLogResponse(buf) {
    if (buf.length < 14) {
      throw new Error('에러 로그 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
    }
    const sid = buf[9];
    const endCode = buf.readUInt16BE(12);
    if (endCode !== 0) {
      return { sid, endCode, maxRecords: 0, currentCount: 0, returnedCount: 0, records: [] };
    }
    if (buf.length < 20) {
      throw new Error('에러 로그 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
    }
    const maxRecords = buf.readUInt16BE(14);
    const currentCount = buf.readUInt16BE(16);
    const returnedCount = buf.readUInt16BE(18);
    const records = [];
    let offset = 20;
    for (let i = 0; i < returnedCount && offset + 10 <= buf.length; i++) {
      const code = buf.readUInt16BE(offset);
      const detail = buf.readUInt16BE(offset + 2);
      const time = decodeBcdTimestamp(buf, offset + 4);
      records.push({ code, detail, time, description: decodeErrorCode(code) });
      offset += 10;
    }
    return { sid, endCode, maxRecords, currentCount, returnedCount, records };
  }

  _handleMessage(msg) {
    if (msg.length < 10) {
      this.log('WARN', 'UDP 응답이 너무 짧아 무시함', msg.toString('hex'));
      return;
    }
    const sid = msg[9];
    const pending = this.pending.get(sid);
    if (!pending) {
      this.log('WARN', `대기 중이 아닌 SID 응답 수신 (SID=${sid})`, msg.toString('hex'));
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(sid);
    try {
      const parsed =
        pending.type === 'raw'
          ? { sid, raw: msg }
          : pending.type === 'write'
          ? this._parseWriteResponse(msg)
          : pending.type === 'controller'
          ? this._parseControllerResponse(msg)
          : pending.type === 'errorlog'
          ? this._parseErrorLogResponse(msg)
          : this._parseReadResponse(msg, pending.items);
      pending.resolve(parsed);
    } catch (err) {
      pending.reject(err);
    }
  }

  /**
   * 임의의 FINS 명령(cmd + 데이터)을 보내고 { endCode, payload }를 돌려준다.
   * payload = 종료코드(offset 12) 다음의 바이트들. finsCommands.js에서 사용.
   */
  _command(cmdBuf, dataBuf = Buffer.alloc(0)) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('UDP 연결이 되어 있지 않습니다.');
      const sid = this._nextSid();
      const frame = Buffer.concat([this._buildHeader(sid), cmdBuf, dataBuf]);
      this.log('SEND', `명령 ${cmdBuf.toString('hex')} 요청 (SID=${sid})`, frame.toString('hex'));
      const { raw } = await this._sendAndWait(frame, sid, 'raw');
      this.log('RECV', `명령 응답 수신 (SID=${sid})`, null);
      if (raw.length < 14) throw new Error('명령 응답 프레임이 너무 짧습니다: ' + raw.toString('hex'));
      return { endCode: raw.readUInt16BE(12), payload: raw.slice(14) };
    });
  }

  _sendAndWait(frame, sid, type, items) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(sid);
        reject(new Error(`UDP 응답 타임아웃 (SID=${sid})`));
      }, RESPONSE_TIMEOUT_MS);

      this.pending.set(sid, { resolve, reject, timer, type, items });

      this.socket.send(frame, 0, frame.length, this.port, this.host, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(sid);
          reject(new Error('UDP 전송 실패: ' + err.message));
        }
      });
    });
  }

  /** items 목록을 한번에 읽어서 [{area, addr, value}] 형태로 반환 */
  readItems(items) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('UDP 연결이 되어 있지 않습니다.');
      const sid = this._nextSid();
      const reqFrame = this._buildReadFrame(items, sid);
      this.log('SEND', `읽기 요청 (${items.length}개 항목, SID=${sid})`, reqFrame.toString('hex'));

      const parsed = await this._sendAndWait(reqFrame, sid, 'read', items);
      this.log('RECV', `응답 수신 (SID=${parsed.sid})`, null);

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
   * FINS 05 01 (CONTROLLER DATA READ) - CPU 모델명/버전 조회.
   * CPU 모델(CJ2H-CPU64/65/66/67/68-EIP 등)에 따라 EM(확장 DM) 뱅크 개수가 다르므로,
   * 접속 직후 이 값을 읽어 UI에 표시하면 실제 장착된 CPU를 바로 확인할 수 있다.
   */
  async readControllerData() {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('UDP 연결이 되어 있지 않습니다.');
      const sid = this._nextSid();
      const header = this._buildHeader(sid);
      const cmd = Buffer.from([0x05, 0x01]);
      const frame = Buffer.concat([header, cmd]);
      this.log('SEND', `CPU 모델/버전 조회 (SID=${sid})`, frame.toString('hex'));

      const parsed = await this._sendAndWait(frame, sid, 'controller');
      this.log('RECV', `CPU 모델/버전 응답 수신 (SID=${parsed.sid})`, null);

      if (parsed.endCode !== 0) {
        throw new Error(`PLC 응답 에러 코드: 0x${parsed.endCode.toString(16).padStart(4, '0')}`);
      }
      return { model: parsed.model, version: parsed.version };
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
      if (!this.connected) throw new Error('UDP 연결이 되어 있지 않습니다.');
      const start = Number.isFinite(opts.start) ? opts.start : 0;
      const count = Math.max(1, Math.min(20, Number.isFinite(opts.count) ? opts.count : 20));

      const sid = this._nextSid();
      const header = this._buildHeader(sid);
      // FINS 21 02 (ERROR LOG READ) - 09 20은 MESSAGE READ/CLEAR로 다른 명령이었음 (오적용 수정)
      const cmd = Buffer.from([
        0x21, 0x02,
        (start >> 8) & 0xff, start & 0xff,
        (count >> 8) & 0xff, count & 0xff,
      ]);
      const frame = Buffer.concat([header, cmd]);
      this.log('SEND', `에러 로그 조회 (SID=${sid})`, frame.toString('hex'));

      const parsed = await this._sendAndWait(frame, sid, 'errorlog');
      this.log('RECV', `에러 로그 응답 수신 (SID=${parsed.sid})`, null);

      if (parsed.endCode !== 0) {
        throw new Error(`PLC 응답 에러 코드: 0x${parsed.endCode.toString(16).padStart(4, '0')}`);
      }
      // 방어 코드: 21 02 규격상 최대 저장 개수는 항상 20(0x14) 근방이어야 한다.
      // 이보다 훨씬 큰 값이 나오면 다른 요청의 응답과 뒤섞였다는 신호이므로,
      // 잘못된 값을 그대로 보여주지 않고 명확한 에러로 알린다.
      if (parsed.maxRecords > 100 || parsed.currentCount > 100 || parsed.returnedCount > 100) {
        throw new Error(
          `에러 로그 응답 값이 비정상적입니다 (maxRecords=${parsed.maxRecords}, currentCount=${parsed.currentCount}, ` +
            `returnedCount=${parsed.returnedCount}). 다른 요청의 응답과 뒤섞였을 가능성이 있습니다. 다시 시도해 보세요.`
        );
      }
      return {
        maxRecords: parsed.maxRecords,
        currentCount: parsed.currentCount,
        returnedCount: parsed.returnedCount,
        records: parsed.records,
      };
    });
  }

  /** 단일 워드 쓰기 (area: AREA_CODES.* 값, addr: 0-based 주소, value: 0~65535) */
  writeWord(area, addr, value) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('UDP 연결이 되어 있지 않습니다.');
      const sid = this._nextSid();
      const reqFrame = this._buildWriteFrame(area, addr, value, sid, 0);
      this.log('SEND', `쓰기 요청 (영역=0x${area.toString(16)}, 주소=${addr}, 값=${value}, SID=${sid})`, reqFrame.toString('hex'));

      const parsed = await this._sendAndWait(reqFrame, sid, 'write');
      this.log('RECV', `쓰기 응답 수신 (SID=${parsed.sid})`, null);

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
      if (!this.connected) throw new Error('UDP 연결이 되어 있지 않습니다.');
      const sid = this._nextSid();
      const reqFrame = this._buildWriteFrame(area, addr, value ? 1 : 0, sid, bit, true);
      this.log('SEND', `비트 쓰기 요청 (영역=0x${area.toString(16)}, 주소=${addr}.${bit}, 값=${value ? 1 : 0}, SID=${sid})`, reqFrame.toString('hex'));

      const parsed = await this._sendAndWait(reqFrame, sid, 'write');
      this.log('RECV', `비트 쓰기 응답 수신 (SID=${parsed.sid})`, null);

      if (parsed.endCode !== 0) {
        throw new Error(`PLC 쓰기 에러 코드: 0x${parsed.endCode.toString(16).padStart(4, '0')}`);
      }
      return true;
    });
  }
}

module.exports = { UdpFinsClient, AREA_CODES, emAreaCode, DEFAULT_PORT, DEFAULT_PLC_NODE, DEFAULT_PC_NODE };
