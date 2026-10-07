'use strict';

/**
 * PLC 연결 하나(USB/UDP/TCP 중 하나)의 생명주기 + 카운터 + 통신 이력을 캡슐화한다.
 * 메인 대시보드와 그리드 화면이 각자 독립된 연결을 가질 수 있도록,
 * server.js에서 이 팩토리로 두 개의 세션(main/grid)을 만들어 쓴다.
 */

const fs = require('fs');
const { UsbFinsClient } = require('./usbFinsClient');
const { nowLocalIso } = require('./timeUtils');
const { UdpFinsClient, DEFAULT_PORT: UDP_DEFAULT_PORT, DEFAULT_PLC_NODE, DEFAULT_PC_NODE } = require('./udpFinsClient');
const { TcpFinsClient } = require('./tcpFinsClient');
const { NxCipClient, DEFAULT_PORT: NX_DEFAULT_PORT } = require('./nxCipClient');
const { VirtualFinsClient } = require('./virtualFinsClient');

/**
 * @param {object} opts
 * @param {(msg: object) => void} opts.broadcast
 * @param {string} opts.logFile 이 세션의 통신 이력을 append할 로그 파일 경로
 * @param {{log: string, counters: string, logsCleared: string}} opts.wsTypes 이 세션이 브로드캐스트할 WS 메시지 타입 이름
 * @param {number} [opts.maxLogEntries]
 * @param {() => void} opts.stopDependents 재연결/연결해제 전에 멈춰야 할 이 세션의 폴링 루프(들)
 */
function createPlcSession({ broadcast, logFile, wsTypes, maxLogEntries = 500, stopDependents }) {
  function makeClient(type, series) {
    if (series === 'NX') return new NxCipClient(pushLog);
    if (type === 'VIRTUAL' || type === 'VIRTUAL_SIM' || type === 'MOCK' || type === 'SIMULATOR') {
      return new VirtualFinsClient(pushLog);
    }
    if (type === 'UDP') return new UdpFinsClient(pushLog);
    if (type === 'TCP') return new TcpFinsClient(pushLog);
    return new UsbFinsClient(pushLog);
  }

  const state = {
    connectionType: 'USB',
    plcSeries: 'CJ', // 'CJ' | 'NX' - CJ만 실제 통신 프로토콜이 구현되어 있음
    connected: false,
    connecting: false, // connect() 진행 중 여부 - 중복 클릭/동시 요청으로 인한 경쟁 상태 방지
    lastError: null,
    connectionParams: null, // UDP/TCP: { host, port, plcNode, pcNode }
    controllerInfo: null,
    counters: { send: 0, recvSuccess: 0, recvError: 0 },
    latencyMs: null,
    logs: [],
  };

  // 연결 시도가 이 시간 안에 끝나지 않으면 실패로 간주하고 포기한다. 네트워크가 응답 없이
  // 조용히 끊긴 경우(방화벽 드롭 등) client.connect()의 내부 Promise가 영원히 pending 상태로
  // 남아 "버튼을 눌러도 반응이 없고 새로고침해야만 풀리는" 증상을 만들 수 있어 방지한다.
  const CONNECT_TIMEOUT_MS = 8000;
  function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); }
      );
    });
  }

  let client = new UsbFinsClient(pushLog);

  // SEND 직후 시각을 기억해뒀다가 다음 RECV에서 그 차이를 왕복 지연시간으로 기록한다.
  // 각 클라이언트는 _requestChain으로 요청을 하나씩만 순차 처리하므로 SEND 다음에 오는
  // RECV는 항상 그 요청의 응답이라는 전제가 성립한다. WARN/SYSTEM/ERROR가 끼어들면
  // (예: 연결 실패, CPU정보 조회 실패) 다음 실제 요청의 지연시간이 오염되지 않도록 무효화한다.
  let lastSendAt = null;

  function pushLog(direction, message, hex) {
    const entry = { time: nowLocalIso(), direction, message, hex: hex || null };

    if (direction === 'SEND') {
      state.counters.send++;
      lastSendAt = Date.now();
    } else if (direction === 'RECV') {
      if (lastSendAt != null) state.latencyMs = Date.now() - lastSendAt;
      lastSendAt = null;
    } else {
      if (direction === 'ERROR') state.counters.recvError++;
      lastSendAt = null;
    }

    state.logs.push(entry);
    if (state.logs.length > maxLogEntries) state.logs.shift();
    fs.appendFile(logFile, JSON.stringify(entry) + '\n', () => {});
    broadcast({ type: wsTypes.log, payload: entry });
    broadcast({ type: wsTypes.counters, payload: { ...state.counters, latencyMs: state.latencyMs } });
  }

  /** 폴링 루프에서 항목 하나(또는 청크 하나) 읽기에 성공했을 때 호출 */
  function recordRecvSuccess() {
    state.counters.recvSuccess++;
    broadcast({ type: wsTypes.counters, payload: { ...state.counters, latencyMs: state.latencyMs } });
  }

  function resetCounters() {
    state.counters = { send: 0, recvSuccess: 0, recvError: 0 };
    state.latencyMs = null;
    pushLog('SYSTEM', '카운터 초기화됨', null);
  }

  function clearLogs() {
    state.logs = [];
    broadcast({ type: wsTypes.logsCleared });
  }

  function getStatus() {
    return {
      connectionType: state.connectionType,
      plcSeries: state.plcSeries,
      connected: state.connected,
      lastError: state.lastError,
      connectionParams: state.connectionParams,
      controllerInfo: state.controllerInfo,
      counters: state.counters,
      latencyMs: state.latencyMs,
    };
  }

  function getRecentLogs(n) {
    return state.logs.slice(-n);
  }

  /** body: { type, host, port, plcNode, pcNode, series } - type 생략 시 USB, series 생략 시 CJ */
  async function connect(body) {
    // 이미 연결 시도가 진행 중이면 새 요청을 거부한다. 이걸 막지 않으면(예: 사용자가 버튼을
    // 연속으로 누르거나, 페이지 두 개에서 거의 동시에 연결 요청을 보내는 경우) 두 connect()
    // 호출이 같은 client 변수를 서로 다른 시점에 덮어써서, 한쪽 호출이 끝난 뒤 state가
    // 실제로 살아있는 client와 어긋난 채로 멈춰버리는("버튼은 눌리는데 아무 반응 없고
    // 새로고침해야 풀리는") 상태가 될 수 있다.
    if (state.connecting) {
      throw new Error('이미 연결을 시도하는 중입니다. 잠시 후 다시 시도하세요.');
    }
    state.connecting = true;

    const rawType = String(body.type || 'USB').toUpperCase();
    const requestedType = rawType === 'UDP' || rawType === 'TCP' ? rawType : 'USB';
    const requestedSeries = String(body.series || 'CJ').toUpperCase() === 'NX' ? 'NX' : 'CJ';

    try {
      // 기존 연결이 있으면 먼저 정리(타입이 같아도 재연결 허용)
      if (state.connected) {
        stopDependents();
        client.disconnect();
      }

      client = makeClient(requestedType, requestedSeries);
      state.plcSeries = requestedSeries;

      if (requestedSeries === 'NX') {
        // NX는 FINS(UDP/TCP/USB) 개념이 없고 EtherNet/IP(TCP) 하나뿐이라, 연결 방식 선택과 무관하게
        // 항상 EtherNet/IP로 접속한다. connType 표시상으로는 'TCP'로 취급한다.
        const host = (body.host || '').trim();
        if (!host) {
          throw new Error('NX(EtherNet/IP) 연결에는 PLC IP 주소(host)를 입력해야 합니다.');
        }
        const port = body.port !== undefined && body.port !== '' ? Number(body.port) : NX_DEFAULT_PORT;
        if (!Number.isFinite(port) || port < 1 || port > 65535) {
          throw new Error('포트 번호가 올바르지 않습니다 (1~65535).');
        }
        state.connectionType = 'TCP';
        await withTimeout(client.connect({ host, port }), CONNECT_TIMEOUT_MS, `연결 시도가 ${CONNECT_TIMEOUT_MS / 1000}초 안에 응답하지 않았습니다. PLC 전원/네트워크 상태를 확인하세요.`);
        state.connectionParams = { host, port };
      } else if (requestedType === 'UDP' || requestedType === 'TCP') {
        state.connectionType = requestedType;
        const host = (body.host || '').trim();
        if (!host) {
          throw new Error(`${requestedType} 연결에는 PLC IP 주소(host)를 입력해야 합니다.`);
        }
        const port = body.port !== undefined && body.port !== '' ? Number(body.port) : UDP_DEFAULT_PORT;
        const plcNode = body.plcNode !== undefined && body.plcNode !== '' ? Number(body.plcNode) : DEFAULT_PLC_NODE;
        // TCP는 클라이언트 노드 번호를 PLC가 자동 할당하도록 0을 기본으로 요청
        // (특정 번호를 강제 요청하면 PLC의 FINS/TCP 연결 설정에 따라 거부될 수 있음)
        const defaultPcNode = requestedType === 'TCP' ? 0 : DEFAULT_PC_NODE;
        const pcNode = body.pcNode !== undefined && body.pcNode !== '' ? Number(body.pcNode) : defaultPcNode;

        if (!Number.isFinite(port) || port < 1 || port > 65535) {
          throw new Error('포트 번호가 올바르지 않습니다 (1~65535).');
        }
        if (!Number.isFinite(plcNode) || plcNode < 0 || plcNode > 255 || !Number.isFinite(pcNode) || pcNode < 0 || pcNode > 255) {
          throw new Error('FINS 노드 번호가 올바르지 않습니다 (0~255).');
        }

        await withTimeout(
          client.connect({ host, port, plcNode, pcNode }),
          CONNECT_TIMEOUT_MS,
          `연결 시도가 ${CONNECT_TIMEOUT_MS / 1000}초 안에 응답하지 않았습니다. PLC 전원/네트워크 상태를 확인하세요.`
        );
        state.connectionParams = { host, port, plcNode: client.plcNode, pcNode: client.pcNode };
      } else {
        state.connectionType = requestedType;
        client.connect();
        state.connectionParams = null;
      }

      state.connected = true;
      state.lastError = null;
      state.controllerInfo = null;

      // 연결 직후 CPU 모델/버전 조회 (실패해도 연결 자체는 유지, 경고만 로그)
      try {
        const info = await withTimeout(client.readControllerData(), CONNECT_TIMEOUT_MS, 'CPU 정보 조회 타임아웃');
        state.controllerInfo = info;
        pushLog('SYSTEM', `CPU 정보 확인: ${info.model} (버전 ${info.version})`, null);
      } catch (err) {
        pushLog('WARN', 'CPU 모델/버전 조회 실패: ' + err.message, null);
      }

      return getStatus();
    } catch (err) {
      state.connected = false;
      state.lastError = err.message;
      pushLog('ERROR', err.message, null);
      throw err;
    } finally {
      state.connecting = false;
    }
  }

  function disconnect() {
    stopDependents();
    client.disconnect();
    state.connected = false;
    state.controllerInfo = null;
  }

  /**
   * 폴링 루프가 몇 사이클 연속으로 통신에 실패했을 때(예: USB 벌크 엔드포인트가 타임아웃 이후
   * 응답 불능 상태로 굳어버리는 경우) 호출된다. 사용자가 수동으로 하던 "연결 해제 후 재연결"과
   * 동일하게 저수준 클라이언트만 새로 만들어 재연결하되, connect()/disconnect()와 달리
   * stopDependents()를 호출하지 않아 폴링 루프 자체(gridState/trendState.status)는 그대로
   * 'running'으로 유지된 채 다음 폴링 사이클부터 새 클라이언트로 이어서 통신한다.
   */
  async function reconnectClient() {
    if (!state.connected) return;
    const type = state.connectionType;
    const series = state.plcSeries;
    const params = state.connectionParams;
    try {
      client.disconnect();
    } catch (e) {
      /* ignore */
    }
    client = makeClient(type, series);
    if (series === 'NX') {
      await client.connect({ host: params.host, port: params.port });
    } else if (type === 'UDP' || type === 'TCP') {
      await client.connect({
        host: params.host,
        port: params.port,
        plcNode: params.plcNode,
        pcNode: params.pcNode,
      });
    } else {
      client.connect();
    }
    pushLog('SYSTEM', '[자동 복구] 통신 오류가 반복되어 연결을 다시 맺었습니다.', null);
  }

  return {
    getClient: () => client,
    pushLog,
    recordRecvSuccess,
    resetCounters,
    clearLogs,
    getStatus,
    getRecentLogs,
    connect,
    disconnect,
    reconnectClient,
  };
}

module.exports = { createPlcSession };
