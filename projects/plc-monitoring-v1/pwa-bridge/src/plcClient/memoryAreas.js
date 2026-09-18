'use strict';

/**
 * PLC 메모리 영역 목록/크기 정보. 순수 데이터 + 헬퍼 함수만 있고 FINS 통신은 하지 않는다.
 *
 * ⚠️ 워드 개수는 Omron CS/CJ 시리즈 표준 스펙 기준 가정치다(D=32768, H=512, W=512, CIO=6144,
 * EM 뱅크=뱅크당 32768). CJ2H가 이 표준과 다른 부분이 있으면 실기 테스트 중 범위 끝 주소에서
 * PLC가 에러를 반환할 것이므로, 그때 아래 상수만 조정하면 된다.
 */

const AREA_WORD_COUNTS = { D: 32768, H: 512, W: 512, CIO: 6144 };
const EM_BANK_WORD_COUNT = 32768;
const DEFAULT_EM_BANKS = 4; // CPU 모델을 모를 때 폴백 (기존 E0~E3 동작과 동일)

// docs/PROJECT_SUMMARY_AND_PROTOCOL.md 4-7 "CJ2H-CPU6@-EIP 모델별 EM 뱅크 개수" 표 그대로
const CPU_EM_BANKS = {
  'CJ2H-CPU64-EIP': 4,
  'CJ2H-CPU65-EIP': 4,
  'CJ2H-CPU66-EIP': 10,
  'CJ2H-CPU67-EIP': 15,
  'CJ2H-CPU68-EIP': 25,
};

/**
 * 모델별 공식 프로그램 용량(steps). Omron 공식 스펙 페이지에서 확인한 값(2026-07-16 검색 확인):
 * https://www.ia.omron.com/products/family/1993/specification.html
 * https://automation.omron.com/en/us/products/family/CJ2CPU/cj2h-cpu65-eip
 * (FINS 05 01 응답의 프로그램 영역 raw 필드는 이 값과 정수배로 딱 맞아떨어지지 않아 - 예를 들어
 *  CPU65 실측 raw=200, 공식 스펙=100,000steps로 배율이 500이라는 애매한 값 - 그 필드를 그대로
 *  "K steps"로 표시하지 않고, 알려진 모델은 이 표의 공식값을 우선 사용한다.)
 */
const CPU_PROGRAM_CAPACITY_STEPS = {
  'CJ2H-CPU64-EIP': 50000,
  'CJ2H-CPU65-EIP': 100000,
  'CJ2H-CPU66-EIP': 150000,
  'CJ2H-CPU67-EIP': 250000,
  'CJ2H-CPU68-EIP': 400000,
};

/** CPU 모델 문자열(예: "CJ2H-CPU65-EIP")로부터 EM 뱅크 개수를 찾는다. 모르면 기본값(4) 반환 */
function emBankCountFor(cpuModel) {
  if (!cpuModel) return DEFAULT_EM_BANKS;
  const upper = String(cpuModel).toUpperCase();
  const key = Object.keys(CPU_EM_BANKS).find((k) => upper.includes(k));
  return key ? CPU_EM_BANKS[key] : DEFAULT_EM_BANKS;
}

/** CPU 모델 문자열로부터 공식 프로그램 용량(steps)을 찾는다. 표에 없는 모델이면 null. */
function programCapacityStepsFor(cpuModel) {
  if (!cpuModel) return null;
  const upper = String(cpuModel).toUpperCase();
  const key = Object.keys(CPU_PROGRAM_CAPACITY_STEPS).find((k) => upper.includes(k));
  return key ? CPU_PROGRAM_CAPACITY_STEPS[key] : null;
}

/**
 * 접속된 CPU 모델에 따른 전체 영역 목록을 반환한다.
 * @param {string|null} cpuModel
 * @returns {Array<{key: string, label: string, maxWords: number}>}
 */
function getAreaList(cpuModel) {
  const banks = emBankCountFor(cpuModel);
  return [
    { key: 'D', label: 'D (DM)', maxWords: AREA_WORD_COUNTS.D },
    { key: 'H', label: 'H (Holding)', maxWords: AREA_WORD_COUNTS.H },
    { key: 'W', label: 'W (Work)', maxWords: AREA_WORD_COUNTS.W },
    { key: 'CIO', label: 'CIO', maxWords: AREA_WORD_COUNTS.CIO },
    ...Array.from({ length: banks }, (_, i) => ({
      key: `E${i}`,
      label: `E${i}`,
      maxWords: EM_BANK_WORD_COUNT,
    })),
  ];
}

module.exports = {
  AREA_WORD_COUNTS,
  EM_BANK_WORD_COUNT,
  CPU_EM_BANKS,
  CPU_PROGRAM_CAPACITY_STEPS,
  DEFAULT_EM_BANKS,
  emBankCountFor,
  programCapacityStepsFor,
  getAreaList,
};
