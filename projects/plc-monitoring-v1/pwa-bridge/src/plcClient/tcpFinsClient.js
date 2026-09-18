'use strict';

/**
 * Omron CJ2H-CPU68EIP FINS/TCP 통신 모듈
 *
 * PROJECT_SUMMARY_AND_PROTOCOL.md 5-3에 정리된 대로,
 * FINS/TCP는 UDP와 내부 FINS 프레임 구조가 동일하고, 앞에
 * 표준 FINS/TCP 헤더(매직바이트 "FINS" + 길이(4B) + command(4B))가 추가된다.
 *
 * 연결 절차:
 *   1) TCP 연결 후 클라이언트가 먼저 "Node Address Data Send"(command=0)를 보냄
 *   2) 서버(PLC)가 "Node Address Data Response"(command=1)로 클라이언트/서버 노드 번호를 응답
 *      → 이후 통신에 이 노드 번호를 SA1(PC)/DA1(PLC)로 사용
 *   3) 이후 모든 FINS 프레임은 command=2("FINS/TCP 명령 데이터 전송")로 감싸서 주고받음
 *      (UDP에서 쓰던 것과 동일한 FINS 헤더(10B)+명령 데이터, 체크섬/AB 래핑 없음)
 *
 * ⚠️ 아직 실제 PLC로 검증 전입니다. 최초 연결 시 영향 없는 주소(W 등)로 먼저 확인 권장.
 */

const net = require('net');
const { AREA_CODES, emAreaCode, decodeErrorCode, decodeBcdTimestamp } = require('./finsShared');

const DEFAULT_PORT = 9600;
const DEFAULT_PLC_NODE = 0x50; // 80 (핸드셰이크 응답으로 실제 값이 덮어써짐)
const DEFAULT_PC_NODE = 0x01; // 1  (핸드셰이크 응답으로 실제 값이 덮어써짐)
const HANDSHAKE_TIMEOUT_MS = 3000;
const RESPONSE_TIMEOUT_MS = 2000;

class TcpFinsClient {
  constructor(logger = () => {}) {
    this.socket = null;
    this.connected = false;
    this.log = logger; // (direction, message, hexOrNull) => void
    this.sid = 0;
    this.pending = new Map(); // sid -> { resolve, reject, timer, type }
    this.recvBuffer = Buffer.alloc(0);
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
    this._requestChain = result.then(
      () => {},
      () => {}
    );
    return result;
  }

  /**
   * @param {object} opts
   * @param {string} opts.host PLC IP 주소 (필수)
   * @param {number} [opts.port=9600] PLC FINS/TCP 포트
   * @param {number} [opts.plcNode=0x50] 핸드셰이크 시 요청할 노드 번호 힌트 (응답으로 실제 값이 확정됨)
   * @param {number} [opts.pcNode=0x01] 핸드셰이크 시 클라이언트가 요청할 노드 번호
   */
  connect(opts = {}) {
    if (this.connected) return Promise.resolve();

    const { host, port = DEFAULT_PORT, plcNode = DEFAULT_PLC_NODE, pcNode = 0 } = opts;
    // pcNode 기본값 0 = "자동 할당 요청". 특정 노드 번호를 강제 요청하면
    // PLC의 FINS/TCP 연결 설정(고정 노드 방식)에 따라 거부(에러 0x00000002 등)될 수 있어
    // 기본은 자동 할당으로 두고, 필요할 때만 명시적으로 지정하도록 함.
    if (!host) {
      throw new Error('TCP 연결에는 PLC IP 주소(host)가 필요합니다.');
    }

    this.host = host;
    this.port = Number(port) || DEFAULT_PORT;
    this.plcNode = Number(plcNode) & 0xff;
    this.pcNode = Number(pcNode) & 0xff;

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;

      const onEarlyError = (err) => {
        this.connected = false;
        if (!settled) {
          settled = true;
          reject(new Error('TCP 연결 오류: ' + err.message));
        }
      };
      socket.once('error', onEarlyError);

      socket.connect(this.port, this.host, () => {
        this.log('SYSTEM', `TCP 연결됨 (${this.host}:${this.port}), 노드 핸드셰이크 시작`, null);

        this._doHandshake(socket)
          .then(({ clientNode, serverNode }) => {
            this.pcNode = clientNode;
            this.plcNode = serverNode;
            this.socket = socket;
            this.connected = true;
            settled = true;

            socket.removeListener('error', onEarlyError);
            socket.on('error', (err) => this.log('ERROR', 'TCP 소켓 오류: ' + err.message, null));
            socket.on('data', (chunk) => this._onData(chunk));
            socket.on('close', () => {
              if (this.connected) {
                this.connected = false;
                this.log('SYSTEM', 'TCP 연결이 예기치 않게 종료됨', null);
              }
            });

            this.log(
              'SYSTEM',
              `노드 핸드셰이크 완료 (PC노드=0x${clientNode.toString(16).padStart(2, '0')}, PLC노드=0x${serverNode
                .toString(16)
                .padStart(2, '0')})`,
              null
            );
            resolve();
          })
          .catch((err) => {
            settled = true;
            try {
              socket.destroy();
            } catch (e) {
              /* ignore */
            }
            reject(err);
          });
      });
    });
  }

  /** FINS/TCP 노드 주소 핸드셰이크 (command 0 -> 1) */
  _doHandshake(socket) {
    return new Promise((resolve, reject) => {
      let buf = Buffer.alloc(0);

      const timer = setTimeout(() => {
        socket.removeListener('data', onData);
        reject(new Error('TCP 노드 핸드셰이크 타임아웃'));
      }, HANDSHAKE_TIMEOUT_MS);

      const onData = (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        if (buf.length < 8) return;
        if (buf.toString('ascii', 0, 4) !== 'FINS') {
          clearTimeout(timer);
          socket.removeListener('data', onData);
          reject(new Error('잘못된 FINS/TCP 매직 바이트 수신: ' + buf.toString('hex')));
          return;
        }
        const length = buf.readUInt32BE(4);
        const totalNeeded = 8 + length;
        if (buf.length < totalNeeded) return; // 아직 다 안 옴

        const command = buf.readUInt32BE(8);
        clearTimeout(timer);
        socket.removeListener('data', onData);

        if (command !== 1) {
          reject(new Error(`예상치 못한 핸드셰이크 응답 command=${command}`));
          return;
        }
        const errorCode = buf.readUInt32BE(12);
        if (errorCode !== 0) {
          reject(new Error(`FINS/TCP 핸드셰이크 에러코드: 0x${errorCode.toString(16).padStart(8, '0')}`));
          return;
        }
        const clientNode = buf.readUInt32BE(16) & 0xff;
        const serverNode = buf.readUInt32BE(20) & 0xff;
        resolve({ clientNode, serverNode });
      };
      socket.on('data', onData);

      // 클라이언트 -> 서버: Node Address Data Send (command=0)
      // 실제 FINS/TCP 와이어 포맷은 command 뒤에 error_code(4B, 항상 0)가 오고
      // 그 다음에 client node 번호(4B)가 온다. 이 error_code 필드를 빠뜨리면
      // PLC가 "데이터 길이가 맞지 않음"(0x00000002) 에러로 응답한다.
      const errorCodeField = Buffer.alloc(4); // 0으로 채움
      const clientNodeField = Buffer.alloc(4);
      clientNodeField.writeUInt32BE(this.pcNode, 0);
      const header = Buffer.alloc(8);
      header.write('FINS', 0, 'ascii');
      header.writeUInt32BE(4 + errorCodeField.length + clientNodeField.length, 4); // length = command(4)+errorcode(4)+node(4)=12
      const command = Buffer.alloc(4);
      command.writeUInt32BE(0, 0);
      socket.write(Buffer.concat([header, command, errorCodeField, clientNodeField]));
    });
  }

  disconnect() {
    if (!this.connected && !this.socket) return;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('연결이 해제되었습니다.'));
    }
    this.pending.clear();
    try {
      if (this.socket) this.socket.destroy();
    } catch (e) {
      /* ignore */
    }
    this.connected = false;
    this.recvBuffer = Buffer.alloc(0);
    this.log('SYSTEM', 'TCP 연결 해제', null);
  }

  _nextSid() {
    this.sid = (this.sid + 1) & 0xff;
    return this.sid;
  }

  /** FINS 헤더 10바이트 (UDP와 동일 구조) */
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
      throw new Error('TCP 읽기 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
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
      throw new Error('TCP 읽기 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
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
    if (buf.length < 14) {
      throw new Error('TCP 쓰기 응답 프레임이 너무 짧습니다: ' + buf.toString('hex'));
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

  /**
   * FINS 프레임(헤더+명령데이터)을 FINS/TCP command=2 프레임으로 감쌈.
   * FINS/TCP 헤더는 handshake(command=0/1)뿐 아니라 데이터 프레임(command=2)에도
   * 항상 command(4B) 다음에 error_code(4B, 송신 시 0으로 고정) 필드가 온 뒤에
   * 실제 FINS 프레임이 이어진다. 이 필드를 빠뜨리면 PLC가 command=3
   * (Frame Send Error Notification, 에러코드 0x00000002="데이터 길이가 맞지 않음")로 거부한다.
   */
  _wrapFinsFrame(finsFrame) {
    const header = Buffer.alloc(8);
    header.write('FINS', 0, 'ascii');
    header.writeUInt32BE(4 + 4 + finsFrame.length, 4); // length = command(4)+errorcode(4)+FINS프레임
    const command = Buffer.alloc(4);
    command.writeUInt32BE(2, 0);
    const errorCodeField = Buffer.alloc(4); // 송신 시 항상 0
    return Buffer.concat([header, command, errorCodeField, finsFrame]);
  }

  /** TCP는 스트림이라 프레임 경계를 직접 잘라내야 함 */
  _onData(chunk) {
    this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);

    for (;;) {
      if (this.recvBuffer.length < 8) return;
      if (this.recvBuffer.toString('ascii', 0, 4) !== 'FINS') {
        this.log('WARN', 'FINS/TCP 매직 바이트 불일치, 수신 버퍼 초기화', this.recvBuffer.toString('hex'));
        this.recvBuffer = Buffer.alloc(0);
        return;
      }
      const length = this.recvBuffer.readUInt32BE(4);
      const totalNeeded = 8 + length;
      if (this.recvBuffer.length < totalNeeded) return; // 더 받아야 완전한 프레임

      const frame = this.recvBuffer.subarray(0, totalNeeded);
      this.recvBuffer = this.recvBuffer.subarray(totalNeeded);

      const command = frame.readUInt32BE(8);
      if (command === 2) {
        // magic(4)+length(4)+command(4)+error_code(4) 다음이 실제 FINS 헤더+명령데이터
        const finsFrame = frame.subarray(16);
        this._handleFinsFrame(finsFrame);
      } else if (command === 3) {
        // Frame Send Error Notification: PLC가 방금 보낸 command=2 프레임 자체를
        // 처리하지 못했다는 뜻. SID 정보가 없어 어떤 요청인지 특정할 수 없으므로,
        // 가장 오래 기다리고 있는(=먼저 보낸) 요청을 실패 처리한다.
        const errorCode = frame.length >= 16 ? frame.readUInt32BE(12) : null;
        const codeText = errorCode !== null ? `0x${errorCode.toString(16).padStart(8, '0')}` : '알 수 없음';
        this.log('WARN', `PLC가 프레임 전송 실패를 알림 (에러코드=${codeText})`, frame.toString('hex'));
        const oldestSid = this.pending.keys().next().value;
        if (oldestSid !== undefined) {
          const pending = this.pending.get(oldestSid);
          clearTimeout(pending.timer);
          this.pending.delete(oldestSid);
          pending.reject(new Error(`FINS/TCP 프레임 전송 실패 (에러코드=${codeText})`));
        }
      } else {
        this.log('WARN', `처리하지 않는 FINS/TCP command=${command} 프레임 수신`, frame.toString('hex'));
      }
    }
  }

  _handleFinsFrame(msg) {
    if (msg.length < 10) {
      this.log('WARN', 'FINS 프레임이 너무 짧아 무시함', msg.toString('hex'));
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
      if (!this.connected) throw new Error('TCP 연결이 되어 있지 않습니다.');
      const sid = this._nextSid();
      const finsFrame = Buffer.concat([this._buildHeader(sid), cmdBuf, dataBuf]);
      this.log('SEND', `명령 ${cmdBuf.toString('hex')} 요청 (SID=${sid})`, finsFrame.toString('hex'));
      const { raw } = await this._sendAndWait(finsFrame, sid, 'raw');
      this.log('RECV', `명령 응답 수신 (SID=${sid})`, null);
      if (raw.length < 14) throw new Error('명령 응답 프레임이 너무 짧습니다: ' + raw.toString('hex'));
      return { endCode: raw.readUInt16BE(12), payload: raw.slice(14) };
    });
  }

  _sendAndWait(finsFrame, sid, type, items) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(sid);
        reject(new Error(`TCP 응답 타임아웃 (SID=${sid})`));
      }, RESPONSE_TIMEOUT_MS);

      this.pending.set(sid, { resolve, reject, timer, type, items });

      const wrapped = this._wrapFinsFrame(finsFrame);
      this.socket.write(wrapped, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(sid);
          reject(new Error('TCP 전송 실패: ' + err.message));
        }
      });
    });
  }

  /** items 목록을 한번에 읽어서 [{area, addr, value}] 형태로 반환 */
  readItems(items) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('TCP 연결이 되어 있지 않습니다.');
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
      if (!this.connected) throw new Error('TCP 연결이 되어 있지 않습니다.');
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
      if (!this.connected) throw new Error('TCP 연결이 되어 있지 않습니다.');
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
      if (!this.connected) throw new Error('TCP 연결이 되어 있지 않습니다.');
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
      if (!this.connected) throw new Error('TCP 연결이 되어 있지 않습니다.');
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

module.exports = { TcpFinsClient, AREA_CODES, emAreaCode, DEFAULT_PORT, DEFAULT_PLC_NODE, DEFAULT_PC_NODE };
