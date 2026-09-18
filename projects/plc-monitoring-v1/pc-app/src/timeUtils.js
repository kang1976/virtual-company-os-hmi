'use strict';

/**
 * 이 프로젝트는 한국 단일 사업장에서만 쓰이는 로컬 앱인데, 지금까지 DB/작업이력/파일
 * 타임스탬프를 전부 new Date().toISOString()(항상 UTC, 'Z' 표기)로 남겨왔다 - 그 결과
 * 작업이력 화면/엑셀에 찍히는 시각이 실제 PC 시계보다 9시간 느리게 보였다(사용자 지적 -
 * "컴퓨터 시간과 동기화한 시간을 찍었으면 합니다", "전체 프로젝트 시간 부분 수정조치").
 *
 * Date 객체의 로컬 게터(getFullYear/getHours 등)는 이 프로세스가 도는 PC의 OS 시간대를
 * 그대로 따른다 - 한국 시간대로 맞춰진 PC에서는 이게 곧 한국 시간이므로, UTC로 변환하지
 * 않고 로컬 게터 값을 그대로 이어붙여서 "PC 시계가 가리키는 순간"을 기록한다. 접미사는
 * 한국은 DST가 없어 항상 고정이므로 "+09:00"로 리터럴 표기한다.
 */

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

/** 임의의 Date를 'YYYY-MM-DDTHH:mm:ss.sss+09:00' 형식으로 - 로컬 게터만 쓰므로 UTC 변환이
    전혀 없다. work_log.ts 등 TEXT 컬럼에 저장되는 값과 형식이 같아야 부등호 비교(from/to
    범위 필터)가 사전순 = 시간순으로 맞게 정렬된다. */
function formatLocalIso(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}+09:00`;
}

/** "지금 이 순간"을 formatLocalIso로 - DB/JSON savedAt 등 대부분의 호출부가 쓰는 형태. */
function nowLocalIso() {
  return formatLocalIso(new Date());
}

/** 파일명에 쓸 수 있게 콜론/마침표를 "-"로 바꾼 버전(Windows 파일명에 ':'를 못 씀). */
function nowLocalStamp() {
  return nowLocalIso().replace(/[:.]/g, '-');
}

module.exports = { formatLocalIso, nowLocalIso, nowLocalStamp };
