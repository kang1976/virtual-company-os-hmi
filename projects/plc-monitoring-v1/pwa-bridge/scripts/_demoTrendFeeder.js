'use strict';
// 검증용 임시 스크립트 — 데모 시리즈(8,9)에 1초마다 합성 샘플 적재. PLC 없이 트렌드 실시간 갱신 확인용.
// 중지: 이 프로세스 종료. 데이터 정리: 범례의 ✕ 로 시리즈 삭제.
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/app.db');
db.exec('PRAGMA busy_timeout=4000');
const ins = db.prepare('INSERT INTO trend_sample (series_id,ts,value,raw) VALUES (?,?,?,?)');
const ids = db.prepare("SELECT series_id,label FROM trend_series WHERE label LIKE '데모%'").all();
if (!ids.length) { console.error('데모 시리즈 없음'); process.exit(1); }
console.log('feeding', ids.map(x => `${x.series_id}:${x.label}`).join(', '));
let i = 0;
setInterval(() => {
  const t = Date.now();
  const v1 = Math.round(500 + 120 * Math.sin(i / 40) + 20 * Math.sin(i / 7) + (Math.random() * 8 - 4));
  const v2 = Math.round(250 + 40 * Math.sin(i / 95 + 1) + (Math.random() * 4 - 2));
  try {
    ins.run(ids[0].series_id, t, v1, String(v1));
    if (ids[1]) ins.run(ids[1].series_id, t, v2, String(v2));
  } catch (e) { /* WAL 경합 시 다음 tick */ }
  i++;
}, 1000);
