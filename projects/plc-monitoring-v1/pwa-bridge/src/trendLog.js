'use strict';
// 트렌드 로깅 (design.md §9)
// - 시리즈 = 주소 스펙(영역/워드주소/데이터타입/비트) + 표시이름. tags 테이블과 독립.
// - 서버가 1초마다 enabled 시리즈를 읽어 trend_sample에 적재.
// - 72시간(RETENTION_MS) 넘은 샘플은 주기적으로 삭제(rolling window).
// - 차트/내보내기는 저장된 샘플에서 조회. 넓은 창은 버킷 평균으로 다운샘플.

const db = require('./db');
const { readTagValue, wordAreaCode, TYPE_WORDS, normType } = require('./plcRead');

const SAMPLE_INTERVAL_MS = 1000;
const RETENTION_MS = 72 * 60 * 60 * 1000; // 72시간
const MAX_SERIES = 16;
const COLORS = ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c', '#a3e635', '#e879f9', '#4ade80', '#facc15', '#38bdf8', '#fda4af', '#c084fc', '#2dd4bf'];

const listSeriesStmt = db.prepare('SELECT * FROM trend_series ORDER BY series_id');
const getSeriesStmt = db.prepare('SELECT * FROM trend_series WHERE series_id = ?');
const insertSeriesStmt = db.prepare(
  'INSERT INTO trend_series (label, area_type, address, data_type, bit_index, color, enabled) VALUES (@label, @area, @addr, @dtype, @bit, @color, 1)'
);
const deleteSeriesStmt = db.prepare('DELETE FROM trend_series WHERE series_id = ?');
const deleteSamplesOfSeriesStmt = db.prepare('DELETE FROM trend_sample WHERE series_id = ?');
const setEnabledStmt = db.prepare('UPDATE trend_series SET enabled = ? WHERE series_id = ?');
const insertSampleStmt = db.prepare('INSERT INTO trend_sample (series_id, ts, value, raw) VALUES (?, ?, ?, ?)');
const pruneStmt = db.prepare('DELETE FROM trend_sample WHERE ts < ?');
const lastSampleStmt = db.prepare('SELECT ts, value, raw FROM trend_sample WHERE series_id = ? ORDER BY ts DESC LIMIT 1');
const countStmt = db.prepare('SELECT COUNT(*) n FROM trend_sample');
const oldestStmt = db.prepare('SELECT MIN(ts) t FROM trend_sample');

let loggingEnabled = true;

function usedColors() {
  return new Set(listSeriesStmt.all().map((s) => s.color));
}
function nextColor() {
  const used = usedColors();
  return COLORS.find((c) => !used.has(c)) || COLORS[Math.floor(Math.random() * COLORS.length)];
}

function listSeries() {
  return listSeriesStmt.all().map((s) => {
    const last = lastSampleStmt.get(s.series_id);
    return { ...s, last: last || null };
  });
}

function addSeries({ label, areaType, address, dataType, bitIndex }) {
  if (listSeriesStmt.all().length >= MAX_SERIES) {
    throw new Error(`트렌드 시리즈는 최대 ${MAX_SERIES}개까지입니다.`);
  }
  const lbl = String(label || '').trim();
  if (!lbl) throw new Error('표시 이름을 입력하세요.');
  wordAreaCode(areaType); // 유효 영역 검증(D/W/CIO/H/E0/A ...)
  const addrNum = Number(address);
  if (!Number.isInteger(addrNum) || addrNum < 0) throw new Error('워드 주소는 0 이상의 정수여야 합니다.');
  let bit = null;
  if (bitIndex !== '' && bitIndex != null) {
    bit = Number(bitIndex);
    if (!Number.isInteger(bit) || bit < 0 || bit > 15) throw new Error('비트는 0~15 여야 합니다.');
  }
  const dtype = bit != null ? 'BOOL' : normType(dataType || 'UINT');
  if (bit == null && !TYPE_WORDS[dtype]) throw new Error(`지원하지 않는 데이터 타입: ${dataType}`);

  const info = insertSeriesStmt.run({
    label: lbl, area: areaType, addr: String(addrNum), dtype, bit, color: nextColor(),
  });
  return getSeriesStmt.get(info.lastInsertRowid);
}

function removeSeries(id) {
  deleteSamplesOfSeriesStmt.run(id);
  deleteSeriesStmt.run(id);
}

function setSeriesEnabled(id, on) {
  setEnabledStmt.run(on ? 1 : 0, id);
}

function setLogging(on) { loggingEnabled = !!on; }
function isLogging() { return loggingEnabled; }

function status() {
  const series = listSeriesStmt.all();
  return {
    logging: loggingEnabled,
    intervalMs: SAMPLE_INTERVAL_MS,
    retentionHours: RETENTION_MS / 3600000,
    seriesCount: series.length,
    maxSeries: MAX_SERIES,
    sampleCount: countStmt.get().n,
    oldestTs: oldestStmt.get().t || null,
  };
}

/** 1초 tick: enabled 시리즈를 모두 읽어 저장. server.js가 plcClient를 넘겨준다. */
async function tick(plcClient) {
  if (!loggingEnabled || !plcClient || !plcClient.connected) return;
  const series = listSeriesStmt.all().filter((s) => s.enabled);
  if (!series.length) return;
  const ts = Date.now();
  const rows = [];
  for (const s of series) {
    try {
      const r = await readTagValue(
        { symbol: s.label, area_type: s.area_type, address: s.address, data_type: s.data_type, bit_index: s.bit_index },
        plcClient
      );
      const num = typeof r.value === 'number' ? r.value : Number(r.value);
      rows.push([s.series_id, ts, Number.isFinite(num) ? num : null, String(r.value)]);
    } catch {
      rows.push([s.series_id, ts, null, null]);
    }
  }
  db.exec('BEGIN');
  try {
    for (const row of rows) insertSampleStmt.run(row[0], row[1], row[2], row[3]);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function prune() {
  pruneStmt.run(Date.now() - RETENTION_MS);
}

/**
 * 차트용 조회. windowSec 구간을 maxPoints 이하로 버킷 평균 다운샘플.
 * @returns { series: [{series_id,label,color}], points: { [series_id]: [[ts, value], ...] } }
 */
function samples({ windowSec = 300, maxPoints = 600, toMs = 0 }) {
  const now = Date.now();
  const to = toMs && toMs > 0 && toMs <= now ? toMs : now;
  const from = to - windowSec * 1000;
  const bucketMs = Math.max(SAMPLE_INTERVAL_MS, Math.ceil((windowSec * 1000) / maxPoints));
  const series = listSeriesStmt.all();
  const q = db.prepare(`
    SELECT (ts / ${bucketMs}) AS b, AVG(value) AS v, MAX(ts) AS t
    FROM trend_sample
    WHERE series_id = ? AND ts >= ? AND ts <= ? AND value IS NOT NULL
    GROUP BY b ORDER BY b
  `);
  const points = {};
  for (const s of series) {
    points[s.series_id] = q.all(s.series_id, from, to).map((r) => [r.t, r.v]);
  }
  return {
    from, to, now, bucketMs, live: !(toMs && toMs > 0),
    series: series.map((s) => ({ series_id: s.series_id, label: s.label, color: s.color, area_type: s.area_type, address: s.address, data_type: s.data_type, bit_index: s.bit_index })),
    points,
  };
}

function seriesSpec(s) {
  return `${s.area_type}:${s.address}:${s.data_type}${s.bit_index != null ? '.' + s.bit_index : ''}`;
}

/** CSV(와이드) 내보내기 스트림용 행 생성기. from/to epoch ms.
 * 1행: UTF-8 BOM + "# series: label=area:addr:dtype[.bit], ..."  (가져오기 시 주소 스펙 복원용)
 * 2행: timestamp,label1,label2,... */
function* exportCsvRows({ from, to }) {
  const series = listSeriesStmt.all();
  yield '﻿# series: ' + series.map((s) => `${csvMetaCell(s.label)}=${seriesSpec(s)}`).join(', ') + '\n';
  yield 'timestamp,' + series.map((s) => csvCell(s.label)).join(',') + '\n';

  // 초 단위로 묶어서 각 시리즈 값을 한 줄에. 데이터가 많을 수 있어 시간 커서로 순회.
  const rowsStmt = db.prepare(
    'SELECT series_id, ts, value, raw FROM trend_sample WHERE ts >= ? AND ts <= ? ORDER BY ts'
  );
  const idx = new Map(series.map((s, i) => [s.series_id, i]));
  let curSec = null;
  let bucket = new Array(series.length).fill('');
  for (const r of rowsStmt.iterate(from, to)) {
    const sec = Math.floor(r.ts / 1000) * 1000;
    if (curSec === null) curSec = sec;
    if (sec !== curSec) {
      yield isoLocal(curSec) + ',' + bucket.map(csvCell).join(',') + '\n';
      curSec = sec;
      bucket = new Array(series.length).fill('');
    }
    const i = idx.get(r.series_id);
    if (i != null) bucket[i] = r.value != null ? r.value : (r.raw != null ? r.raw : '');
  }
  if (curSec !== null) yield isoLocal(curSec) + ',' + bucket.map(csvCell).join(',') + '\n';
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvMetaCell(v) {
  return String(v ?? '').replace(/[=,]/g, '_');
}

// --- CSV 가져오기 ---
function splitCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const findSeriesByLabelStmt = db.prepare('SELECT * FROM trend_series WHERE label = ?');

/**
 * 이전에 내보낸 와이드 CSV를 다시 적재한다.
 * - "# series:" 메타 줄이 있으면 주소 스펙을 복원, 없으면 (가져옴) 스펙으로 생성.
 * - 새로 만든 시리즈는 enabled=0 (라이브 폴링 안 함, 과거 데이터 표시 전용).
 * - 같은 이름의 시리즈가 이미 있으면 그 시리즈에 샘플을 합침.
 */
function importCsv(text) {
  const raw = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');
  let li = 0;
  const specMap = {};
  while (li < lines.length && lines[li].startsWith('#')) {
    const m = lines[li].match(/^#\s*series:\s*(.*)$/i);
    if (m) {
      for (const part of m[1].split(',')) {
        const eq = part.indexOf('=');
        if (eq > 0) specMap[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
      }
    }
    li++;
  }
  if (li >= lines.length) throw new Error('빈 파일이거나 형식이 올바르지 않습니다.');
  const header = splitCsvLine(lines[li++]);
  if (header.length < 2 || !/timestamp/i.test(header[0])) {
    throw new Error('헤더가 "timestamp,<이름>,..." 형식이 아닙니다.');
  }
  const labels = header.slice(1);

  // 라벨 → series_id (없으면 생성)
  const ids = labels.map((label) => {
    const existing = findSeriesByLabelStmt.get(label);
    if (existing) return existing.series_id;
    let area = '(가져옴)', addr = '0', dtype = 'UINT', bit = null;
    const spec = specMap[label] || specMap[csvMetaCell(label)];
    if (spec) {
      const mm = spec.match(/^([^:]+):(\d+):([A-Za-z0-9_]+)(?:\.(\d+))?$/);
      if (mm) { area = mm[1]; addr = mm[2]; dtype = mm[3]; bit = mm[4] != null ? Number(mm[4]) : null; }
    }
    const info = db.prepare(
      'INSERT INTO trend_series (label, area_type, address, data_type, bit_index, color, enabled) VALUES (?,?,?,?,?,?,0)'
    ).run(label, area, addr, dtype, bit, nextColor());
    return info.lastInsertRowid;
  });

  let n = 0;
  db.exec('BEGIN');
  try {
    for (; li < lines.length; li++) {
      const line = lines[li];
      if (!line.trim()) continue;
      const cols = splitCsvLine(line);
      const t = Date.parse(cols[0].replace(' ', 'T'));
      if (!Number.isFinite(t)) continue;
      for (let c = 1; c < cols.length && c - 1 < ids.length; c++) {
        const cell = cols[c];
        if (cell === '' || cell == null) continue;
        const num = Number(cell);
        insertSampleStmt.run(ids[c - 1], t, Number.isFinite(num) ? num : null, cell);
        n++;
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { importedSamples: n, series: labels.length };
}
function isoLocal(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

module.exports = {
  SAMPLE_INTERVAL_MS, RETENTION_MS, MAX_SERIES,
  listSeries, addSeries, removeSeries, setSeriesEnabled,
  setLogging, isLogging, status, tick, prune, samples, exportCsvRows, importCsv,
};
