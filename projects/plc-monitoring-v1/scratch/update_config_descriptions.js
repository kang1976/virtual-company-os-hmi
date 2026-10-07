const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/gmsSubSequenceConfig.json');
const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 44개 설정값별 상세 설명 생성 함수
function generateDetailedDescription(row) {
  const side = row.side;
  const otherSide = side === 'A' ? 'B' : 'A';
  
  switch (row.id) {
    case 'vacuumLowerLimit_A':
    case 'vacuumLowerLimit_B':
      return `[적용 공정] Main 3(OneP), Main 4(OneP2), Main 6(OneP4), Main 8(TwoP), Main 12(AfterThreeP), Main 13(AfterPlusL), Main 15(AfterFourP), Main 16(AdjustMode) 배관 진공 형성 스텝 | [판정 기준] VPT & LPT_${side} & HPT_${side} & NPT_${side} <= 설정값(PSI) (진공 도달 시 통과) | [알람/분기] 미달(진공 불량) 시 Alarm Seq 1 발동(전체 밸브 CLOSE 및 초기화 알람).`;

    case 'n2SupplyLowerLimit_A':
    case 'n2SupplyLowerLimit_B':
      return `[적용 공정] Main 3(OneP), Main 4(OneP2), Main 6(OneP4), Main 8(TwoP), Main 12(AfterThreeP), Main 15(AfterFourP), Main 16(AdjustMode) 질소공급 확인 스텝 | [판정 기준] NPT_${side} & HPT_${side} >= 설정값(PSI) (질소 압력 충족 시 통과) | [알람/분기] 미달(질소 부족) 시 Alarm Seq 1 발동(공정 중단 및 알람 발생).`;

    case 'postExchangeFirstPurgeCount_A':
    case 'postExchangeFirstPurgeCount_B':
      return `[적용 공정] Main 12(AfterThreeP_v1) 교환 후 1차 배관청소 스텝(Step 17) | [판정 기준] 진행횟수 >= 설정값(회) 만족 시 배관청소 완료(다음 공정 이동) | [알람/분기] 미도달 시 Step 2로 Alarm Goto(반복 진행). 설정 횟수 초과 시 Alarm Seq 1 알람.`;

    case 'postExchangeSecondPurgeCount_A':
    case 'postExchangeSecondPurgeCount_B':
      return `[적용 공정] Main 15(AfterFourP_v1) 교환 후 2차 배관청소 스텝(Step 17) | [판정 기준] 진행횟수 >= 설정값(회) 만족 시 퍼지 완료(공정 종료) | [알람/분기] 미도달 시 Step 2로 Alarm Goto(반복 진행). 설정 횟수 초과 시 Alarm Seq 1 알람.`;

    case 'pressureTestStabilizeTime_A':
    case 'pressureTestStabilizeTime_B':
      return `[적용 공정] Main 13(AfterPlusL_v1) 교환 후 +L 가압시험 1단계(압력 안정화 구간, Step 6A) | [판정 기준] 진행시간(분) >= 설정값(분) 도달 시 본 가압시험 단계로 진입 | [알람/분기] 시간 미달 시 60초마다 Step 6으로 Alarm Goto(안전감시 유지 반복). 안전압력 이탈 시 Alarm Seq 1 즉시 셧다운.`;

    case 'pressureTestTime_A':
    case 'pressureTestTime_B':
      return `[적용 공정] Main 13(AfterPlusL_v1) 교환 후 +L 가압시험 2단계(본 가압시험 구간, Step 7A) | [판정 기준] 진행시간(분) >= 설정값(분) 도달 시 가압시험 완료 판정으로 이동 | [알람/분기] 시간 미달 시 60초마다 Step 7로 Alarm Goto(반복 유지). 시험 중 압력 강하 발생 시 Alarm Seq 1 즉시 알람.`;

    case 'pressureTestLowerLimit_A':
    case 'pressureTestLowerLimit_B':
      return `[적용 공정] Main 13(AfterPlusL_v1) +L 가압시험 질소 충전 스텝(Step 4) | [판정 기준] HPT_${side} >= 설정값(PSI) (최소 가압 압력 충족 시 다음 스텝) | [알람/분기] 미도달(압력 부족) 시 Alarm Seq 1 발동(가압 불량 알람 및 밸브 CLOSE).`;

    case 'pressureTestUpperLimit_A':
    case 'pressureTestUpperLimit_B':
      return `[적용 공정] Main 13(AfterPlusL_v1) +L 가압시험 과압 방지 안전감시 스텝(Step 5) | [판정 기준] HPT_${side} <= 설정값(PSI) (정상 안전 압력 범위 유지) | [알람/분기] 초과(과압 위험) 시 Alarm Seq 1 발동(긴급 밸브 차단 및 과압 알람).`;

    case 'vtPumpingTime_A':
    case 'vtPumpingTime_B':
      return `[적용 공정] Main 9(VtTest_v1) 및 Main 14(AfterVtTest_v1) VT 1단계 Process Pumping(Step 5) | [판정 기준] 진행시간(분) >= 설정값(분) 도달 시 2단계(1/2차 Pumping)로 진입 | [알람/분기] 시간 미달 시 60초마다 Step 5로 Alarm Goto(반복). 진공 이상 시 Alarm Seq 1 알람.`;

    case 'vtHalfPumpingTime_A':
    case 'vtHalfPumpingTime_B':
      return `[적용 공정] Main 9(VtTest_v1) 및 Main 14(AfterVtTest_v1) VT 2단계 1/2차측 Pumping(Step 13) | [판정 기준] 진행시간(분) >= 설정값(분) 도달 시 진공도 판정 스텝(Step 15)으로 이동 | [알람/분기] 시간 미달 시 60초마다 Step 13으로 Alarm Goto(반복).`;

    case 'vtTestTime_A':
    case 'vtTestTime_B':
      return `[적용 공정] Main 9(VtTest_v1) 및 Main 14(AfterVtTest_v1) VT 3단계 VT 점검/누출시험(Step 22) | [판정 기준] 진행시간(분) >= 설정값(분) 도달 시 최종 누출량 판정 스텝(Step 23)으로 이동 | [알람/분기] 시간 미달 시 60초마다 Step 22로 Alarm Goto(반복 유지).`;

    case 'vtTestVacuumLimit_A':
    case 'vtTestVacuumLimit_B':
      return `[적용 공정] Main 9(VtTest_v1) 및 Main 14(AfterVtTest_v1) 최종 VT 누출 판정(Step 23) | [판정 기준] VT_${side}:CAPOFFSET < 설정값(Torr) (캡처 초기값 대비 변동폭이 기준 미만이면 합격) | [알람/분기] 초과(누출 발생) 시 Alarm Seq 1 발동(누출 불합격 알람 발생).`;

    case 'vtTestVacuumUpperLimit_A':
    case 'vtTestVacuumUpperLimit_B':
      return `[적용 공정] Main 9(VtTest_v1) 및 Main 14(AfterVtTest_v1) VT 2단계 완료 진공도 확인(Step 15) | [판정 기준] VT_${side} < 설정값(Torr) (고진공 도달 시 3단계 누출시험 진입) | [알람/분기] 미도달(진공 미달) 시 Alarm Seq 1 발동(진공 불량 알람 발생).`;

    case 'pulseVentSetCount_A':
    case 'pulseVentSetCount_B':
      return `[적용 공정] Main 2(Puls_v1 Step 7A/7B), Main 13(AfterPlusL_v1 Step 22A/22B) Pulse Vent 반복 스텝 | [판정 기준] 진행횟수 >= 설정값(회) 도달 시 Pulse Vent 종료 | [알람/분기] 미도달 시 Step 2(또는 17)로 Alarm Goto(반복 벤팅). 잔류압 미제거 상태로 설정횟수 초과 시 Alarm Seq 1 알람.`;

    case 'pulseVentStopPsi_A':
    case 'pulseVentStopPsi_B':
      return `[적용 공정] Main 2(Puls_v1 Step 7), Main 13(AfterPlusL_v1 Step 22) 잔류가스 배출 확인 스텝 | [판정 기준] HPT_${side} <= 설정값(PSI) 도달 시 잔류가스 배출 완료로 보고 다음 공정 직행(Next Step) | [알람/분기] 미도달(압력 잔류) 시 Step 7A로 Alarm Goto(Pulse Vent 반복 진입).`;

    case 'preExchangeSecondPurgeSetCount_A':
    case 'preExchangeSecondPurgeSetCount_B':
      return `[적용 공정] Main 4(OneP2_v1 Step 22), Main 11(Bypass_v1 Step 22) 2차측 Purge 반복 스텝 | [판정 기준] 진행횟수 >= 설정값(회) 도달 시 2차측 퍼지 완료(Next Step) | [알람/분기] 미도달 시 Step 2로 Alarm Goto(퍼지 반복 사이클).`;

    case 'pumpingTimeMinutes_A':
    case 'pumpingTimeMinutes_B':
      return `[적용 공정] Main 5(OneP3_v1 Step 7A) 1P Pumping 시간 반복 스텝 | [판정 기준] 진행시간(분) >= 설정값(분) 도달 시 Pumping 공정 완료(Step 8 진입) | [알람/분기] 미도달 시 60초마다 Step 7로 Alarm Goto(펌핑 유지 반복). 안전압력 이탈 시 Alarm Seq 1 즉시 셧다운.`;

    case 'preExchangeFirstPurgeSetCount_A':
    case 'preExchangeFirstPurgeSetCount_B':
      return `[적용 공정] Main 6(OneP4_v1 Step 17) 1차측 Purge 반복 스텝 | [판정 기준] 진행횟수 >= 설정값(회) 도달 시 1차측 퍼지 완료(Next Step 20) | [알람/분기] 미도달 시 Step 2로 Alarm Goto(퍼지 반복 사이클).`;

    case 'preExchangeSecondPurgeProgressCount_A':
    case 'preExchangeSecondPurgeProgressCount_B':
      return `[적용 공정] Main 8(TwoP_v1 Step 17) 교환 전 2차 배관청소(2P) 반복 스텝 | [판정 기준] 진행횟수 >= 설정값(회) 도달 시 2P 청소 완료(Next Step 20) | [알람/분기] 미도달 시 Step 2로 Alarm Goto(2P 배관청소 반복).`;

    case 'exchLStabilizeTimeMinutes_A':
    case 'exchLStabilizeTimeMinutes_B':
      return `[적용 공정] Main 7(ExchL_v1 Step 6A) 교환 전 -L 감압시험 1단계(안정화 구간) | [판정 기준] 진행시간(분) >= 설정값(분) 도달 시 2단계(감압 본시험 Step 7) 진입 | [알람/분기] 미도달 시 60초마다 Step 6으로 Alarm Goto(감압 유지). 진공 누출 시 Alarm Seq 1 알람.`;

    case 'exchLTestTimeMinutes_A':
    case 'exchLTestTimeMinutes_B':
      return `[적용 공정] Main 7(ExchL_v1 Step 7A) 교환 전 -L 감압시험 2단계(본시험 구간) | [판정 기준] 진행시간(분) >= 설정값(분) 도달 시 -L 감압시험 합격 완료(Step 8 진입) | [알람/분기] 미도달 시 60초마다 Step 7로 Alarm Goto(시험 유지). 진공 상승(누출) 시 Alarm Seq 1 즉시 알람.`;

    case 'bypassVacuumHoldCheckTimeMinutes_A':
    case 'bypassVacuumHoldCheckTimeMinutes_B':
      return `[적용 공정] Main 11(Bypass_v1 Step 30A/32A) By-pass 라인 NPT/HPT 진공유지 확인 스텝 | [판정 기준] 진행시간(분) >= 설정값(분) 도달 시 진공유지 확인 완료(다음 스텝 이동) | [알람/분기] 미도달 시 60초마다 Step 30/32로 Alarm Goto(진공감시 반복).`;

    default:
      return row.desc;
  }
}

configData.rows.forEach(row => {
  row.desc = generateDetailedDescription(row);
});

fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
console.log('Successfully updated all 44 config descriptions with detailed engineering specifications!');
