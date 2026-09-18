'use strict';
// Design Ref: docs/01-plan/schema.md §2-2 — 심볼 우선 대량 가져오기(Import) 파이프라인
// 매핑표(심볼→실제주소)가 아직 없으므로, address/area_type/bit_index는 없어도 되고
// 나중에 같은 symbol로 다시 import하면 값만 채워짐(soft-merge, 사람이 수동 조정한 risk_level은 덮어쓰지 않음)

const crypto = require('crypto');
const db = require('./db');

const findBySymbolStmt = db.prepare('SELECT * FROM tags WHERE symbol = ?');
const insertStmt = db.prepare(`
  INSERT INTO tags (tag_id, symbol, name, address, bit_index, area_type, data_type, access, description, risk_level, source)
  VALUES (@tagId, @symbol, @name, @address, @bitIndex, @areaType, @dataType, @access, @description, @riskLevel, 'import')
`);
const updateAddressStmt = db.prepare(`
  UPDATE tags SET address=@address, bit_index=@bitIndex, area_type=@areaType, data_type=@dataType,
    name=COALESCE(@name, name), description=COALESCE(@description, description), updated_at=datetime('now')
  WHERE tag_id=@tagId
`);

/**
 * @param {Array<object>} records 각 항목: { symbol, name?, address?, bitIndex?, areaType?, dataType?, access, description? }
 *   access: 'read' | 'write' | 'read_write' — 필수(안전등급 기본값 결정에 사용)
 * @returns {{inserted:number, updated:number, skipped:number}}
 */
function importTags(records) {
  let inserted = 0, updated = 0, skipped = 0;

  // node:sqlite의 DatabaseSync에는 better-sqlite3식 db.transaction() 헬퍼가 없어 수동으로 처리
  db.exec('BEGIN');
  try {
    for (const r of records) {
      if (!r.symbol || !r.access) { skipped++; continue; }

      const existing = findBySymbolStmt.get(r.symbol);
      if (existing) {
        // 주소/설명만 갱신, risk_level 등 사람이 수동 조정했을 값은 건드리지 않음
        updateAddressStmt.run({
          tagId: existing.tag_id,
          address: r.address ?? null,
          bitIndex: r.bitIndex ?? null,
          areaType: r.areaType ?? null,
          dataType: r.dataType ?? null,
          name: r.name ?? null,
          description: r.description ?? null,
        });
        updated++;
        continue;
      }

      insertStmt.run({
        tagId: 'tag_' + crypto.randomUUID(),
        symbol: r.symbol,
        name: r.name ?? null,
        address: r.address ?? null,
        bitIndex: r.bitIndex ?? null,
        areaType: r.areaType ?? null,
        dataType: r.dataType ?? null,
        access: r.access,
        description: r.description ?? null,
        // Design Ref: schema.md §2-1 — 쓰기 가능한 태그는 기본 caution, 읽기 전용은 safe(쓰기 자체가 없으므로)
        riskLevel: r.access === 'read' ? 'safe' : 'caution',
      });
      inserted++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { inserted, updated, skipped };
}

module.exports = { importTags };
