'use strict';

/**
 * 트렌드 모니터링 페이지 전용 변수 목록 저장/폴링 관리자.
 * src/gridManager.js의 변수 폴링 패턴(인덱스 기반 값 매핑)을 그대로 가져다 쓰되,
 * 그리드와 달리 "지금 값 스냅샷"이 아니라 "시계열 축적"이 목적이라 폴링마다 방금 읽은
 * 값만 델타로 브로드캐스트한다(프론트가 자기 버퍼에 이어붙임 - 매번 전체를 다시 보내지 않음).
 * 쓰기 기능은 이 페이지에 필요 없어 만들지 않는다(읽기 전용 모니터링).
 */

const path = require('path');
const fs = require('fs');
const { areaNameToCode, areaNameToBitCode } = require('./gridManager');
const { wordCountFor, decodeValue } = require('./dataTypes');
const { resolveSnapshotDir, filePrefix, reconnectPolicy } = require('./settingsManager');
const { nowLocalIso } = require('./timeUtils');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const TREND_VARIABLES_FILE = path.join(dataDir, 'trendVariables.json');

// 정지(stop) 시 서버가 들고 있던 기록을 자동으로 로그 파일에 남기는 기본 폴더.
// 설정 페이지에서 스냅샷 폴더를 지정하면 저장 시점에 그 폴더로 대체된다.
const defaultTrendLogsDir = path.join(__dirname, '..', 'logs', 'trend');
if (!fs.existsSync(defaultTrendLogsDir)) fs.mkdirSync(defaultTrendLogsDir, { recursive: true });

function getTrendLogsDir() {
  return resolveSnapshotDir(defaultTrendLogsDir);
}

const MAX_ITEMS_PER_READ = 32; // server.js/gridManager.js와 동일한 기준으로 청크 분할

// ── 변수 목록 파일 저장/로드 ──
function loadTrendVariables() {
  try {
    if (!fs.existsSync(TREND_VARIABLES_FILE)) return [];
    const raw = fs.readFileSync(TREND_VARIABLES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.variables) ? data.variables : [];
  } catch (e) {
    return [];
  }
}

function saveTrendVariablesToFile(variables) {
  fs.writeFileSync(
    TREND_VARIABLES_FILE,
    JSON.stringify({ variables, savedAt: nowLocalIso() }, null, 2)
  );
}

function chunkItems(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * 변수 목록을 FINS 읽기 항목(items)으로 펼친다. gridManager.js의 buildReadPlan과 동일하게
 * label이 아니라 variables 배열 내 위치(index)를 키로 써서 이름 중복 문제를 피한다.
 */
function buildReadPlan(variables) {
  const items = [];
  const plan = []; // { variable, index, wordCount, error? }
  variables.forEach((v, index) => {
    let area;
    try {
      area = v.dataType === 'BOOL' ? areaNameToBitCode(v.area) : areaNameToCode(v.area);
    } catch (e) {
      plan.push({ variable: v, index, wordCount: 0, error: e.message });
      return;
    }
    const wordCount = wordCountFor(v.dataType, v.length);
    for (let i = 0; i < wordCount; i++) {
      items.push({ label: `${index}#${i}`, area, addr: v.address + i, bit: v.bit || 0 });
    }
    plan.push({ variable: v, index, wordCount });
  });
  return { items, plan };
}

// 한 폴링 사이클의 모든 청크가 연속으로 이 횟수만큼 실패하면 자동 재연결을 시도한다.
const RECONNECT_AFTER_CYCLES = 2;

// 서버측 시계열 버퍼 최대 길이. 클라이언트 MAX_POINTS_PER_SERIES와 동일하게 맞춤.
const MAX_HISTORY = 3600;

/** 클라이언트의 labelFor()와 동일한 규칙 - "영역+주소(+비트)" 형태의 주소 라벨. */
function addressLabelFor(v) {
  if (v.offline) return v.label;
  return `${v.area}${v.address}${v.dataType === 'BOOL' && v.bit ? '.' + v.bit : ''}`;
}

/** Windows 파일명에 못 쓰는 문자를 밑줄로 바꾼다. */
function sanitizeFilename(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim() || 'unnamed';
}

function formatStamp(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function formatDateTimeFull(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 개별 트렌드 팝업에서 "정지"를 눌렀을 때, 그 변수 하나만의 시계열을 로그 파일로 남긴다.
 * 파일명: "주소(설명)_시작시간_종료시간.csv" (설명이 없으면 괄호 생략)
 * @param {{ label: string, description?: string, timestamps: number[], values: any[] }} data
 */
function saveSingleSeriesLog({ label, description, timestamps, values }) {
  if (!Array.isArray(timestamps) || timestamps.length === 0) return null;
  const startStamp = formatStamp(new Date(timestamps[0]));
  const endStamp = formatStamp(new Date(timestamps[timestamps.length - 1]));
  const rows = [['시간', '값']];
  timestamps.forEach((t, i) => {
    const val = values[i];
    rows.push([formatDateTimeFull(new Date(t)), val === undefined || val === null || val === '' ? '' : val]);
  });
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const displayLabel = description ? `${label}(${description})` : label;
  const fileName = `${filePrefix('SNAP')}_${sanitizeFilename(displayLabel)}_${startStamp}_${endStamp}.csv`;
  fs.writeFileSync(path.join(getTrendLogsDir(), fileName), '﻿' + csv, 'utf8');
  return fileName;
}

function createTrendManager({ getClient, broadcast, pushLog, recordRecvSuccess, reconnectClient }) {
  // ── 인스턴스별 상태 ──
  // 다중 PLC 세션(세션 레지스트리)에서 매니저를 여러 개 만들 수 있도록
  // 모듈 레벨이 아니라 팩토리 안에 둔다.
  const trendState = {
    status: 'stopped', // 'stopped' | 'running' | 'paused'
    intervalMs: 1000,
    timer: null,
    consecutiveCycleErrors: 0,
    reconnectAttempts: 0,
    lastReconnectAt: 0,
  };

  // 설정(자동 재연결 간격/최대 시도)을 반영한 자동 복구 (gridManager와 동일한 규칙).
  async function tryAutoReconnect() {
    if (!reconnectClient) return;
    const { intervalMs, maxRetries } = reconnectPolicy();
    const now = Date.now();
    if (now - trendState.lastReconnectAt < intervalMs) return;
    if (maxRetries > 0 && trendState.reconnectAttempts >= maxRetries) {
      if (trendState.reconnectAttempts === maxRetries) {
        pushLog('WARN', `[트렌드] 자동 재연결 최대 시도(${maxRetries}회) 초과 - 자동 복구를 멈춥니다. 수동으로 다시 연결하세요.`, null);
        trendState.reconnectAttempts += 1;
      }
      return;
    }
    trendState.lastReconnectAt = now;
    trendState.reconnectAttempts += 1;
    try {
      await reconnectClient();
      pushLog('SYSTEM', `[트렌드] 자동 재연결 시도 ${trendState.reconnectAttempts}회`, null);
    } catch (err) {
      pushLog('ERROR', `[트렌드] 자동 재연결 실패(${trendState.reconnectAttempts}회): ${err.message}`, null);
    }
  }

  // 폴링은 서버에서 계속 진행되지만(화면을 독립 연결로 바꾼 이후), 트렌드 화면을 다른 화면으로
  // 옮겼다가 돌아오면 브라우저 탭의 JS 상태(seriesBuffers)가 새로고침되어 그동안 쌓인 그래프가
  // 사라지는 문제가 있었다. 그래서 서버가 최근 값들을 별도로 들고 있다가, 클라이언트가(재)접속할
  // 때 한꺼번에 넘겨줘서 그래프를 그대로 복원할 수 있게 한다.
  let valueHistory = []; // [{ t, values }, ...]

  function getValueHistory() {
    return valueHistory;
  }

  /**
   * 정지(stop) 시점에 그동안 쌓인 전체 기록(valueHistory)을 Total 로그 파일로 남긴다.
   * 개별 변수 파일은 각 트렌드 팝업에서 "정지"를 누른 그 변수만 따로 저장하므로 여기서는 만들지 않는다.
   * 파일명: "Trend_시작시간_종료시간.csv" (그 기록의 실제 첫 시각~마지막 시각 기준)
   */
  function saveHistoryLogs() {
    if (valueHistory.length === 0) return;
    const variables = loadTrendVariables();
    if (variables.length === 0) return;
    const startStamp = formatStamp(new Date(valueHistory[0].t));
    const endStamp = formatStamp(new Date(valueHistory[valueHistory.length - 1].t));

    const totalRows = [['시간', ...variables.map((v) => addressLabelFor(v) + (v.description ? `(${v.description})` : ''))]];
    valueHistory.forEach(({ t, values }) => {
      const row = [formatDateTimeFull(new Date(t))];
      variables.forEach((v, idx) => {
        const val = values[idx];
        row.push(val === undefined || val === null ? '' : val);
      });
      totalRows.push(row);
    });
    const totalCsv = totalRows.map((r) => r.map(csvEscape).join(',')).join('\n');
    fs.writeFileSync(path.join(getTrendLogsDir(), `${filePrefix('SNAP')}_Trend_${startStamp}_${endStamp}.csv`), '﻿' + totalCsv, 'utf8');
  }

  async function pollOnce(variables) {
    const { items, plan } = buildReadPlan(variables);
    const client = getClient();
    const rawByItemLabel = {};
    const chunks = chunkItems(items, MAX_ITEMS_PER_READ);
    let anySuccess = false;

    for (const chunk of chunks) {
      if (trendState.status !== 'running') break;
      try {
        const results = await client.readItems(chunk);
        results.forEach((r, idx) => {
          rawByItemLabel[chunk[idx].label] = r.value;
        });
        recordRecvSuccess();
        anySuccess = true;
      } catch (err) {
        pushLog('ERROR', `[트렌드] 읽기 실패: ${err.message}`, null);
      }
    }

    // 통신이 몇 사이클 연속으로 전부 실패하면(예: 정지 후 재시작 시 USB/소켓이 응답 불능 상태로
    // 굳어버리는 경우) 사용자가 수동으로 하던 "연결 해제 후 재연결"을 자동으로 수행한다.
    if (chunks.length > 0) {
      if (anySuccess) {
        trendState.consecutiveCycleErrors = 0;
        trendState.reconnectAttempts = 0;
      } else {
        trendState.consecutiveCycleErrors += 1;
        if (trendState.consecutiveCycleErrors >= RECONNECT_AFTER_CYCLES && reconnectClient) {
          trendState.consecutiveCycleErrors = 0;
          await tryAutoReconnect();
        }
      }
    }

    // 이번 사이클에 새로 읽은 값만 델타로 보낸다 - index(문자열)를 키로 씀
    const values = {};
    for (const p of plan) {
      if (p.error) {
        values[p.index] = null;
        continue;
      }
      const words = [];
      for (let i = 0; i < p.wordCount; i++) {
        words.push(rawByItemLabel[`${p.index}#${i}`]);
      }
      values[p.index] = decodeValue(p.variable.dataType, words, p.variable.bit);
    }

    const t = Date.now();
    valueHistory.push({ t, values });
    if (valueHistory.length > MAX_HISTORY) valueHistory.shift();
    broadcast({ type: 'trendValues', payload: { t, values } });
  }

  async function loopStep() {
    if (trendState.status !== 'running') return;
    const variables = loadTrendVariables();
    const startedAt = Date.now();
    try {
      await pollOnce(variables);
    } catch (e) {
      pushLog('ERROR', '[트렌드] 폴링 오류: ' + e.message, null);
    }
    if (trendState.status !== 'running') return;
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, trendState.intervalMs - elapsed);
    trendState.timer = setTimeout(loopStep, wait);
  }

  function start(intervalMs) {
    const client = getClient();
    if (!client || !client.connected) {
      throw new Error('PLC에 먼저 연결해야 트렌드 폴링을 시작할 수 있습니다.');
    }
    if (intervalMs) trendState.intervalMs = intervalMs;
    if (trendState.timer) clearTimeout(trendState.timer);
    trendState.status = 'running';
    trendState.reconnectAttempts = 0;
    trendState.lastReconnectAt = 0;
    pushLog('SYSTEM', `[트렌드] 폴링 시작 (주기 ${trendState.intervalMs}ms)`, null);
    broadcast({ type: 'trendStatus', payload: { status: trendState.status, intervalMs: trendState.intervalMs } });
    loopStep();
  }

  function pause() {
    if (trendState.timer) {
      clearTimeout(trendState.timer);
      trendState.timer = null;
    }
    trendState.status = 'paused';
    pushLog('SYSTEM', '[트렌드] 폴링 일시정지', null);
    broadcast({ type: 'trendStatus', payload: { status: trendState.status, intervalMs: trendState.intervalMs } });
  }

  function stop() {
    if (trendState.timer) {
      clearTimeout(trendState.timer);
      trendState.timer = null;
    }
    trendState.status = 'stopped';
    try {
      saveHistoryLogs();
    } catch (err) {
      pushLog('ERROR', '[트렌드] 기록 로그 저장 실패: ' + err.message, null);
    }
    valueHistory = []; // 로그로 남긴 뒤, 서버가 들고 있던 기록도 비운다(클라이언트 버퍼와 동일하게)
    pushLog('SYSTEM', '[트렌드] 폴링 정지', null);
    // 정지 시 프론트가 누적해둔 시계열 버퍼를 비우도록 status로 신호를 준다.
    broadcast({ type: 'trendStatus', payload: { status: trendState.status, intervalMs: trendState.intervalMs } });
  }

  function getStatus() {
    return { status: trendState.status, intervalMs: trendState.intervalMs };
  }

  return { start, pause, stop, getStatus, getValueHistory };
}

module.exports = {
  loadTrendVariables,
  saveTrendVariablesToFile,
  createTrendManager,
  getTrendLogsDir,
  saveSingleSeriesLog,
};
