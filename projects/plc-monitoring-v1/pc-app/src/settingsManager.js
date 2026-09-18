'use strict';

/**
 * 앱 전역 설정(설정 페이지에서 편집)을 data/settings.json 한 파일로 관리한다.
 * - 서버가 필요로 하는 값(파일명 접두사/스냅샷 폴더/재연결/리포트 로고·제목)은 서버가 직접 참조하고,
 * - 클라이언트가 필요로 하는 값(테마/폰트/화면배율/연결 폼 기본값)은 /api/settings로 내려보내
 *   각 페이지의 appSettings.js가 적용한다.
 * 저장된 파일이 없거나 일부 키가 빠져 있어도 항상 기본값과 병합해서 완전한 객체를 돌려준다.
 */

const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const SETTINGS_FILE = path.join(dataDir, 'settings.json');

// 회사 로고는 용량이 커질 수 있어 settings.json 본문이 아니라 별도 파일로 저장한다.
const logoFile = path.join(dataDir, 'company-logo.bin');
const logoMetaKey = 'report.companyLogoMime';

function defaultSettings() {
  return {
    general: {
      variablesDir: '', // 변수 목록 파일(.xlsx) 불러오기/저장 기본 폴더 (서버 경로)
      snapshotDir: '', // CSV·트렌드 로그 저장 폴더 (비우면 앱 기본 logs/ 사용)
      filePrefix: 'SNAP', // 저장 파일명 접두사 → {접두사}_{타임스탬프}.xlsx/csv
    },
    connection: {
      defaultSeries: 'CJ', // CJ | NX
      finsProtocol: 'UDP', // USB | UDP | TCP
      finsNode: 'auto', // 'auto' 또는 0~255
      defaultIp: '192.168.1.10',
      cjPortMode: 'default', // default | custom
      cjPort: 9600,
      njPortMode: 'default',
      njPort: 44818,
      reconnectIntervalSec: 5, // 자동 재연결 시도 간격(초)
      maxRetries: 10, // 자동 재연결 최대 시도 횟수 (0 = 무제한)
    },
    report: {
      companyLogo: '', // data URL (클라이언트 미리보기용). 서버는 company-logo.bin을 사용
      companyLogoMime: '', // 예: image/png
      pdfTitlePrefix: 'OPVScope_',
    },
    display: {
      tableFontSize: 13, // px
    },
    theme: {
      base: 'light', // light | dark | orange | custom
      // base가 'custom'일 때, 아래에서 지정한 CSS 변수만 덮어쓰고 나머지는 customFallback을 따른다.
      customFallback: 'light', // custom 테마의 바탕(빠진 색은 이 테마에서 가져옴)
      custom: {
        // 비어 있으면 customFallback 값 사용. 키 = CSS 변수명(-- 제외)
        // 예: accent, bg, panel, text, muted, 'accent-dim', warn, error, 'input-bg', 'bg-alt'
      },
    },
    zoom: 1.0, // 화면 기본 배율(Ctrl+휠로 조절하는 값과 동일)
  };
}

/** 깊은 병합(기본값 위에 저장값을 얹음). 배열/원시값은 저장값이 있으면 그대로 사용. */
function deepMerge(base, override) {
  if (override === null || override === undefined) return base;
  if (typeof base !== 'object' || Array.isArray(base) || typeof override !== 'object' || Array.isArray(override)) {
    return override;
  }
  const out = { ...base };
  for (const key of Object.keys(override)) {
    out[key] = key in base ? deepMerge(base[key], override[key]) : override[key];
  }
  return out;
}

function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return defaultSettings();
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const saved = JSON.parse(raw);
    return deepMerge(defaultSettings(), saved);
  } catch (e) {
    return defaultSettings();
  }
}

/**
 * 설정 저장. 로고 data URL은 본문에서 분리해 별도 파일로 저장하고, settings.json에는
 * MIME 타입만 남긴다(본문이 매번 통째로 오가지 않게). companyLogo가 빈 문자열이면 로고 삭제.
 */
function saveSettings(incoming) {
  const merged = deepMerge(defaultSettings(), incoming || {});

  const logoDataUrl = merged.report && merged.report.companyLogo;
  if (typeof logoDataUrl === 'string' && logoDataUrl.startsWith('data:')) {
    const m = logoDataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (m) {
      fs.writeFileSync(logoFile, Buffer.from(m[2], 'base64'));
      merged.report.companyLogoMime = m[1];
    }
  } else if (logoDataUrl === '' ) {
    // 로고 제거
    try { if (fs.existsSync(logoFile)) fs.unlinkSync(logoFile); } catch (e) { /* ignore */ }
    merged.report.companyLogoMime = '';
  }
  // settings.json 본문에는 큰 data URL을 저장하지 않는다(파일로 분리됨).
  const toStore = deepMerge(merged, { report: { companyLogo: '' } });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toStore, null, 2));
  return merged;
}

function resetSettings() {
  try { if (fs.existsSync(SETTINGS_FILE)) fs.unlinkSync(SETTINGS_FILE); } catch (e) { /* ignore */ }
  try { if (fs.existsSync(logoFile)) fs.unlinkSync(logoFile); } catch (e) { /* ignore */ }
  return defaultSettings();
}

/** 저장된 회사 로고를 { buffer, mime }로 반환(없으면 null). PDF 내보내기/미리보기에서 사용. */
function loadLogo() {
  try {
    if (!fs.existsSync(logoFile)) return null;
    const settings = loadSettings();
    const mime = (settings.report && settings.report.companyLogoMime) || 'image/png';
    return { buffer: fs.readFileSync(logoFile), mime };
  } catch (e) {
    return null;
  }
}

/** 설정된 스냅샷 폴더(있으면 생성 후 반환), 없으면 fallbackDir을 반환. */
function resolveSnapshotDir(fallbackDir) {
  const settings = loadSettings();
  const dir = settings.general && settings.general.snapshotDir && settings.general.snapshotDir.trim();
  if (!dir) return fallbackDir;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (e) {
    return fallbackDir; // 경로가 잘못되면 조용히 기본 폴더로
  }
}

/** 파일명 접두사(설정값, 없으면 defaultPrefix). 파일명에 못 쓰는 문자는 제거. */
function filePrefix(defaultPrefix) {
  const settings = loadSettings();
  const p = settings.general && settings.general.filePrefix;
  const cleaned = String(p === undefined || p === null ? '' : p).replace(/[\\/:*?"<>|]/g, '').trim();
  return cleaned || defaultPrefix || 'SNAP';
}

/** 자동 재연결 정책 { intervalMs, maxRetries }. 폴링 루프의 자동 복구가 이 값을 참조한다. */
function reconnectPolicy() {
  const c = loadSettings().connection || {};
  const intervalSec = Number(c.reconnectIntervalSec);
  const maxRetries = Number(c.maxRetries);
  return {
    intervalMs: Number.isFinite(intervalSec) && intervalSec >= 0 ? intervalSec * 1000 : 5000,
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 10, // 0 = 무제한
  };
}

module.exports = {
  defaultSettings,
  loadSettings,
  saveSettings,
  resetSettings,
  loadLogo,
  resolveSnapshotDir,
  filePrefix,
  reconnectPolicy,
  logoMetaKey,
};
