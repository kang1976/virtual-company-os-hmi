'use strict';

/**
 * Omron CJ2H Virtual FINS Simulator Client
 * 실물 PLC 하드웨어 없이도 FINS 메모리(D, CIO, W, H, E0)와 센서/밸브 시뮬레이션을
 * 100% 브라우저/모바일에서 테스트할 수 있도록 제공하는 가상 시뮬레이터 클라이언트입니다.
 */

const { AREA_CODES, emAreaCode } = require('./usbFinsClient');

class VirtualFinsClient {
  constructor(logger = () => {}) {
    this.connected = false;
    this.log = logger;
    this._requestChain = Promise.resolve();

    // 가상 메모리 공간 (16비트 워드 배열)
    this.memory = {
      D: new Uint16Array(32768),
      CIO: new Uint16Array(6144),
      W: new Uint16Array(512),
      H: new Uint16Array(512),
      E0: new Uint16Array(32768),
    };

    // 초기 데모/시뮬레이션 값 세팅
    this._initDefaultData();

    // 시뮬레이션 센서 주기 변동 타이머
    this._simTimer = null;
  }

  _initDefaultData() {
    // PT 센서 압력 기본값 세팅 (예: 125.0 kPa, 84.0 kPa 등)
    this.memory.D[100] = 1250;
    this.memory.D[101] = 1250;
    this.memory.D[102] = 840;
    this.memory.D[103] = 840;
    this.memory.D[110] = 1500;
    this.memory.D[120] = 200;

    // 기본 밸브 상태 (0: 닫힘, 1: 열림)
    this.memory.CIO[0] = 0x0001;
    this.memory.W[0] = 0x0000;
  }

  _startSimLoop() {
    if (this._simTimer) clearInterval(this._simTimer);
    let tick = 0;
    this._simTimer = setInterval(() => {
      tick++;
      // PT 압력 센서 수치에 미세한 현실적인 노이즈/변동 추가
      const noise = Math.sin(tick * 0.2) * 5;
      this.memory.D[100] = Math.max(0, Math.min(3000, Math.round(1250 + noise * 3)));
      this.memory.D[102] = Math.max(0, Math.min(3000, Math.round(840 + Math.cos(tick * 0.15) * 8)));
    }, 500);
  }

  _stopSimLoop() {
    if (this._simTimer) {
      clearInterval(this._simTimer);
      this._simTimer = null;
    }
  }

  _enqueue(fn) {
    const run = () => fn();
    const result = this._requestChain.then(run, run);
    this._requestChain = result.then(() => {}, () => {});
    return result;
  }

  connect(opts = {}) {
    if (this.connected) return Promise.resolve();
    this.connected = true;
    this._startSimLoop();
    this.log('SYSTEM', '가상 FINS 시뮬레이터(Virtual Mock) 연결 성공 (CJ2H-CPU65-EIP 에뮬레이션)', null);
    return Promise.resolve();
  }

  disconnect() {
    if (!this.connected) return Promise.resolve();
    this.connected = false;
    this._stopSimLoop();
    this.log('SYSTEM', '가상 FINS 시뮬레이터 연결 해제', null);
    return Promise.resolve();
  }

  _getMemoryArea(areaCode) {
    if (areaCode === AREA_CODES.D || areaCode === 0x82) return this.memory.D;
    if (areaCode === AREA_CODES.CIO || areaCode === 0xB0) return this.memory.CIO;
    if (areaCode === AREA_CODES.W || areaCode === 0xB1) return this.memory.W;
    if (areaCode === AREA_CODES.H || areaCode === 0xB2) return this.memory.H;
    if (areaCode === AREA_CODES.E0 || areaCode === 0xA0) return this.memory.E0;
    return this.memory.D;
  }

  readMultipleWords(items) {
    return this._enqueue(() => {
      if (!this.connected) throw new Error('가상 시뮬레이터가 연결되지 않았습니다.');
      const results = [];
      for (const item of items) {
        const mem = this._getMemoryArea(item.area);
        const val = (mem && item.addr < mem.length) ? mem[item.addr] : 0;
        results.push({
          label: item.label,
          area: item.area,
          addr: item.addr,
          bit: item.bit || 0,
          value: val,
        });
      }
      this.log('SEND', `가상 메모리 다중 읽기 (${items.length}개 항목)`, null);
      this.log('RECV', `가상 메모리 읽기 완료 (응답 코드 0000)`, null);
      return Promise.resolve(results);
    });
  }

  readMultipleBitStates(items) {
    return this._enqueue(() => {
      if (!this.connected) throw new Error('가상 시뮬레이터가 연결되지 않았습니다.');
      const results = [];
      for (const item of items) {
        const mem = this._getMemoryArea(item.area);
        const wordVal = (mem && item.addr < mem.length) ? mem[item.addr] : 0;
        const bitVal = (wordVal >> (item.bit || 0)) & 1;
        results.push({
          label: item.label,
          area: item.area,
          addr: item.addr,
          bit: item.bit || 0,
          value: bitVal,
        });
      }
      this.log('SEND', `가상 비트 상태 읽기 (${items.length}개 항목)`, null);
      this.log('RECV', `가상 비트 읽기 완료 (응답 코드 0000)`, null);
      return Promise.resolve(results);
    });
  }

  writeWord(area, addr, value) {
    return this._enqueue(() => {
      if (!this.connected) throw new Error('가상 시뮬레이터가 연결되지 않았습니다.');
      const mem = this._getMemoryArea(area);
      if (mem && addr < mem.length) {
        mem[addr] = Number(value) & 0xffff;
      }
      this.log('SEND', `가상 메모리 쓰기 (Area:0x${Number(area).toString(16)}, Addr:${addr}, Val:${value})`, null);
      this.log('RECV', `가상 메모리 쓰기 완료 (응답 코드 0000)`, null);
      return Promise.resolve({ ok: true });
    });
  }

  readControllerInfo() {
    return this._enqueue(() => {
      this.log('SEND', '05 01 CONTROLLER DATA READ (가상)', null);
      const info = {
        model: 'CJ2H-CPU65-EIP (Virtual Simulator)',
        version: 'v2.5.8-SIM',
        unitAddress: 0x00,
        rawText: 'CJ2H-CPU65-EIP Virtual FINS Simulation Engine v2.5.8',
      };
      this.log('RECV', `05 01 CPU 모델: ${info.model}, 버전: ${info.version}`, null);
      return Promise.resolve(info);
    });
  }

  readStatus() {
    return this._enqueue(() => {
      this.log('SEND', '06 01 CONTROLLER STATUS READ (가상)', null);
      const status = {
        runMode: 'RUN',
        statusText: 'RUN (가상 시뮬레이션)',
        hasError: false,
        batteryLow: false,
      };
      this.log('RECV', '06 01 상태: RUN (가상)', null);
      return Promise.resolve(status);
    });
  }

  readClock() {
    return this._enqueue(() => {
      const now = new Date();
      return Promise.resolve({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        dayOfWeek: now.getDay(),
        iso: now.toISOString(),
      });
    });
  }

  readErrorLog(opts = {}) {
    return this._enqueue(() => {
      return Promise.resolve({
        maxRecords: 20,
        validCount: 0,
        records: [],
      });
    });
  }

  clearErrorLog() {
    return this._enqueue(() => {
      return Promise.resolve({ ok: true });
    });
  }
}

module.exports = {
  VirtualFinsClient,
};
