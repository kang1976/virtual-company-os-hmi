'use strict';

/**
 * NX/NJ 시리즈용 태그 목록 저장/로드. CJ의 변수 목록(gridManager.js의 loadVariables)과 별개로,
 * NX는 영역+주소가 아니라 태그 이름 하나만 있으면 되므로 스키마가 훨씬 단순하다.
 */

const path = require('path');
const fs = require('fs');
const { nowLocalIso } = require('./timeUtils');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const NX_TAGS_FILE = path.join(dataDir, 'nxTags.json');

function loadNxTags() {
  try {
    if (!fs.existsSync(NX_TAGS_FILE)) return [];
    const raw = fs.readFileSync(NX_TAGS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.tags) ? data.tags : [];
  } catch (e) {
    return [];
  }
}

function saveNxTags(tags) {
  fs.writeFileSync(NX_TAGS_FILE, JSON.stringify({ tags, savedAt: nowLocalIso() }, null, 2));
}

module.exports = { loadNxTags, saveNxTags };
