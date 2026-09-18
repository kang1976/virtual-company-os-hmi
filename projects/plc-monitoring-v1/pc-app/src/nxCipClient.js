'use strict';

/**
 * Omron NX/NJ 시리즈 CPU 내장 EtherNet/IP 포트용 CIP(Common Industrial Protocol) 클라이언트.
 *
 * CJ 시리즈(usbFinsClient.js/udpFinsClient.js/tcpFinsClient.js)는 D/CIO/W 같은 "고정 메모리
 * 영역 + 워드 주소"로 접근하는 FINS 프로토콜을 쓰지만, NX/NJ 시리즈는 그런 개념이 없고
 * 프로그램에 정의된 "전역 변수(태그) 이름"으로 직접 읽고 쓰는 EtherNet/IP-CIP 방식을 쓴다.
 * 이 클라이언트는 태그 이름 문자열을 그대로 주고받는 것을 전제로 한다(주소 개념 없음).
 *
 * 구현 근거: ODVA(Open DeviceNet Vendors Association)가 공개한 CIP 표준 규격(Volume 1: 공통
 * 서비스/캡슐화 프로토콜, Appendix C: 데이터 타입 코드)이며, Omron NJ/NX 시리즈 CPU 유닛
 * 내장 EtherNet/IP 포트 사용자 매뉴얼(W506)에도 "심볼릭 태그명으로 Read/Write Tag Service를
 * 지원한다"고 명시되어 있다. Rockwell(Allen-Bradley) ControlLogix/CompactLogix용 오픈소스
 * 라이브러리(pylogix, pycomm3, node-ethernet-ip 등)들이 동일한 프로토콜 구조로 태그를
 * 읽고 쓰며, 이들 라이브러리는 Omron NJ/NX도 호환 대상으로 명시하고 있다.
 *
 * ⚠️ 실제 Omron NX/NJ 하드웨어로 아직 검증되지 않았습니다(참조용 캡처 없음). 최초 연결 시
 *   영향 없는 태그로 먼저 읽기 테스트를 해보고, 오류가 나면 로그의 상태 코드를 확인해주세요.
 */

const net = require('net');

const DEFAULT_PORT = 44818; // EtherNet/IP 표준 포트 (TCP)
const RESPONSE_TIMEOUT_MS = 3000;
const MAX_TAGS_PER_MULTI_REQUEST = 20; // Multiple Service Packet 하나에 담을 최대 태그 수

// ── 캡슐화 프로토콜(Encapsulation) 명령 코드 ──
const CMD_REGISTER_SESSION = 0x0065;
const CMD_UNREGISTER_SESSION = 0x0066;
const CMD_SEND_RR_DATA = 0x006f;

// ── CIP 서비스 코드 ──
const SVC_GET_ATTRIBUTES_ALL = 0x01;
const SVC_READ_TAG = 0x4c;
const SVC_WRITE_TAG = 0x4d;
const SVC_MULTIPLE_SERVICE = 0x0a;

// ── CIP 기본(elementary) 데이터 타입 코드 (ODVA Vol1 Appendix C) ──
const CIP_TYPES = {
  BOOL: 0xc1,
  SINT: 0xc2,
  INT: 0xc3,
  DINT: 0xc4,
  LINT: 0xc5,
  USINT: 0xc6,
  UINT: 0xc7,
  UDINT: 0xc8,
  ULINT: 0xc9,
  REAL: 0xca,
  LREAL: 0xcb,
  BYTE: 0xd1,
  WORD: 0xd2,
  DWORD: 0xd3,
  LWORD: 0xd4,
};
const CIP_TYPE_NAMES = Object.fromEntries(Object.entries(CIP_TYPES).map(([k, v]) => [v, k]));

function cipTypeByteLength(typeCode) {
  switch (typeCode) {
    case CIP_TYPES.BOOL:
    case CIP_TYPES.SINT:
    case CIP_TYPES.USINT:
    case CIP_TYPES.BYTE:
      return 1;
    case CIP_TYPES.INT:
    case CIP_TYPES.UINT:
      return 2;
    case CIP_TYPES.DINT:
    case CIP_TYPES.UDINT:
    case CIP_TYPES.REAL:
    case CIP_TYPES.DWORD:
      return 4;
    case CIP_TYPES.LINT:
    case CIP_TYPES.ULINT:
    case CIP_TYPES.LREAL:
    case CIP_TYPES.LWORD:
      return 8;
    default:
      return 4;
  }
}

function decodeCipValue(typeCode, buf, offset) {
  switch (typeCode) {
    case CIP_TYPES.BOOL:
    case CIP_TYPES.SINT:
      return buf.readInt8(offset);
    case CIP_TYPES.USINT:
    case CIP_TYPES.BYTE:
      return buf.readUInt8(offset);
    case CIP_TYPES.INT:
      return buf.readInt16LE(offset);
    case CIP_TYPES.UINT:
      return buf.readUInt16LE(offset);
    case CIP_TYPES.DINT:
      return buf.readInt32LE(offset);
    case CIP_TYPES.UDINT:
    case CIP_TYPES.DWORD:
      return buf.readUInt32LE(offset);
    case CIP_TYPES.REAL:
      return buf.readFloatLE(offset);
    case CIP_TYPES.LINT:
      return buf.readBigInt64LE(offset);
    case CIP_TYPES.ULINT:
    case CIP_TYPES.LWORD:
      return buf.readBigUInt64LE(offset);
    case CIP_TYPES.LREAL:
      return buf.readDoubleLE(offset);
    default:
      return buf.readUInt32LE(offset);
  }
}

function encodeCipValue(typeCode, value) {
  const len = cipTypeByteLength(typeCode);
  const buf = Buffer.alloc(len);
  switch (typeCode) {
    case CIP_TYPES.BOOL:
    case CIP_TYPES.SINT:
      buf.writeInt8(Number(value), 0);
      break;
    case CIP_TYPES.USINT:
    case CIP_TYPES.BYTE:
      buf.writeUInt8(Number(value), 0);
      break;
    case CIP_TYPES.INT:
      buf.writeInt16LE(Number(value), 0);
      break;
    case CIP_TYPES.UINT:
      buf.writeUInt16LE(Number(value), 0);
      break;
    case CIP_TYPES.DINT:
      buf.writeInt32LE(Number(value), 0);
      break;
    case CIP_TYPES.UDINT:
    case CIP_TYPES.DWORD:
      buf.writeUInt32LE(Number(value) >>> 0, 0);
      break;
    case CIP_TYPES.REAL:
      buf.writeFloatLE(Number(value), 0);
      break;
    case CIP_TYPES.LINT:
      buf.writeBigInt64LE(BigInt(value), 0);
      break;
    case CIP_TYPES.ULINT:
    case CIP_TYPES.LWORD:
      buf.writeBigUInt64LE(BigInt(value), 0);
      break;
    case CIP_TYPES.LREAL:
      buf.writeDoubleLE(Number(value), 0);
      break;
    default:
      buf.writeUInt32LE(Number(value) >>> 0, 0);
  }
  return buf;
}

/** 태그 이름(예: "MyTag" 또는 "MyStruct.Member" 또는 "MyArray[3]")을 심볼릭 세그먼트로 인코딩. */
function encodeTagPath(tagName) {
  // "Tag[3]" -> 배열 인덱스는 별도 멤버 세그먼트(0x28/0x29)로 붙여야 하지만,
  // 우선 가장 흔한 사용 형태(단일 변수, 구조체 멤버 "."는 각 구간을 별도 심볼릭 세그먼트로)를 지원한다.
  const parts = String(tagName).split('.');
  const segments = [];
  for (const part of parts) {
    const nameBuf = Buffer.from(part, 'ascii');
    const segLen = nameBuf.length;
    const padded = segLen % 2 === 1;
    const seg = Buffer.alloc(2 + segLen + (padded ? 1 : 0));
    seg.writeUInt8(0x91, 0); // ANSI Extended Symbol Segment
    seg.writeUInt8(segLen, 1);
    nameBuf.copy(seg, 2);
    segments.push(seg);
  }
  return Buffer.concat(segments);
}

/** Read Tag Service(0x4C) 요청 하나(경로+서비스+엘리먼트수)를 만든다. */
function buildReadTagRequest(tagName, elementCount = 1) {
  const path = encodeTagPath(tagName);
  const header = Buffer.from([SVC_READ_TAG, path.length / 2]);
  const elemCountBuf = Buffer.alloc(2);
  elemCountBuf.writeUInt16LE(elementCount, 0);
  return Buffer.concat([header, path, elemCountBuf]);
}

/** Write Tag Service(0x4D) 요청 하나를 만든다. */
function buildWriteTagRequest(tagName, typeCode, value, elementCount = 1) {
  const path = encodeTagPath(tagName);
  const header = Buffer.from([SVC_WRITE_TAG, path.length / 2]);
  const typeAndCount = Buffer.alloc(4);
  typeAndCount.writeUInt16LE(typeCode, 0);
  typeAndCount.writeUInt16LE(elementCount, 2);
  const valueBuf = encodeCipValue(typeCode, value);
  return Buffer.concat([header, path, typeAndCount, valueBuf]);
}

/** CIP 응답 하나(서비스 응답 헤더+상태+데이터)를 파싱한다. */
function parseCipReply(buf, offset) {
  const replyService = buf.readUInt8(offset);
  // buf[offset+1] = reserved(0)
  const generalStatus = buf.readUInt8(offset + 2);
  const addStatusSize = buf.readUInt8(offset + 3);
  const dataStart = offset + 4 + addStatusSize * 2;
  return { replyService, generalStatus, dataStart };
}

class NxCipClient {
  constructor(logger = () => {}) {
    this.socket = null;
    this.connected = false;
    this.log = logger;
    this.sessionHandle = 0;
    this.host = null;
    this.port = DEFAULT_PORT;
    this.rxBuffer = Buffer.alloc(0);
    this.pending = null; // 현재 응답을 기다리는 단일 요청 { resolve, reject, timer }
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

  connect(opts = {}) {
    if (this.connected) return Promise.resolve();
    const { host, port = DEFAULT_PORT } = opts;
    if (!host) throw new Error('EtherNet/IP 연결에는 PLC IP 주소(host)가 필요합니다.');
    this.host = host;
    this.port = Number(port) || DEFAULT_PORT;

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;

      socket.once('error', (err) => {
        this.connected = false;
        if (!settled) {
          settled = true;
          reject(new Error('EtherNet/IP 소켓 오류: ' + err.message));
        } else {
          this.log('ERROR', 'EtherNet/IP 소켓 오류: ' + err.message, null);
        }
      });
      socket.on('close', () => {
        this.connected = false;
      });
      socket.on('data', (chunk) => this._handleData(chunk));

      socket.connect(this.port, this.host, async () => {
        this.socket = socket;
        try {
          await this._registerSession();
          this.connected = true;
          settled = true;
          this.log('SYSTEM', `EtherNet/IP 연결 준비 완료 (${this.host}:${this.port}, 세션=0x${this.sessionHandle.toString(16)})`, null);
          resolve();
        } catch (err) {
          this.connected = false;
          if (!settled) {
            settled = true;
            reject(err);
          }
        }
      });
    });
  }

  disconnect() {
    if (!this.connected && !this.socket) return;
    try {
      if (this.connected && this.sessionHandle) {
        this.socket.write(this._buildEncapHeader(CMD_UNREGISTER_SESSION, Buffer.alloc(0)));
      }
    } catch (e) {
      /* ignore */
    }
    try {
      this.socket.destroy();
    } catch (e) {
      /* ignore */
    }
    this.socket = null;
    this.connected = false;
    this.sessionHandle = 0;
    this.rxBuffer = Buffer.alloc(0);
    this.log('SYSTEM', 'EtherNet/IP 연결 해제', null);
  }

  _buildEncapHeader(command, data) {
    const header = Buffer.alloc(24);
    header.writeUInt16LE(command, 0);
    header.writeUInt16LE(data.length, 2);
    header.writeUInt32LE(this.sessionHandle, 4);
    header.writeUInt32LE(0, 8); // status
    // 8바이트 SenderContext는 0으로 둠 (요청/응답을 소켓 하나에 순차 처리하므로 상관관계 불필요)
    header.writeUInt32LE(0, 16); // options
    return Buffer.concat([header, data]);
  }

  _handleData(chunk) {
    this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);
    // 캡슐화 헤더(24B) + Length만큼 다 도착했는지 확인
    while (this.rxBuffer.length >= 24) {
      const length = this.rxBuffer.readUInt16LE(2);
      const total = 24 + length;
      if (this.rxBuffer.length < total) break;
      const frame = this.rxBuffer.slice(0, total);
      this.rxBuffer = this.rxBuffer.slice(total);
      this._onFrame(frame);
    }
  }

  _onFrame(frame) {
    if (!this.pending) return;
    const { resolve, reject, timer } = this.pending;
    this.pending = null;
    clearTimeout(timer);
    const status = frame.readUInt32LE(8);
    if (status !== 0) {
      reject(new Error(`EtherNet/IP 캡슐화 오류 (status=0x${status.toString(16)})`));
      return;
    }
    resolve(frame);
  }

  /** 캡슐화 프레임 하나를 보내고 응답 프레임을 기다린다 (한 번에 하나만 진행). */
  _sendAndWait(command, data) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error('EtherNet/IP 응답 타임아웃'));
      }, RESPONSE_TIMEOUT_MS);
      this.pending = { resolve, reject, timer };
      const frame = this._buildEncapHeader(command, data);
      this.socket.write(frame, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending = null;
          reject(new Error('EtherNet/IP 쓰기 실패: ' + err.message));
        }
      });
    });
  }

  async _registerSession() {
    const data = Buffer.alloc(4);
    data.writeUInt16LE(1, 0); // Protocol Version
    data.writeUInt16LE(0, 2); // Options Flags
    this.log('SEND', 'RegisterSession 요청', data.toString('hex'));
    const respFrame = await this._sendAndWait(CMD_REGISTER_SESSION, data);
    this.sessionHandle = respFrame.readUInt32LE(4);
    this.log('RECV', `RegisterSession 응답 (세션=0x${this.sessionHandle.toString(16)})`, respFrame.toString('hex'));
  }

  /** CIP 요청(메시지 라우터 요청 바이트) 하나를 SendRRData로 감싸 보내고, CIP 응답 바이트를 반환한다. */
  _sendCipRequest(cipRequest) {
    return this._enqueue(async () => {
      if (!this.connected) throw new Error('EtherNet/IP 장치가 연결되어 있지 않습니다.');

      const interfaceHandle = Buffer.alloc(4); // 0 = CIP
      const timeout = Buffer.alloc(2);
      timeout.writeUInt16LE(10, 0);
      // CPF(Common Packet Format): Null Address Item + Unconnected Data Item
      const itemCount = Buffer.alloc(2);
      itemCount.writeUInt16LE(2, 0);
      const nullAddrItem = Buffer.from([0x00, 0x00, 0x00, 0x00]); // TypeID=0, Length=0
      const dataItemHeader = Buffer.alloc(4);
      dataItemHeader.writeUInt16LE(0x00b2, 0); // Unconnected Data Item
      dataItemHeader.writeUInt16LE(cipRequest.length, 2);

      const data = Buffer.concat([interfaceHandle, timeout, itemCount, nullAddrItem, dataItemHeader, cipRequest]);
      this.log('SEND', `CIP 요청 (${cipRequest.length}B)`, cipRequest.toString('hex'));
      const respFrame = await this._sendAndWait(CMD_SEND_RR_DATA, data);
      this.log('RECV', 'CIP 응답 수신', respFrame.toString('hex'));

      // 응답도 동일한 CPF 구조 - Unconnected Data Item(2번째 아이템)의 데이터가 CIP 응답
      const respData = respFrame.slice(24);
      const respItemCount = respData.readUInt16LE(4);
      let offset = 6;
      let cipReplyBuf = null;
      for (let i = 0; i < respItemCount; i++) {
        const typeId = respData.readUInt16LE(offset);
        const len = respData.readUInt16LE(offset + 2);
        const itemDataStart = offset + 4;
        if (typeId === 0x00b2) {
          cipReplyBuf = respData.slice(itemDataStart, itemDataStart + len);
        }
        offset = itemDataStart + len;
      }
      if (!cipReplyBuf) throw new Error('CIP 응답에서 Unconnected Data Item을 찾지 못했습니다.');
      return cipReplyBuf;
    });
  }

  /** 태그 하나를 읽는다. @returns {Promise<{value:any, typeCode:number, typeName:string}>} */
  async readTag(tagName) {
    const req = buildReadTagRequest(tagName);
    const reply = await this._sendCipRequest(req);
    const { replyService, generalStatus, dataStart } = parseCipReply(reply, 0);
    if (generalStatus !== 0) {
      throw new Error(`태그 "${tagName}" 읽기 실패 (CIP 상태코드=0x${generalStatus.toString(16)})`);
    }
    if (replyService !== (SVC_READ_TAG | 0x80)) {
      throw new Error(`태그 "${tagName}" 응답 서비스 코드가 예상과 다릅니다 (0x${replyService.toString(16)})`);
    }
    const typeCode = reply.readUInt16LE(dataStart);
    const value = decodeCipValue(typeCode, reply, dataStart + 2);
    return { value, typeCode, typeName: CIP_TYPE_NAMES[typeCode] || `0x${typeCode.toString(16)}` };
  }

  /** 태그 하나에 값을 쓴다. dataType은 'INT'/'DINT'/'REAL' 등 CIP 타입 이름(대문자). */
  async writeTag(tagName, value, dataType) {
    const typeCode = CIP_TYPES[String(dataType || 'DINT').toUpperCase()];
    if (!typeCode) throw new Error(`알 수 없는 CIP 데이터 타입: ${dataType}`);
    const req = buildWriteTagRequest(tagName, typeCode, value);
    const reply = await this._sendCipRequest(req);
    const { replyService, generalStatus } = parseCipReply(reply, 0);
    if (generalStatus !== 0) {
      throw new Error(`태그 "${tagName}" 쓰기 실패 (CIP 상태코드=0x${generalStatus.toString(16)})`);
    }
    if (replyService !== (SVC_WRITE_TAG | 0x80)) {
      throw new Error(`태그 "${tagName}" 쓰기 응답 서비스 코드가 예상과 다릅니다 (0x${replyService.toString(16)})`);
    }
  }

  /**
   * 여러 태그를 Multiple Service Packet(0x0A) 하나로 묶어 한 번에 읽는다.
   * MAX_TAGS_PER_MULTI_REQUEST개씩 청크로 나눠 순차 요청한다.
   * @returns {Promise<Array<{tagName, value, typeCode, typeName, error}>>}
   */
  async readTags(tagNames) {
    const results = [];
    for (let i = 0; i < tagNames.length; i += MAX_TAGS_PER_MULTI_REQUEST) {
      const chunk = tagNames.slice(i, i + MAX_TAGS_PER_MULTI_REQUEST);
      if (chunk.length === 1) {
        try {
          const r = await this.readTag(chunk[0]);
          results.push({ tagName: chunk[0], ...r });
        } catch (err) {
          results.push({ tagName: chunk[0], error: err.message });
        }
        continue;
      }
      try {
        const chunkResults = await this._readTagsMultiple(chunk);
        results.push(...chunkResults);
      } catch (err) {
        // Multiple Service Packet 자체가 실패하면 그 청크 전체를 개별 오류로 채운다
        chunk.forEach((tagName) => results.push({ tagName, error: err.message }));
      }
    }
    return results;
  }

  async _readTagsMultiple(tagNames) {
    const subRequests = tagNames.map((name) => buildReadTagRequest(name));
    // Multiple Service Packet 요청 조립: 서비스+경로(클래스0x02/인스턴스1) + 개수 + 오프셋 배열 + 하위요청들
    const classPath = Buffer.from([0x20, 0x02, 0x24, 0x01]); // Class 0x02(Message Router), Instance 1
    const header = Buffer.from([SVC_MULTIPLE_SERVICE, classPath.length / 2]);
    const countBuf = Buffer.alloc(2);
    countBuf.writeUInt16LE(subRequests.length, 0);
    const offsetsStart = 2 + subRequests.length * 2; // countBuf 다음부터 오프셋 배열, 그 뒤 하위요청들
    const offsets = Buffer.alloc(subRequests.length * 2);
    let running = offsetsStart;
    subRequests.forEach((r, i) => {
      offsets.writeUInt16LE(running, i * 2);
      running += r.length;
    });
    const req = Buffer.concat([header, classPath, countBuf, offsets, ...subRequests]);

    const reply = await this._sendCipRequest(req);
    const { replyService, generalStatus, dataStart } = parseCipReply(reply, 0);
    if (replyService !== (SVC_MULTIPLE_SERVICE | 0x80)) {
      throw new Error(`Multiple Service Packet 응답 서비스 코드가 예상과 다릅니다 (0x${replyService.toString(16)})`);
    }
    // generalStatus가 0x1E(Embedded service error)면 개별 응답 status를 봐야 함 - 아래에서 처리
    if (generalStatus !== 0 && generalStatus !== 0x1e) {
      throw new Error(`Multiple Service Packet 실패 (CIP 상태코드=0x${generalStatus.toString(16)})`);
    }

    const replyCount = reply.readUInt16LE(dataStart);
    const replyOffsets = [];
    for (let i = 0; i < replyCount; i++) {
      replyOffsets.push(reply.readUInt16LE(dataStart + 2 + i * 2));
    }
    const results = [];
    for (let i = 0; i < replyCount; i++) {
      const subStart = dataStart + replyOffsets[i];
      const sub = parseCipReply(reply, subStart);
      const tagName = tagNames[i];
      if (sub.generalStatus !== 0) {
        results.push({ tagName, error: `CIP 상태코드=0x${sub.generalStatus.toString(16)}` });
        continue;
      }
      const typeCode = reply.readUInt16LE(sub.dataStart);
      const value = decodeCipValue(typeCode, reply, sub.dataStart + 2);
      results.push({ tagName, value, typeCode, typeName: CIP_TYPE_NAMES[typeCode] || `0x${typeCode.toString(16)}` });
    }
    return results;
  }

  /** Identity Object(Class 0x01, Instance 1)에서 컨트롤러 모델/버전 정보를 읽는다. */
  async readControllerData() {
    const classPath = Buffer.from([0x20, 0x01, 0x24, 0x01]); // Class 0x01(Identity), Instance 1
    const req = Buffer.concat([Buffer.from([SVC_GET_ATTRIBUTES_ALL, classPath.length / 2]), classPath]);
    const reply = await this._sendCipRequest(req);
    const { generalStatus, dataStart } = parseCipReply(reply, 0);
    if (generalStatus !== 0) {
      throw new Error(`컨트롤러 정보 조회 실패 (CIP 상태코드=0x${generalStatus.toString(16)})`);
    }
    let offset = dataStart;
    offset += 2; // Vendor ID
    offset += 2; // Device Type
    offset += 2; // Product Code
    const revMajor = reply.readUInt8(offset);
    const revMinor = reply.readUInt8(offset + 1);
    offset += 2;
    offset += 2; // Status
    offset += 4; // Serial Number
    const nameLen = reply.readUInt8(offset);
    const productName = reply.slice(offset + 1, offset + 1 + nameLen).toString('ascii');
    return { model: productName || 'NX/NJ 시리즈', version: `${revMajor}.${revMinor}` };
  }
}

module.exports = { NxCipClient, CIP_TYPES, CIP_TYPE_NAMES, DEFAULT_PORT };
