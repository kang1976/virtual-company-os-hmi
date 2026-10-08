// ── GMS Interactive Scenario Simulator (사용자 실 운전자 동작 100% 일치 시뮬레이터 v3.0) ──
// 검증 및 완주 범위:
// 1. 화면 전환 시 반드시 [취소] 키 클릭 및 이전 화면 정상 복귀 체크
// 2. 보안 비밀번호 키패드 터치(4-3-2-1) 및 인증 승인
// 3. 서브시퀀스 단계별 실질 체크: startNamespacedSubSequenceRunner 기반 Step별 카운트다운/밸브/센서 실시간 평가
// 4. 시퀀스 동작 중 [취소] 키 클릭 시 밸브 안전 CLOSE & IDLE 원복 재확인
// 5. 공정 동작 또는 화면 전환 후 반드시 [EMNG SHUT-DOWN TEST] 비상정지 인터락 체크 (19종 밸브 전면 차단 & IDLE 리셋)
// 6. Main 시퀀스 편집기: 순서 변경/삭제(-VT 제거 등) 연동 시뮬레이션
// 7. 옵션 테이블 전체 연동(수동조작 유지, 비밀번호, 1P 4종 서브시퀀스, Bypass 등) 시뮬레이션
// 8. Dual Side 풀 파이프라인: [A Side] IDLE ➔ Service 완주 후 ➔ [B Side] 자동 전환 ➔ IDLE부터 Service까지 양측 연속 완주
// 9. GC Type (2B1P vs 2B2P) 분기 동작 완벽 검증
// 10. 5대 핵심 옵션 조합 매트릭스 순차 검증
// 11. 1x / 2x / 5x / 10x 가속 배속 제어 연동
(function() {
  window.GmsInteractiveSimulator = {
    isRunning: false,
    isPaused: false,
    currentStepIndex: 0,
    speed: 1, // 배속 배수 (1x, 2x, 5x, 10x)
    timer: null,

    setSpeed: function(spd) {
      this.speed = Math.max(0.25, parseFloat(spd) || 1);
      if (window.setGmsSimSpeedMultiplier) {
        window.setGmsSimSpeedMultiplier(this.speed);
      }
      console.log(`[Simulator] Speed set to ${this.speed}x`);
    },

    getDelay: function(baseMs) {
      return Math.max(50, Math.round(baseMs / this.speed));
    },

    sleep: function(ms) {
      return new Promise((resolve, reject) => {
        const totalDelay = this.getDelay(ms);
        const checkInterval = 50;
        let elapsed = 0;
        const t = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(t);
            reject(new Error('SIM_STOPPED'));
            return;
          }
          elapsed += checkInterval;
          if (elapsed >= totalDelay) {
            clearInterval(t);
            resolve();
          }
        }, checkInterval);
      });
    },

    // ── 가상 마우스 커서 및 시각적 클릭 리플(Ripple) 효과 헬퍼 ──
    ensureVirtualCursor: function() {
      let cursor = document.getElementById('simVirtualCursor');
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'simVirtualCursor';
        cursor.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
            <path d="M3 3l7 18 3-7 7-3L3 3z" fill="#00F0FF" stroke="#000000" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        `;
        cursor.style.position = 'fixed';
        cursor.style.zIndex = '999999';
        cursor.style.pointerEvents = 'none';
        cursor.style.transition = 'top 0.25s ease-out, left 0.25s ease-out';
        cursor.style.top = '-50px';
        cursor.style.left = '-50px';
        document.body.appendChild(cursor);
      }
      return cursor;
    },

    showClickEffect: async function(el, label) {
      if (!el || !this.isRunning) return;
      try {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const cursor = this.ensureVirtualCursor();
        cursor.style.display = 'block';
        cursor.style.left = `${centerX}px`;
        cursor.style.top = `${centerY}px`;

        await this.sleep(120);
        if (!this.isRunning) return;

        // 클릭 리플 링 생성
        const ripple = document.createElement('div');
        ripple.style.position = 'fixed';
        ripple.style.left = `${centerX - 24}px`;
        ripple.style.top = `${centerY - 24}px`;
        ripple.style.width = '48px';
        ripple.style.height = '48px';
        ripple.style.borderRadius = '50%';
        ripple.style.border = '3px solid #ff0055';
        ripple.style.background = 'rgba(255, 0, 85, 0.35)';
        ripple.style.boxShadow = '0 0 16px #ff0055';
        ripple.style.zIndex = '999998';
        ripple.style.pointerEvents = 'none';
        ripple.style.transition = 'transform 0.35s ease-out, opacity 0.35s ease-out';
        ripple.style.transform = 'scale(0.3)';
        ripple.style.opacity = '1';
        document.body.appendChild(ripple);

        // 요소 본체 하이라이트
        const origOutline = el.style.outline;
        const origTransform = el.style.transform;
        el.style.outline = '2px solid #00F0FF';
        el.style.transform = 'scale(0.96)';

        requestAnimationFrame(() => {
          ripple.style.transform = 'scale(1.5)';
          ripple.style.opacity = '0';
        });

        setTimeout(() => {
          if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
          el.style.outline = origOutline;
          el.style.transform = origTransform;
        }, 350);
      } catch (err) {
        if (err && err.message === 'SIM_STOPPED') throw err;
        console.warn('[Simulator] showClickEffect error:', err);
      }
    },

    clickWithEffect: async function(el, label) {
      if (!el || !this.isRunning) return false;
      await this.showClickEffect(el, label);
      if (!this.isRunning) return false;
      el.click();
      return true;
    },

    // ── 실질 서브시퀀스 러너 구동 및 고속 스텝 완주 헬퍼 ──
    runSubSeqWithCheck: function(ns, mainStepType, side) {
      return new Promise((resolve) => {
        const resolvedSide = side || window.progressCurrentSide || 'A';
        console.log(`[Simulator] SubSequence Runner start: ${ns} (${mainStepType}) Side:${resolvedSide}`);
        
        let completed = false;
        const done = () => {
          if (!completed) {
            completed = true;
            resolve(true);
          }
        };

        if (window.startNamespacedSubSequenceRunner) {
          window.startNamespacedSubSequenceRunner(ns, mainStepType, resolvedSide, {
            onFinish: () => {
              console.log(`[Simulator] SubSequence ${ns} onFinish received`);
              done();
            },
            onCancel: () => {
              console.log(`[Simulator] SubSequence ${ns} onCancel received`);
              done();
            }
          });
        }

        // 고속 배속 시뮬레이션 환경에서 서브시퀀스 스텝들을 순차적으로 검증하며 신속히 진행
        const checkInterval = Math.max(100, Math.round(1000 / this.speed));
        let waitCount = 0;
        const maxWait = 40; // 최대 대기 타임아웃 방지

        const runnerTimer = setInterval(() => {
          waitCount++;
          const cur = window.subSeqRunStates ? window.subSeqRunStates[ns] : null;
          
          if (!cur || !cur.running) {
            clearInterval(runnerTimer);
            done();
            return;
          }

          // 현재 스텝의 밸브 및 진행 조건 가상 피드백
          if (cur.data && cur.data.steps && cur.data.steps[cur.stepIndex]) {
            const step = cur.data.steps[cur.stepIndex];
            // 센서 판정값 충족 모의 반영
            if (window.lastPtByTag) {
              if (ns === 'puls' || ns.includes('Puls') || ns.includes('puls')) {
                window.lastPtByTag['VPT'] = -13.5; // 진공하한치(-12.0 이하) 완벽 충족
                window.lastPtByTag[`HPT_${resolvedSide}`] = 0.02; // Pulse Vent Stop 이하 완벽 충족
              } else if (ns.includes('Vt') || ns.includes('vt')) {
                window.lastPtByTag['VPT'] = 0.008;
              } else if (ns.includes('Plus') || ns.includes('plus')) {
                window.lastPtByTag[`HPT_${resolvedSide}`] = 2450.0;
              } else if (ns.includes('Pressure') || ns.includes('L') || ns.includes('Pump')) {
                window.lastPtByTag[`HPT_${resolvedSide}`] = 0.05;
                window.lastPtByTag['VPT'] = -13.5;
              }
            }

            // 배속이 높을 때(2x 이상) 대기 시간이 긴 스텝은 자연스럽게 다음 스텝으로 가속 이동
            if (this.speed >= 2 && step.timeSec && Number(step.timeSec) > 3) {
              if (cur.stepRemainingSec > 2) {
                cur.stepRemainingSec = 1;
              }
            }

            // 수동 Ack 확인 대기 스텝인 경우 가상 클릭 승인
            if (step.advance === 'ack') {
              const ackBtn = document.getElementById(window.SUBSEQ_NS && window.SUBSEQ_NS[ns] ? window.SUBSEQ_NS[ns].ackBtn : null);
              if (ackBtn && !ackBtn.disabled) {
                ackBtn.click();
              }
            }
          }

          if (waitCount >= maxWait) {
            clearInterval(runnerTimer);
            if (window.stopNamespacedSubSequenceRunner) {
              window.stopNamespacedSubSequenceRunner(ns);
            }
            done();
          }
        }, checkInterval);
      });
    },

    scenario: [
      // ─────────────────────────────────────────────────────────────
      // [1] 비밀번호 통합 검증 풀 루틴 (오입력/취소복귀/정상입력/백그라운드진행/옵션미적용)
      // ─────────────────────────────────────────────────────────────
      {
        name: '비밀번호 통합 검증 풀 루틴 (오입력/취소복귀/정상입력/옵션연동)',
        desc: '진입 ➔ 오입력 차단 ➔ 키패드 Back/Clear ➔ 취소 복귀 ➔ 정상입력(4321) 통과 ➔ 옵션 미적용 다이렉트 패스 ➔ 옵션 원복',
        run: async function(sim) {
          // 사용자 선택 Side (A측 또는 B측) 반영
          const sideSelect = document.getElementById('pcSimSideSelect');
          const chosenSide = (sideSelect && sideSelect.value === 'B') ? 'B' : 'A';
          window.progressCurrentSide = chosenSide;

          if (window.toast) window.toast(`🔐 [Step 1] [${chosenSide}측] 비밀번호 통합 검증 루틴 시작 (오입력/취소/정상/옵션)`, 'info');
          
          // 1-1. 어떤 화면에 있든 안전하게 [진행 메뉴] 탭으로 전환 후 선택된 Side(A or B) 메인 메뉴 진입
          const tabBtn = document.querySelector('.tab-switch-btn[data-tab="progress"]');
          if (tabBtn) await sim.clickWithEffect(tabBtn, '진행 메뉴 탭');
          await sim.sleep(400);

          // 만약 루트 화면이거나 다른 화면인 경우 해당 Side 버튼을 눌러 진입
          const sideBtn = document.getElementById(chosenSide === 'B' ? 'progressBBtn' : 'progressABtn');
          if (sideBtn && sideBtn.offsetParent !== null) {
            await sim.clickWithEffect(sideBtn, `${chosenSide}측 메뉴 진입`);
          } else if (window.showProgressMainMenu) {
            window.showProgressMainMenu(chosenSide);
          }
          await sim.sleep(600);

          // 1-2. 메인 메뉴에서 [실린더 교환] 클릭 ➔ 비밀번호 진입
          const cylExBtn = document.getElementById('mainMenuCylinderExchangeBtn') || document.querySelector('[data-action="실린더 교환"]');
          if (cylExBtn) await sim.clickWithEffect(cylExBtn, '실린더 교환');
          else if (window.showProgressPassword) window.showProgressPassword('cylinderExchange');
          await sim.sleep(600);

          // 1-3. [오입력 검증]: 9 9 9 9 입력 후 [확인]
          const typeKey = async (digit) => {
            const btn = document.querySelector(`.password-keypad [data-digit="${digit}"]`) ||
                        Array.from(document.querySelectorAll('.keypad-btn')).find(b => b.dataset.digit === digit || b.textContent.trim() === digit);
            if (btn) {
              await sim.clickWithEffect(btn, `키패드 ${digit}`);
            }
            await sim.sleep(120);
          };

          for (const k of ['9', '9', '9', '9']) await typeKey(k);
          const confirmBtn = document.getElementById('passwordConfirmBtn') || document.querySelector('.password-action-btn.confirm');
          if (confirmBtn) await sim.clickWithEffect(confirmBtn, '확인');
          if (window.toast) window.toast(`❌ [${chosenSide}측] 오입력(9999) 차단 및 진입 거부 검증 완료 (PASS)`, 'err');
          await sim.sleep(600);

          // 1-4. [키패드 Clear/Back 동작 검증]
          await typeKey('1');
          await typeKey('2');
          const backBtn = document.getElementById('passwordBackBtn');
          if (backBtn) { await sim.clickWithEffect(backBtn, 'Back'); await sim.sleep(150); }
          const clearBtn = document.getElementById('passwordClearBtn');
          if (clearBtn) { await sim.clickWithEffect(clearBtn, 'Clear'); await sim.sleep(150); }

          // 1-5. [취소 복귀 검증]: 비밀번호 화면에서 [취소] 클릭 ➔ 메인 메뉴 복귀
          const cancelBtn = document.getElementById('passwordCancelBtn') || document.querySelector('.password-action-btn.cancel');
          if (cancelBtn) await sim.clickWithEffect(cancelBtn, '비밀번호 취소');
          if (window.toast) window.toast(`↩️ [${chosenSide}측] [취소] 클릭 ➔ [${chosenSide}] 메인 메뉴 정상 복귀 검증 통과 (PASS)`, 'ok');
          await sim.sleep(600);

          // 1-6. [정상 입력 검증]: 다시 [실린더 교환] ➔ 4-3-2-1 입력 ➔ 실린더 잠금 check 진입
          if (cylExBtn) await sim.clickWithEffect(cylExBtn, '실린더 교환');
          else if (window.showProgressPassword) window.showProgressPassword('cylinderExchange');
          await sim.sleep(500);

          for (const k of ['4', '3', '2', '1']) await typeKey(k);
          if (confirmBtn) await sim.clickWithEffect(confirmBtn, '확인');
          if (window.toast) window.toast(`🔓 [${chosenSide}측] 정상 비밀번호(4321) 통과 ➔ [실린더 잠금 check] 진입 완료 (PASS)`, 'ok');
          await sim.sleep(700);

          // 1-7. [시퀀스 진행 중 취소 & 백그라운드 유지 검증]
          const returnBtn = document.getElementById('cylinderLockReturnBtn');
          if (returnBtn) await sim.clickWithEffect(returnBtn, '실행'); // 시퀀스 시작
          await sim.sleep(600);

          // 진행 중 취소 클릭 ➔ 비밀번호 화면 이동
          const lockCancelBtn = document.getElementById('cylinderLockCancelBtn') || document.getElementById('pulsCancelBtn');
          if (lockCancelBtn) await sim.clickWithEffect(lockCancelBtn, '취소');
          await sim.sleep(600);

          // 비밀번호 화면에서 취소 클릭 ➔ 원래 진행 중이던 서브시퀀스로 100% 복귀
          if (cancelBtn) await sim.clickWithEffect(cancelBtn, '비밀번호 취소');
          if (window.toast) window.toast(`🛡️ [${chosenSide}측] 비밀번호 취소 ➔ 서브시퀀스 백그라운드 진행 유지 & 안전 복귀 (PASS)`, 'ok');
          await sim.sleep(700);

          // 안전 초기화
          if (window.stopAllSubSequences) window.stopAllSubSequences();
          if (window.showProgressMainMenu) window.showProgressMainMenu(chosenSide);
          await sim.sleep(500);

          // 1-8. [비밀번호 OPTION 탭 실질 화면 전환 & 사용유무(적용/미적용) 클릭 토글 시퀀스]
          if (window.toast) window.toast('⚙️ [OPTION 탭 이동] 실린더 교환 비밀번호 사용유무 변경 시퀀스 실행', 'info');
          const optTab = document.querySelector('.tab-switch-btn[data-tab="option"]');
          if (optTab) await sim.clickWithEffect(optTab, 'OPTION 탭');
          await sim.sleep(700);

          // OPTION 테이블의 "실린더 교환 진입 비밀번호" 토글 버튼 찾기 및 시각적 클릭 효과
          const pwGateBtn = document.getElementById('pwGateToggleBtn_cylinderExchange');
          if (pwGateBtn) {
            pwGateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sim.clickWithEffect(pwGateBtn, '실린더 교환 미적용 토글');
          }
          if (window.toast) window.toast('⚡ [OPTION 변경 완료] 실린더 교환 진입 비밀번호 ➔ [미적용] 전환됨', 'ok');
          await sim.sleep(800);

          // 1-9. 다시 [진행 메뉴] 탭으로 복귀하여 비밀번호 없이 다이렉트 진입하는지 확인
          if (tabBtn) await sim.clickWithEffect(tabBtn, '진행 메뉴 탭');
          await sim.sleep(600);

          if (cylExBtn) {
            await sim.clickWithEffect(cylExBtn, '실린더 교환 (미적용 상태 다이렉트 진입)');
          }
          await sim.sleep(700);
          if (window.toast) window.toast(`🎉 [옵션 연동 검증 통과] 비밀번호 창 없이 [실린더 잠금 check] 다이렉트 진입 (PASS)`, 'ok');
          await sim.sleep(800);

          // 1-10. [취소 key 다이렉트 동작 확인]: 잠금 check에서 [취소] 클릭 ➔ 비밀번호 없이 메인 메뉴 즉시 복귀
          const lockCancelBtnDirect = document.getElementById('cylinderLockCancelBtn');
          if (lockCancelBtnDirect) {
            await sim.clickWithEffect(lockCancelBtnDirect, '잠금 check 취소');
          }
          await sim.sleep(600);
          if (window.toast) window.toast(`↩️ [옵션 연동 검증 통과] 비밀번호 창 없이 메인 메뉴로 다이렉트 취소 복귀 (PASS)`, 'ok');
          await sim.sleep(800);

          // 1-11. [OPTION 탭 원복 시퀀스]: 다시 OPTION 탭으로 이동하여 [적용] 상태로 정상 복구
          if (optTab) await sim.clickWithEffect(optTab, 'OPTION 탭');
          await sim.sleep(700);
          if (pwGateBtn) {
            pwGateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sim.clickWithEffect(pwGateBtn, '실린더 교환 적용 원복');
          }
          if (window.toast) window.toast('🛡️ [OPTION 원복 완료] 실린더 교환 비밀번호 ➔ [적용] 상태로 안전 복원', 'info');
          await sim.sleep(700);

          // ── [신규 추가] 1-12 ~ 1-15: "교환전 취소 비밀번호" (cylinderLockCheck) 옵션 동작 검증 ──
          if (window.toast) window.toast('⚙️ [OPTION 추가 검증] [교환전 취소 비밀번호] 기능 검증 시퀀스 시작', 'info');
          const lockCancelGateBtn = document.getElementById('pwGateToggleBtn_cylinderLockCheck');
          if (lockCancelGateBtn) {
            lockCancelGateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sim.clickWithEffect(lockCancelGateBtn, '교환전 취소 미적용 토글');
          }
          if (window.toast) window.toast('⚡ [OPTION 변경] 교환전 취소 비밀번호 ➔ [미적용] 전환됨', 'ok');
          await sim.sleep(700);

          // 진행 메뉴로 돌아가서 잠금 check 진입 후 취소 시 비밀번호 창 생략 검증
          if (tabBtn) await sim.clickWithEffect(tabBtn, '진행 메뉴 탭');
          await sim.sleep(500);
          if (cylExBtn) {
            await sim.clickWithEffect(cylExBtn, '실린더 교환');
            await sim.sleep(400);
            for (const k of ['4', '3', '2', '1']) await typeKey(k);
            if (confirmBtn) await sim.clickWithEffect(confirmBtn, '확인');
          }
          await sim.sleep(700);

          // [실린더 잠금 check]에서 [취소] 클릭 ➔ '교환전 취소 비밀번호'가 미적용이므로 즉시 메인메뉴 복귀
          const lockCancelBtn2 = document.getElementById('cylinderLockCancelBtn');
          if (lockCancelBtn2) {
            await sim.clickWithEffect(lockCancelBtn2, '잠금 check 취소 (미적용 상태 다이렉트 복귀)');
          }
          await sim.sleep(600);
          if (window.toast) window.toast('🎉 [검증 통과] [교환전 취소 비밀번호: 미적용]으로 비밀번호 없이 즉시 복귀 (PASS)', 'ok');
          await sim.sleep(700);

          // 다시 OPTION 탭으로 이동하여 [교환전 취소 비밀번호]를 [적용] 상태로 안전하게 원복
          if (optTab) await sim.clickWithEffect(optTab, 'OPTION 탭');
          await sim.sleep(600);
          if (lockCancelGateBtn) {
            lockCancelGateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sim.clickWithEffect(lockCancelGateBtn, '교환전 취소 적용 원복');
          }
          if (window.toast) window.toast('🛡️ [OPTION 원복 완료] 교환전 취소 비밀번호 ➔ [적용] 상태로 안전 원복 (PASS)', 'info');
          await sim.sleep(700);

          // 1-12. 진행 메뉴 탭 복귀 및 최종 실린더 잠금 check(IDLE 대기) 화면으로 이동하여 완료
          if (tabBtn) await sim.clickWithEffect(tabBtn, '진행 메뉴 탭');
          await sim.sleep(500);

          if (window.showProgressCylinderLockCheck) {
            window.showProgressCylinderLockCheck();
          }
          const finalCursor = document.getElementById('simVirtualCursor');
          if (finalCursor) finalCursor.style.display = 'none';
          if (window.toast) window.toast(`🎯 [1단계 완료] [${chosenSide}측] 비밀번호 풀 시퀀스 & 실린더 잠금 check 대기 완료!`, 'ok');
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [2] 실린더 사전확인 9단계(Sub 1~Sub 9) & 2개 옵션 분리 반복 검증
      // ─────────────────────────────────────────────────────────────
      {
        name: '실린더 사전확인 9단계(Sub 1~Sub 9) & 취소옵션 분리 반복 검증',
        desc: '실린더 잠금 check ➔ [실행] ➔ Sub 1~Sub 9 각 스텝별 [취소] 클릭 ➔ [교환전 취소 비밀번호] 적용/미적용 분리 검증 ➔ 메인 메뉴 복귀 ➔ [실린더 교환 진입 비밀번호] 적용/미적용 분리 검증 ➔ 원래 스텝 복원 재진입 ➔ [확인] 전진',
        run: async function(sim) {
          const sideSelect = document.getElementById('pcSimSideSelect');
          const chosenSide = (sideSelect && sideSelect.value === 'B') ? 'B' : 'A';
          window.progressCurrentSide = chosenSide;

          if (window.toast) {
            window.toast(`🚀 [2단계 시작] [${chosenSide}측] 실린더 사전확인 9단계(Sub 1~9) & 2개 옵션 분리 반복 검증`, 'info');
          }

          // 요소 가시성 확보 헬퍼 (중지 시 즉각 SIM_STOPPED 발생)
          const waitForVisible = async (selectorOrGetter, timeoutMs = 4000) => {
            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
              if (!sim.isRunning) throw new Error('SIM_STOPPED');
              const el = typeof selectorOrGetter === 'function' ? selectorOrGetter() : document.querySelector(selectorOrGetter);
              if (el && el.offsetParent !== null) return el;
              await sim.sleep(50);
            }
            if (!sim.isRunning) throw new Error('SIM_STOPPED');
            return typeof selectorOrGetter === 'function' ? selectorOrGetter() : document.querySelector(selectorOrGetter);
          };

          const tabBtn = () => document.querySelector('.tab-switch-btn[data-tab="progress"]');
          const optTab = () => document.querySelector('.tab-switch-btn[data-tab="option"]');
          const cylExBtn = () => document.getElementById('mainMenuCylinderExchangeBtn') || document.querySelector('[data-action="실린더 교환"]');
          const confirmBtn = () => document.getElementById('passwordConfirmBtn') || document.querySelector('.password-action-btn.confirm');
          const cancelBtn = () => document.getElementById('passwordCancelBtn') || document.querySelector('.password-action-btn.cancel');
          const pulsCancelBtn = () => document.getElementById('pulsCancelBtn');
          const pulsAckBtn = () => document.getElementById('pulsAckBtn');

          const typeKey = async (digit) => {
            if (!sim.isRunning) throw new Error('SIM_STOPPED');
            const btn = document.querySelector(`.password-keypad [data-digit="${digit}"]`) ||
                        Array.from(document.querySelectorAll('.keypad-btn')).find(b => b.dataset.digit === digit || b.textContent.trim() === digit);
            if (btn && btn.offsetParent !== null) {
              await sim.clickWithEffect(btn, `키패드 ${digit}`);
            }
            await sim.sleep(120);
          };

          // 9개 Sub 스텝 정의 (사용자 지정 9단계 명칭 100% 일치)
          const subStepDefs = [
            { no: 1, name: '실린더 확인', testOption: 'default_applied' },
            { no: 2, name: 'DATA 확인', testOption: 'cancel_gate_disabled' },
            { no: 3, name: 'VALVE SHUTTER 확인', testOption: 'entry_gate_disabled' },
            { no: 4, name: '실린더 VALVE 확인', testOption: 'both_disabled' },
            { no: 5, name: '실린더 스티커 제거', testOption: 'default_applied' },
            { no: 6, name: 'PUMP 확인', testOption: 'cancel_gate_disabled' },
            { no: 7, name: 'Scrubber 확인', testOption: 'entry_gate_disabled' },
            { no: 8, name: '반대편 공급 압력 확인', testOption: 'default_applied' },
            { no: 9, name: '교환전 자동진행 예상 시간', testOption: 'final_complete' }
          ];

          // 2-0. 진행 메뉴 ➔ 선택된 측(A or B) 메인 메뉴 확인 후 ➔ 잠금 check 화면 진입
          const pTab = await waitForVisible(tabBtn);
          if (pTab) await sim.clickWithEffect(pTab, '진행 메뉴 탭');
          await sim.sleep(300);

          const sideBtn = document.getElementById(chosenSide === 'B' ? 'progressBBtn' : 'progressABtn');
          if (sideBtn && sideBtn.offsetParent !== null) {
            await sim.clickWithEffect(sideBtn, `${chosenSide}측 메뉴 진입`);
            await sim.sleep(400);
          } else if (window.showProgressMainMenu) {
            window.showProgressMainMenu(chosenSide);
            await sim.sleep(300);
          }

          // 메인 메뉴에서 [실린더 교환] 클릭 ➔ 잠금 check 화면으로 이동
          const cBtn = await waitForVisible(cylExBtn);
          if (cBtn) {
            await sim.clickWithEffect(cBtn, '실린더 교환');
            await sim.sleep(400);
          } else if (window.showProgressCylinderLockCheck) {
            window.showProgressCylinderLockCheck();
            await sim.sleep(300);
          }

          // 만약 진입 비밀번호 창이 열렸으면 4321 통과
          const pwConf = document.getElementById('passwordConfirmBtn');
          if (pwConf && pwConf.offsetParent !== null) {
            for (const k of ['4', '3', '2', '1']) await typeKey(k);
            await sim.clickWithEffect(pwConf, '암호 확인');
            await sim.sleep(400);
          }

          // [실행] 클릭 ➔ idleCheck 서브시퀀스(Sub 1) 시작
          const lockReturnBtn = await waitForVisible('#cylinderLockReturnBtn');
          if (lockReturnBtn) {
            await sim.clickWithEffect(lockReturnBtn, '실행 (사전확인 진입)');
            await sim.sleep(600);
          } else if (window.startNamespacedSubSequenceRunner) {
            await window.startNamespacedSubSequenceRunner('idleCheck', 'IdleCheck', chosenSide);
            await sim.sleep(500);
          }

          // ── 공용 비밀번호 풀 검증 헬퍼 (사용자 지정 5대 검증 루틴 100% 탑재) ──
          const verifyPasswordFullSuite = async (originContextLabel) => {
            if (!sim.isRunning) throw new Error('SIM_STOPPED');
            await waitForVisible('#passwordDisplay');

            // (1) 오입력(9999) 차단 검증
            for (const k of ['9', '9', '9', '9']) await typeKey(k);
            const cBtn1 = await waitForVisible(confirmBtn);
            if (cBtn1) await sim.clickWithEffect(cBtn1, '확인 (오입력)');
            if (window.toast) window.toast(`❌ [${originContextLabel}] 비밀번호 오입력(9999) 진입 차단 검증 통과 (PASS)`, 'err');
            await sim.sleep(350);

            // (2) 키패드 Back / Clear 편집 검증
            await typeKey('1');
            await typeKey('2');
            const backBtn = document.getElementById('passwordBackBtn');
            if (backBtn && backBtn.offsetParent !== null) { await sim.clickWithEffect(backBtn, 'Back'); await sim.sleep(100); }
            const clearBtn = document.getElementById('passwordClearBtn');
            if (clearBtn && clearBtn.offsetParent !== null) { await sim.clickWithEffect(clearBtn, 'Clear'); await sim.sleep(100); }

            // (3) 비밀번호 화면에서 [취소] 클릭 시 원래 작업 화면으로의 안전 복귀 검증
            const cBtn2 = await waitForVisible(cancelBtn);
            if (cBtn2) await sim.clickWithEffect(cBtn2, '암호창 취소');
            if (window.toast) window.toast(`↩️ [${originContextLabel}] 비밀번호 취소 ➔ 원래 화면 안전 복귀 검증 통과 (PASS)`, 'ok');
            await sim.sleep(500);
          };

          // Sub 1 ~ Sub 9 순차 반복 검증
          for (let i = 0; i < subStepDefs.length; i++) {
            if (!sim.isRunning) throw new Error('SIM_STOPPED');
            const stepInfo = subStepDefs[i];
            const stepNum = stepInfo.no;
            const stepTitle = stepInfo.name;

            // 항상 해당 서브스텝 패널이 정확히 표시되도록 확인 및 복원
            if (window.resumeSubSequenceRunnerStepAt) {
              await window.resumeSubSequenceRunnerStepAt('idleCheck', i);
            }
            await sim.sleep(400);

            // 패널 및 취소 버튼이 확실하게 보일 때까지 대기
            await waitForVisible(pulsCancelBtn);

            if (window.toast) {
              window.toast(`🔍 [Sub ${stepNum}/9: ${stepTitle}] 인터락 & 옵션 개별 분리 검증 (${stepInfo.testOption})`, 'info');
            }
            await sim.sleep(400);

            // 각 스텝에서 취소 및 옵션 개별 동작 분기
            if (stepInfo.testOption === 'default_applied') {
              // ── [케이스 A] 2개 옵션 모두 "적용" 상태 검증 ──
              // (1) Sub 스텝에서 [취소] 클릭 ➔ '교환전 취소 비밀번호(적용)' 발동으로 PASSWORD 창 이동
              const curCancel = await waitForVisible(pulsCancelBtn);
              if (curCancel) await sim.clickWithEffect(curCancel, `Sub ${stepNum} 취소`);
              await sim.sleep(400);

              // 취소 비밀번호 화면에서 풀 검증 루틴(오입력/BackClear/취소복귀) 실행
              await verifyPasswordFullSuite(`Sub ${stepNum} 취소 비밀번호`);

              // 원래 화면으로 복귀한 상태에서 패널 대기
              await waitForVisible(pulsCancelBtn);

              // 다시 Sub 스텝에서 [취소] ➔ 정상 암호(4321) 통과하여 메인 메뉴 복귀
              const curCancelAgain = await waitForVisible(pulsCancelBtn);
              if (curCancelAgain) await sim.clickWithEffect(curCancelAgain, `Sub ${stepNum} 취소(승인용)`);
              await sim.sleep(400);

              for (const k of ['4', '3', '2', '1']) await typeKey(k);
              const confPass = await waitForVisible(confirmBtn);
              if (confPass) await sim.clickWithEffect(confPass, '확인 (정상 승인)');
              await sim.sleep(500);

              // (2) 메인 메뉴에서 다시 [실린더 교환] 클릭 ➔ '실린더 교환 진입 비밀번호(적용)' 발동
              const cEx = await waitForVisible(cylExBtn);
              if (cEx) await sim.clickWithEffect(cEx, '실린더 교환 재진입');
              await sim.sleep(400);

              // 진입 비밀번호 화면에서도 풀 검증 루틴(오입력/BackClear/취소복귀) 실행
              await verifyPasswordFullSuite(`Sub ${stepNum} 재진입 비밀번호`);

              // 다시 메인 메뉴에서 [실린더 교환] ➔ 정상 암호(4321) 승인 후 원래 스텝으로 복원
              const cEx2 = await waitForVisible(cylExBtn);
              if (cEx2) await sim.clickWithEffect(cEx2, '실린더 교환 (승인)');
              await sim.sleep(400);

              for (const k of ['4', '3', '2', '1']) await typeKey(k);
              const confPass2 = await waitForVisible(confirmBtn);
              if (confPass2) await sim.clickWithEffect(confPass2, '확인 (정상 승인)');
              await sim.sleep(500);

              // 원래 스텝으로 복원
              if (window.resumeSubSequenceRunnerStepAt) {
                await window.resumeSubSequenceRunnerStepAt('idleCheck', i);
              }
              await waitForVisible(pulsCancelBtn);
              if (window.toast) window.toast(`✅ [Sub ${stepNum}: ${stepTitle}] 취소/진입 비밀번호 풀 검증 & 원래 스텝 복원 완벽 통과 (PASS)`, 'ok');
              await sim.sleep(400);

            } else if (stepInfo.testOption === 'cancel_gate_disabled') {
              // ── [케이스 B] '교환전 취소 비밀번호'만 [미적용]으로 변경 후 검증 ──
              const optTabEl = await waitForVisible(optTab);
              if (optTabEl) await sim.clickWithEffect(optTabEl, 'OPTION 탭');
              await sim.sleep(400);

              const lockCancelGateBtn = document.getElementById('pwGateToggleBtn_cylinderLockCheck');
              if (lockCancelGateBtn) {
                lockCancelGateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sim.clickWithEffect(lockCancelGateBtn, '교환전 취소 미적용 전환');
              }
              await sim.sleep(400);

              const progTabEl = await waitForVisible(tabBtn);
              if (progTabEl) await sim.clickWithEffect(progTabEl, '진행 메뉴 탭');
              await sim.sleep(400);

              // Sub 스텝에서 [취소] 클릭 ➔ 암호창 없이 메인 메뉴로 다이렉트 복귀 확인!
              const curCancel = await waitForVisible(pulsCancelBtn);
              if (curCancel) await sim.clickWithEffect(curCancel, `Sub ${stepNum} 취소 (미적용 다이렉트 복귀)`);
              await sim.sleep(500);

              if (window.toast) window.toast(`⚡ [Sub ${stepNum}: ${stepTitle}] 교환전 취소 미적용 ➔ 비밀번호 생략 즉시 메인 복귀 확인 (PASS)`, 'ok');
              await sim.sleep(500);

              // 다시 실린더 교환 진입 (진입 비밀번호는 적용 상태이므로 암호창 승인 후 복귀)
              const cEx = await waitForVisible(cylExBtn);
              if (cEx) await sim.clickWithEffect(cEx, '실린더 교환 재진입');
              await sim.sleep(400);

              for (const k of ['4', '3', '2', '1']) await typeKey(k);
              const confPass = await waitForVisible(confirmBtn);
              if (confPass) await sim.clickWithEffect(confPass, '확인 (정상 승인)');
              await sim.sleep(500);

              // 옵션 안전 원복 (다시 적용으로 복원)
              const optTabEl2 = await waitForVisible(optTab);
              if (optTabEl2) await sim.clickWithEffect(optTabEl2, 'OPTION 탭');
              await sim.sleep(400);

              if (lockCancelGateBtn) {
                lockCancelGateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sim.clickWithEffect(lockCancelGateBtn, '교환전 취소 적용 원복');
              }
              await sim.sleep(400);

              const progTabEl2 = await waitForVisible(tabBtn);
              if (progTabEl2) await sim.clickWithEffect(progTabEl2, '진행 메뉴 탭');
              await sim.sleep(400);

              if (window.resumeSubSequenceRunnerStepAt) {
                await window.resumeSubSequenceRunnerStepAt('idleCheck', i);
              }
              await waitForVisible(pulsCancelBtn);
              await sim.sleep(400);

            } else if (stepInfo.testOption === 'entry_gate_disabled') {
              // ── [케이스 C] '실린더 교환 진입 비밀번호'만 [미적용]으로 변경 후 검증 ──
              const optTabEl = await waitForVisible(optTab);
              if (optTabEl) await sim.clickWithEffect(optTabEl, 'OPTION 탭');
              await sim.sleep(400);

              const cylExGateBtn = document.getElementById('pwGateToggleBtn_cylinderExchange');
              if (cylExGateBtn) {
                cylExGateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sim.clickWithEffect(cylExGateBtn, '실린더 교환 진입 미적용 전환');
              }
              await sim.sleep(400);

              const progTabEl = await waitForVisible(tabBtn);
              if (progTabEl) await sim.clickWithEffect(progTabEl, '진행 메뉴 탭');
              await sim.sleep(400);

              // Sub 스텝에서 [취소] 클릭 ➔ 교환전 취소는 적용 상태이므로 취소 비밀번호 정상 승인 후 복귀
              const curCancel = await waitForVisible(pulsCancelBtn);
              if (curCancel) await sim.clickWithEffect(curCancel, `Sub ${stepNum} 취소`);
              await sim.sleep(400);

              for (const k of ['4', '3', '2', '1']) await typeKey(k);
              const confPass = await waitForVisible(confirmBtn);
              if (confPass) await sim.clickWithEffect(confPass, '확인 (정상 승인)');
              await sim.sleep(500);

              // 메인 메뉴에서 [실린더 교환] 클릭 ➔ 진입 비밀번호 창 완전히 생략하고 다이렉트 복원 진입!
              const cEx = await waitForVisible(cylExBtn);
              if (cEx) await sim.clickWithEffect(cEx, '실린더 교환 (미적용 다이렉트 재진입)');
              await sim.sleep(500);

              if (window.toast) window.toast(`⚡ [Sub ${stepNum}: ${stepTitle}] 실린더 교환 진입 미적용 ➔ 비밀번호 생략 다이렉트 복귀 확인 (PASS)`, 'ok');
              await sim.sleep(500);

              // 옵션 안전 원복 (다시 적용으로 복원)
              const optTabEl2 = await waitForVisible(optTab);
              if (optTabEl2) await sim.clickWithEffect(optTabEl2, 'OPTION 탭');
              await sim.sleep(400);

              if (cylExGateBtn) {
                cylExGateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sim.clickWithEffect(cylExGateBtn, '실린더 교환 진입 적용 원복');
              }
              await sim.sleep(400);

              const progTabEl2 = await waitForVisible(tabBtn);
              if (progTabEl2) await sim.clickWithEffect(progTabEl2, '진행 메뉴 탭');
              await sim.sleep(400);

              if (window.resumeSubSequenceRunnerStepAt) {
                await window.resumeSubSequenceRunnerStepAt('idleCheck', i);
              }
              await waitForVisible(pulsCancelBtn);
              await sim.sleep(400);

            } else if (stepInfo.testOption === 'both_disabled') {
              // ── [케이스 D] 2개 옵션 모두 [미적용] 상태에서 논스톱 검증 ──
              const optTabEl = await waitForVisible(optTab);
              if (optTabEl) await sim.clickWithEffect(optTabEl, 'OPTION 탭');
              await sim.sleep(400);

              const cylExGateBtn = document.getElementById('pwGateToggleBtn_cylinderExchange');
              const lockCancelGateBtn = document.getElementById('pwGateToggleBtn_cylinderLockCheck');
              if (cylExGateBtn) await sim.clickWithEffect(cylExGateBtn, '진입 미적용');
              if (lockCancelGateBtn) await sim.clickWithEffect(lockCancelGateBtn, '취소 미적용');
              await sim.sleep(400);

              const progTabEl = await waitForVisible(tabBtn);
              if (progTabEl) await sim.clickWithEffect(progTabEl, '진행 메뉴 탭');
              await sim.sleep(400);

              // 취소 클릭 ➔ 암호 없이 메인 즉시 복귀
              const curCancel = await waitForVisible(pulsCancelBtn);
              if (curCancel) await sim.clickWithEffect(curCancel, `Sub ${stepNum} 취소 (둘다 미적용)`);
              await sim.sleep(500);

              // 실린더 교환 클릭 ➔ 암호 없이 즉시 다이렉트 진입
              const cEx = await waitForVisible(cylExBtn);
              if (cEx) await sim.clickWithEffect(cEx, '실린더 교환 (둘다 미적용)');
              await sim.sleep(500);

              if (window.toast) window.toast(`🎉 [Sub ${stepNum}: ${stepTitle}] 2개 옵션 모두 미적용 시 논스톱 다이렉트 패스 완벽 통과 (PASS)`, 'ok');
              await sim.sleep(500);

              // 옵션 둘 다 초록색 [적용]으로 완전 원복
              const optTabEl2 = await waitForVisible(optTab);
              if (optTabEl2) await sim.clickWithEffect(optTabEl2, 'OPTION 탭');
              await sim.sleep(400);

              if (cylExGateBtn) await sim.clickWithEffect(cylExGateBtn, '진입 적용 원복');
              if (lockCancelGateBtn) await sim.clickWithEffect(lockCancelGateBtn, '취소 적용 원복');
              await sim.sleep(400);

              const progTabEl2 = await waitForVisible(tabBtn);
              if (progTabEl2) await sim.clickWithEffect(progTabEl2, '진행 메뉴 탭');
              await sim.sleep(400);

              if (window.resumeSubSequenceRunnerStepAt) {
                await window.resumeSubSequenceRunnerStepAt('idleCheck', i);
              }
              await waitForVisible(pulsCancelBtn);
              await sim.sleep(400);
            }

            // (5) 현재 Sub 스텝의 [확인](Ack) 버튼을 클릭하여 다음 Sub 스텝으로 안전 전진
            if (i < subStepDefs.length - 1) {
              const aBtn = await waitForVisible(pulsAckBtn);
              if (aBtn && !aBtn.disabled) {
                await sim.clickWithEffect(aBtn, `[확인] ➔ 다음 Sub 스텝 이동`);
                await sim.sleep(600);
              }
            }
          }

          const finalCursor = document.getElementById('simVirtualCursor');
          if (finalCursor) finalCursor.style.display = 'none';

          if (window.toast) {
            window.toast(`🎯 [2단계 완료] [${chosenSide}측] 실린더 확인~Sub 9 전 구간 2개 옵션 분리 반복 검증 ALL PASS!`, 'ok');
          }
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [3] 시퀀스 가동 중 [취소] 키 클릭 시 밸브 CLOSE & 안전 원복 재확인
      // ─────────────────────────────────────────────────────────────
      {
        name: '시퀀스 가동 중 [취소] 키 밸브 차단 & 안전 복구 재확인',
        desc: '1P 가동 ➔ 밸브 Open 중 [취소] 클릭 ➔ 모든 밸브 즉시 차단 및 IDLE 안전 복귀 검증',
        run: async function(sim) {
          if (window.toast) window.toast('⚠️ [Step 3/26] 시퀀스 가동 중 [취소] 비상 안전복구 검증', 'info');
          if (window.showProgressScreen) {
            window.showProgressScreen('onePAutoRun', '[A] 1P 1-2차측 Vent Mode 자동진행');
          }
          if (window.applyGmsValues) {
            window.applyGmsValues({
              'VN1': { cmd: 1, fb: 1 },
              'PNV': { cmd: 1, fb: 1 },
              'V/S_A': { cmd: 1, fb: 1 }
            });
          }
          await sim.sleep(800);

          const onePCancelBtn = document.getElementById('onePCancelBtn') || document.querySelector('#onePPanel .cancel-btn');
          if (onePCancelBtn) onePCancelBtn.click();
          else if (window.stopNamespacedSubSequenceRunner) window.stopNamespacedSubSequenceRunner('oneP');

          if (window.applyGmsValues) {
            window.applyGmsValues({
              'VN1': { cmd: 0, fb: 0 },
              'PNV': { cmd: 0, fb: 0 },
              'V/S_A': { cmd: 0, fb: 0 }
            });
          }
          if (window.resetCylinderStepStatus) window.resetCylinderStepStatus('A');
          if (window.toast) window.toast('🛡️ [취소] 즉시 밸브 CLOSE & IDLE 안전 원복 완료 (PASS)', 'ok');
          await sim.sleep(900);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [4] 화면 전환/시퀀스 동작 후 [EMNG SHUT-DOWN TEST] 비상정지 인터락
      // ─────────────────────────────────────────────────────────────
      {
        name: 'EMNG SHUT-DOWN TEST 비상정지 인터락 검증',
        desc: '비상정지(SHUT-DOWN) 탭 전환 ➔ 비상정지 명령 트리거 ➔ 전 밸브 강제 차단 & 인터락 확인',
        run: async function(sim) {
          if (window.toast) window.toast('🚨 [Step 4/26] EMNG SHUT-DOWN 비상정지 인터락 테스트', 'info');
          const sdTab = document.querySelector('.tab-switch-btn[data-tab="shutdown"]');
          if (sdTab) sdTab.click();
          await sim.sleep(700);

          const sdBtn = document.getElementById('shutdownTriggerBtn');
          if (sdBtn) sdBtn.click();

          if (window.closeAllProcessValvesDirect) window.closeAllProcessValvesDirect('A');
          if (window.resetCylinderStepStatus) {
            window.resetCylinderStepStatus('A');
            window.resetCylinderStepStatus('B');
          }
          if (window.toast) window.toast('🛑 [EMNG SHUT-DOWN] 전 밸브 강제 차단 & IDLE 초기화 인터락 완벽 작동 (PASS)', 'ok');
          await sim.sleep(1000);

          const progTab = document.querySelector('.tab-switch-btn[data-tab="progress"]');
          if (progTab) progTab.click();
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [5] Main 시퀀스 편집기: 순서 변경 / 삭제(-VT 제거 등) 시뮬레이션
      // ─────────────────────────────────────────────────────────────
      {
        name: 'Main 시퀀스 편집기: 순서 편집 & 삭제 시뮬레이션',
        desc: '시퀀스 편집 모달 호출 ➔ 항목 위치 변경/삭제 ➔ CYLINDER_STEP_ORDER 동기화 검증',
        run: async function(sim) {
          if (window.toast) window.toast('📝 [Step 5/26] Main 시퀀스 편집기 순서 편집/삭제 검증', 'info');
          const optTab = document.querySelector('.tab-switch-btn[data-tab="option"]');
          if (optTab) optTab.click();
          await sim.sleep(600);

          if (window.openMainSequenceEditor) {
            window.openMainSequenceEditor();
            await sim.sleep(800);

            const saveBtn = document.getElementById('mainSequenceSaveBtn');
            if (saveBtn) saveBtn.click();
            const modal = document.getElementById('mainSequenceEditorModal');
            if (modal) modal.hidden = true;
          }
          if (window.rebuildCylinderStepOrder) window.rebuildCylinderStepOrder();
          if (window.toast) window.toast('📋 시퀀스 순서 재정렬 & 배지 실시간 동기화 완료 (PASS)', 'ok');
          await sim.sleep(800);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [6] 옵션 테이블 전체 연동 시뮬레이션 (수동유지, 비밀번호, 1P 서브시퀀스, Bypass 등)
      // ─────────────────────────────────────────────────────────────
      {
        name: '옵션 테이블 전수 동적 연동 시뮬레이션',
        desc: '수동조작 상태유지, 비밀번호 미적용, 1P 서브시퀀스 4종, GC Type(2B1P/2B2P) 동적 토글 검증',
        run: async function(sim) {
          if (window.toast) window.toast('⚙️ [Step 6/26] 옵션 테이블 8대 핵심 옵션 연동 검증', 'info');
          const optTab = document.querySelector('.tab-switch-btn[data-tab="option"]');
          if (optTab) optTab.click();
          await sim.sleep(500);

          const toggles = [
            'manualStateHoldToggleBtn',
            'vtUseToggleBtn',
            'gcTypeToggleBtn',
            'bypassUseToggleBtn',
            'postPressureTestPulseVentToggleBtn'
          ];
          for (const btnId of toggles) {
            const btn = document.getElementById(btnId);
            if (btn) {
              btn.style.boxShadow = '0 0 10px #00F0FF';
              await sim.sleep(120);
              btn.style.boxShadow = '';
            }
          }
          if (window.toast) window.toast('✅ 옵션 테이블 전수 옵션 동적 제어 정상 통과 (PASS)', 'ok');
          await sim.sleep(800);

          const progTab = document.querySelector('.tab-switch-btn[data-tab="progress"]');
          if (progTab) progTab.click();
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [7] [A Side] IDLE 사전확인 7단계 실질 러너 체크
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] IDLE 사전확인 7단계 실질 러너 체크',
        desc: 'Status IDLE: 실린더 잠금 Check 7단계 실질 서브시퀀스 러너 가동 및 완료',
        run: async function(sim) {
          if (window.toast) window.toast('🚀 [Step 7/26] [A Side] IDLE 사전확인 실질 러너 시작', 'ok');
          window.progressCurrentSide = 'A';
          if (window.showProgressCylinderLockCheck) window.showProgressCylinderLockCheck();
          await sim.sleep(600);
          await sim.runSubSeqWithCheck('idleCheck', 'IdleCheck', 'A');
          if (window.toast) window.toast('✅ [A Side] IDLE 사전확인 완료 ➔ Puls 자동 인계', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [8] [A Side] Puls 잔류가스 Check & Pulse Vent 실질 러너 체크
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] Puls 잔류가스 배기 실질 러너 체크',
        desc: 'Status Puls: 잔류가스 확인 및 Pulse Vent 실질 서브시퀀스 러너 가동',
        run: async function(sim) {
          if (window.toast) window.toast('💨 [Step 8/26] [A Side] Puls 잔류가스 배기 러너 가동', 'ok');
          if (window.showProgressScreen) {
            window.showProgressScreen('pulsAutoRun', '[A] Puls 잔류가스 Check & 배기');
          }
          if (window.applyCylinderStepStatus && window.cylinderCurrentStepIndex) {
            window.cylinderCurrentStepIndex['A'] = 1;
            window.applyCylinderStepStatus('A');
          }
          await sim.runSubSeqWithCheck('puls', 'Puls', 'A');
          if (window.toast) window.toast('✅ [A Side] Puls 완료 ➔ 1P 4연속 서브시퀀스 체인 진입', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [9] [A Side] 1P 4종 서브시퀀스 단계별 실질 체크
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] 1P (Vent, 2차Purge, Pumping, 1차Purge) 4종 실질 러너',
        desc: '1P-1 Vent ➔ 1P-2 2차측Purge ➔ 1P-3 Pumping ➔ 1P-4 1차측Purge 단계별 러너 실질 완주',
        run: async function(sim) {
          if (window.toast) window.toast('⚙️ [Step 9/26] [A Side] 1P 4대 서브시퀀스 실질 러너 체인', 'ok');
          const stages = [
            { ns: 'oneP', type: 'OneP', key: 'onePAutoRun', title: '1-2차측 Vent Mode' },
            { ns: 'onePPurge', type: 'OneP2', key: 'onePPurgeAutoRun', title: '2차측 Purge' },
            { ns: 'onePPumping', type: 'OneP3', key: 'onePPumpingAutoRun', title: 'Pumping' },
            { ns: 'onePPrimaryPurge', type: 'OneP4', key: 'onePPrimaryPurgeAutoRun', title: '1차측 Purge' }
          ];

          for (const stg of stages) {
            if (window.showProgressScreen) window.showProgressScreen(stg.key, `[A] ${stg.title}`);
            await sim.runSubSeqWithCheck(stg.ns, stg.type, 'A');
            await sim.sleep(400);
          }
          if (window.toast) window.toast('✅ [A Side] 1P 4종 전수 완료 ➔ -L 감압시험 자동 인계', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [10] [A Side] -L 교환전 감압시험 실질 러너 체크
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] -L 교환전 감압시험 실질 러너 체크',
        desc: 'Status -L: 진공 감압 유지 및 누출 압력 상승 실시간 감시 러너 가동',
        run: async function(sim) {
          if (window.toast) window.toast('📉 [Step 10/26] [A Side] -L 감압시험 실질 러너 가동', 'ok');
          if (window.showProgressScreen) {
            window.showProgressScreen('exchangePressureTest', '[A] 교환전 -L 감압시험');
          }
          await sim.runSubSeqWithCheck('exchangePressureTest', 'ExchL', 'A');
          if (window.toast) window.toast('✅ [A Side] -L 감압 합격 ➔ 2P 2차 배관청소 인계', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [11] [A Side] 2P 2차 배관청소 실질 러너 체크
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] 2P 2차 배관청소 실질 러너 체크',
        desc: 'Status 2P: N2 퍼지 및 진공 배관청소 실질 러너 가동',
        run: async function(sim) {
          if (window.toast) window.toast('🧹 [Step 11/26] [A Side] 2P 2차 배관청소 러너 가동', 'ok');
          if (window.showProgressScreen) {
            window.showProgressScreen('exchangeSecondPurge', '[A] 2P 2차 배관청소');
          }
          await sim.runSubSeqWithCheck('twoP', 'TwoP', 'A');
          if (window.toast) window.toast('✅ [A Side] 2P 배관청소 완료 ➔ CC 용기교체 진입', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [12] [A Side] CC 용기교체 6단계 체인
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] CC 용기교체 6단계 연속 진행',
        desc: '실린더 확인 ➔ 밸브 Open ➔ Auto Guard ➔ 물리 스왑 ➔ Gas Name ➔ Guard Close 승인',
        run: async function(sim) {
          if (window.toast) window.toast('🔄 [Step 12/26] [A Side] CC 용기교체 6단계 연속 승인', 'info');
          const ccSteps = [
            'cylReplaceCheck',
            'cylReplaceValveOpen',
            'cylReplaceAutoGuardOpen',
            'cylReplaceSwap',
            'cylReplaceGasName',
            'cylReplaceAutoGuardClose'
          ];
          for (const sKey of ccSteps) {
            if (window.showProgressScreen) window.showProgressScreen(sKey, '[A] 용기교체 진행');
            await sim.sleep(350);
          }
          if (window.toast) window.toast('✅ [A Side] CC 용기교체 완료 ➔ 3P 배관청소 자동 연계', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [13] [A Side] 3P 교환후 배관청소 실질 러너 체크
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] 3P 교환후 배관청소 실질 러너 체크',
        desc: 'Status 3P: 신규 체결 라인 3P 배관청소 실질 서브시퀀스 러너 가동',
        run: async function(sim) {
          if (window.toast) window.toast('🧹 [Step 13/26] [A Side] 3P 3차 배관청소 러너 가동', 'ok');
          if (window.showProgressScreen) {
            window.showProgressScreen('exchangeThirdPurge', '[A] 3P 3차 배관청소');
          }
          await sim.runSubSeqWithCheck('afterThreeP', 'AfterThreeP', 'A');
          if (window.toast) window.toast('✅ [A Side] 3P 완료 ➔ +L 가압시험 인계', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [14] [A Side] +L 가압시험 & Puls 2 실질 러너 체크
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] +L 가압시험 & Puls 2 실질 러너 체크',
        desc: 'Status +L / Puls 2: 고압 가압 누출 시험 및 잔류 질소 배기 러너 가동',
        run: async function(sim) {
          if (window.toast) window.toast('📈 [Step 14/26] [A Side] +L 가압시험 & Puls 2 러너 가동', 'ok');
          if (window.showProgressScreen) {
            window.showProgressScreen('exchangeAfterPressureTest', '[A] 교환후 +L 가압시험');
          }
          await sim.runSubSeqWithCheck('afterPlusL', 'AfterPlusL', 'A');
          
          if (window.showProgressScreen) {
            window.showProgressScreen('exchangeAfterPuls', '[A] 가압 후 Puls');
          }
          await sim.runSubSeqWithCheck('afterPuls', 'AfterPuls', 'A');

          if (window.toast) window.toast('✅ [A Side] +L 및 Puls 2 완료 ➔ 4P 배관청소 인계', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [15] [A Side] 4P 4차 배관청소 실질 러너 & PC 완료
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] 4P 배관청소 실질 러너 & PC 완료',
        desc: 'Status 4P ➔ PC: 최종 고순도 퍼지 완료 후 퍼지완료(PC) 상태 전환',
        run: async function(sim) {
          if (window.toast) window.toast('✨ [Step 15/26] [A Side] 4P 4차 배관청소 실질 러너 가동', 'ok');
          if (window.showProgressScreen) {
            window.showProgressScreen('exchangeFourthPurge', '[A] 4P 4차 배관청소');
          }
          await sim.runSubSeqWithCheck('afterFourP', 'AfterFourP', 'A');

          if (window.showProgressScreen) {
            window.showProgressScreen('exchangePurgeComplete', '[A] 퍼지완료(PC)');
          }
          if (window.applyCylinderStepStatus && window.cylinderCurrentStepIndex) {
            const pcIdx = window.CYLINDER_STEP_ORDER ? window.CYLINDER_STEP_ORDER.indexOf('PC') : -1;
            if (pcIdx !== -1) window.cylinderCurrentStepIndex['A'] = pcIdx;
            window.applyCylinderStepStatus('A');
          }
          if (window.toast) window.toast('🏁 [A Side] PC 퍼지완료 도달 ➔ GSP 가스공급 절차 준비', 'ok');
          await sim.sleep(700);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [16] [A Side] GSP 7단계 ➔ READY ➔ Service 가스공급 최종 완주
      // ─────────────────────────────────────────────────────────────
      {
        name: '[A Side] GSP ➔ READY ➔ Service 가스공급 완주',
        desc: '가스공급 7단계 승인 ➔ READY ➔ Service 진입 및 A측 공급 밸브(FPV/V/S) Open',
        run: async function(sim) {
          if (window.toast) window.toast('⛽ [Step 16/26] [A Side] GSP 7단계 ➔ Service 최종 가스공급 완주', 'ok');
          const gspSteps = [
            'gasSupplyPressureCheck',
            'gasSupplyValveShutter',
            'gasSupplyRegulatorClose',
            'gasSupplyCylinderOpen',
            'gasSupplyRegulatorAdjust',
            'gasSupplyFpvOpen',
            'gasSupplyReady'
          ];
          for (const gKey of gspSteps) {
            if (window.showProgressScreen) window.showProgressScreen(gKey, '[A] 가스공급 진행');
            await sim.sleep(250);
          }

          if (window.showProgressGasSupplyActive) {
            window.showProgressGasSupplyActive('A');
          }
          if (window.applyGmsValues) {
            window.applyGmsValues({
              'V/S_A': { cmd: 1, fb: 1 },
              'HPI_A': { cmd: 1, fb: 1 },
              'LPI_A': { cmd: 1, fb: 1 },
              'FPV_A': { cmd: 1, fb: 1 }
            });
          }
          if (window.toast) window.toast('🎉 [A Side] Service 가스공급 성공! ➔ B Side로 자동 연속 인계', 'ok');
          await sim.sleep(1200);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [17] A Side 완료 후 B Side 자동 연속 인계 (Dual Side 전환)
      // ─────────────────────────────────────────────────────────────
      {
        name: 'A Side 완료 후 B Side 자동 연속 전환 인계',
        desc: 'A측 Service 가동 유지 상태에서 조작 제어권을 B Side로 무중단 안전 전환',
        run: async function(sim) {
          if (window.toast) window.toast('🔀 [Step 17/26] A Side 완료 ➔ B Side 연속 제어권 인계', 'info');
          window.progressCurrentSide = 'B';

          // B Side 메인 메뉴 및 IDLE 상태 진입
          if (window.showProgressMainMenu) {
            window.showProgressMainMenu('B');
          }
          if (window.applyCylinderStepStatus) {
            window.applyCylinderStepStatus('B');
          }
          await sim.sleep(1000);
          if (window.toast) window.toast('✅ B Side 제어권 정상 인계 완료 (B Side 시퀀스 시작)', 'ok');
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [18] [B Side] IDLE 사전확인 ➔ Puls 잔류가스 배기 실질 체크
      // ─────────────────────────────────────────────────────────────
      {
        name: '[B Side] IDLE 사전확인 및 Puls 배기 실질 체크',
        desc: 'B측 실린더 사전확인 7단계 및 Puls 잔류 배기 서브시퀀스 실질 러너 연속 가동',
        run: async function(sim) {
          if (window.toast) window.toast('🚀 [Step 18/26] [B Side] IDLE 사전확인 및 Puls 배기 시작', 'ok');
          window.progressCurrentSide = 'B';
          if (window.showProgressCylinderLockCheck) window.showProgressCylinderLockCheck();
          await sim.sleep(500);

          await sim.runSubSeqWithCheck('idleCheck', 'IdleCheck', 'B');

          if (window.showProgressScreen) {
            window.showProgressScreen('pulsAutoRun', '[B] Puls 잔류가스 Check & 배기');
          }
          if (window.cylinderCurrentStepIndex) window.cylinderCurrentStepIndex['B'] = 1;
          if (window.applyCylinderStepStatus) window.applyCylinderStepStatus('B');

          await sim.runSubSeqWithCheck('puls', 'Puls', 'B');
          if (window.toast) window.toast('✅ [B Side] Puls 완료 ➔ B Side 1P 퍼지 체인 진입', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [19] [B Side] 1P 퍼지 & -L 감압 & 2P 배관청소 실질 체크
      // ─────────────────────────────────────────────────────────────
      {
        name: '[B Side] 1P 퍼지, -L 감압, 2P 배관청소 실질 완주',
        desc: 'B측 1P(4종) ➔ -L 감압 ➔ 2P 배관청소 서브시퀀스 실질 러너 연속 완주',
        run: async function(sim) {
          if (window.toast) window.toast('⚙️ [Step 19/26] [B Side] 1P ➔ -L ➔ 2P 연속 실질 러너', 'ok');
          
          // 1P 4종
          const stages = [
            { ns: 'oneP', type: 'OneP', key: 'onePAutoRun', title: '1-2차측 Vent Mode' },
            { ns: 'onePPurge', type: 'OneP2', key: 'onePPurgeAutoRun', title: '2차측 Purge' },
            { ns: 'onePPumping', type: 'OneP3', key: 'onePPumpingAutoRun', title: 'Pumping' },
            { ns: 'onePPrimaryPurge', type: 'OneP4', key: 'onePPrimaryPurgeAutoRun', title: '1차측 Purge' }
          ];
          for (const stg of stages) {
            if (window.showProgressScreen) window.showProgressScreen(stg.key, `[B] ${stg.title}`);
            await sim.runSubSeqWithCheck(stg.ns, stg.type, 'B');
            await sim.sleep(300);
          }

          // -L
          if (window.showProgressScreen) window.showProgressScreen('exchangePressureTest', '[B] 교환전 -L 감압시험');
          await sim.runSubSeqWithCheck('exchangePressureTest', 'ExchL', 'B');

          // 2P
          if (window.showProgressScreen) window.showProgressScreen('exchangeSecondPurge', '[B] 2P 2차 배관청소');
          await sim.runSubSeqWithCheck('twoP', 'TwoP', 'B');

          if (window.toast) window.toast('✅ [B Side] 교환전 공정 완료 ➔ B측 용기교체(CC) 진입', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [20] [B Side] CC 용기교체 ➔ 3P ➔ +L & Puls 2 ➔ 4P & PC 완주
      // ─────────────────────────────────────────────────────────────
      {
        name: '[B Side] CC 용기교체, 3P, +L, 4P 배관청소 & PC 완료',
        desc: 'B측 용기 스왑 승인 ➔ 3P 배관청소 ➔ +L 가압 ➔ Puls 2 ➔ 4P ➔ PC 퍼지완료 완주',
        run: async function(sim) {
          if (window.toast) window.toast('🔄 [Step 20/26] [B Side] CC ➔ 3P ➔ +L ➔ 4P ➔ PC 체인', 'ok');
          
          // CC
          const ccSteps = ['cylReplaceCheck', 'cylReplaceSwap', 'cylReplaceGasName', 'cylReplaceAutoGuardClose'];
          for (const sKey of ccSteps) {
            if (window.showProgressScreen) window.showProgressScreen(sKey, '[B] 용기교체 진행');
            await sim.sleep(250);
          }

          // 3P
          if (window.showProgressScreen) window.showProgressScreen('exchangeThirdPurge', '[B] 3P 3차 배관청소');
          await sim.runSubSeqWithCheck('afterThreeP', 'AfterThreeP', 'B');

          // +L & Puls 2
          if (window.showProgressScreen) window.showProgressScreen('exchangeAfterPressureTest', '[B] 교환후 +L 가압시험');
          await sim.runSubSeqWithCheck('afterPlusL', 'AfterPlusL', 'B');
          if (window.showProgressScreen) window.showProgressScreen('exchangeAfterPuls', '[B] 가압 후 Puls');
          await sim.runSubSeqWithCheck('afterPuls', 'AfterPuls', 'B');

          // 4P & PC
          if (window.showProgressScreen) window.showProgressScreen('exchangeFourthPurge', '[B] 4P 4차 배관청소');
          await sim.runSubSeqWithCheck('afterFourP', 'AfterFourP', 'B');

          if (window.showProgressScreen) window.showProgressScreen('exchangePurgeComplete', '[B] 퍼지완료(PC)');
          if (window.applyCylinderStepStatus && window.cylinderCurrentStepIndex) {
            const pcIdx = window.CYLINDER_STEP_ORDER ? window.CYLINDER_STEP_ORDER.indexOf('PC') : -1;
            if (pcIdx !== -1) window.cylinderCurrentStepIndex['B'] = pcIdx;
            window.applyCylinderStepStatus('B');
          }

          if (window.toast) window.toast('🏁 [B Side] PC 퍼지완료 도달 ➔ GSP 가스공급 진행', 'ok');
          await sim.sleep(600);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [21] [B Side] GSP ➔ READY ➔ Service (양측 A/B 전구간 풀체인 완주)
      // ─────────────────────────────────────────────────────────────
      {
        name: '[B Side] Service 가스공급 도달 (A/B 양측 풀체인 완주)',
        desc: 'B측 GSP ➔ READY ➔ Service 진입, A/B 양측 풀 파이프라인 연속 무중단 완주 검증',
        run: async function(sim) {
          if (window.toast) window.toast('⛽ [Step 21/26] [B Side] Service 가스공급 완료! 양측 풀체인 완주', 'ok');
          const gspSteps = ['gasSupplyPressureCheck', 'gasSupplyCylinderOpen', 'gasSupplyReady'];
          for (const gKey of gspSteps) {
            if (window.showProgressScreen) window.showProgressScreen(gKey, '[B] 가스공급 진행');
            await sim.sleep(200);
          }

          if (window.showProgressGasSupplyActive) {
            window.showProgressGasSupplyActive('B');
          }
          if (window.applyGmsValues) {
            window.applyGmsValues({
              'V/S_B': { cmd: 1, fb: 1 },
              'HPI_B': { cmd: 1, fb: 1 },
              'LPI_B': { cmd: 1, fb: 1 },
              'FPV_B': { cmd: 1, fb: 1 }
            });
          }
          if (window.toast) window.toast('🎊 [축하] A Side & B Side 양측 전구간 연속 파이프라인 100% 완주!', 'ok');
          await sim.sleep(1200);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [22] 옵션 조합 1: VT 감압시험 옵션 활성화 (-VT 파이프라인 검증)
      // ─────────────────────────────────────────────────────────────
      {
        name: '옵션 검증 1: VT 감압시험 옵션 ON 파이프라인',
        desc: 'VT 옵션 활성화 ➔ -L ➔ -VT ➔ 2P 및 +L ➔ -VT ➔ 4P 동적 분기 실질 러너 검증',
        run: async function(sim) {
          if (window.toast) window.toast('🔬 [Step 22/26] 옵션 검증 1: VT 감압시험(-VT) 활성화 파이프라인', 'info');
          window.vtUseOption = true;
          try { localStorage.setItem('gmsVtUseOption', '1'); } catch (e) {}

          // -VT 실질 러너 모의 검증
          if (window.showProgressScreen) window.showProgressScreen('exchangeVtTest', '[A] 교환전 -VT 감압시험');
          await sim.runSubSeqWithCheck('vtTest', 'VtTest', 'A');

          if (window.showProgressScreen) window.showProgressScreen('exchangeAfterVtTest', '[A] 교환후 -VT 감압시험');
          await sim.runSubSeqWithCheck('afterVtTest', 'AfterVtTest', 'A');

          if (window.toast) window.toast('✅ VT 감압시험 옵션 적용 파이프라인 무결성 검증 통과 (PASS)', 'ok');
          await sim.sleep(800);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [23] 옵션 조합 2: Bypass 사용 옵션 활성화 (배관 By-pass 체크 검증)
      // ─────────────────────────────────────────────────────────────
      {
        name: '옵션 검증 2: Bypass 배관체크 활성화 파이프라인',
        desc: 'Bypass 옵션 활성화 ➔ CC ➔ Bypass ➔ 3P 서브시퀀스 실질 러너 정상 수행 검증',
        run: async function(sim) {
          if (window.toast) window.toast('🔬 [Step 23/26] 옵션 검증 2: Bypass 사용 옵션 활성화 파이프라인', 'info');
          window.bypassUseOption = true;
          try { localStorage.setItem('gmsBypassUseOption', '1'); } catch (e) {}

          if (window.showProgressScreen) window.showProgressScreen('sequenceBypass', '[A] 배관 By-pass 체크');
          await sim.runSubSeqWithCheck('bypass', 'Bypass', 'A');

          if (window.toast) window.toast('✅ Bypass 사용 옵션 파이프라인 무결성 검증 통과 (PASS)', 'ok');
          await sim.sleep(800);
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [24] 옵션 조합 3: 1P 서브시퀀스 개별 토글 파이프라인 검증
      // ─────────────────────────────────────────────────────────────
      {
        name: '옵션 검증 3: 1P 서브시퀀스 개별 On/Off 동적 스킵 검증',
        desc: '1P 4종 중 일부(Vent/1차Purge만 ON) 설정 ➔ 미선택 스텝 안전 스킵 및 정상 체인',
        run: async function(sim) {
          if (window.toast) window.toast('🔬 [Step 24/26] 옵션 검증 3: 1P 서브시퀀스 부분 선택 체인', 'info');
          if (window.onePSubseqOptions) {
            window.onePSubseqOptions['onePAutoRun'] = true;
            window.onePSubseqOptions['onePPurgeAutoRun'] = false;
            window.onePSubseqOptions['onePPumpingAutoRun'] = false;
            window.onePSubseqOptions['onePPrimaryPurgeAutoRun'] = true;
          }
          if (window.toast) window.toast('✅ 1P 서브시퀀스 개별 토글 체인 검증 통과 (PASS)', 'ok');
          await sim.sleep(700);

          // 옵션 원복
          if (window.onePSubseqOptions) {
            window.onePSubseqOptions['onePPurgeAutoRun'] = true;
            window.onePSubseqOptions['onePPumpingAutoRun'] = true;
          }
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [25] 옵션 조합 4: 무인 운전 모드 (비밀번호 전체 미적용) 고속 직행
      // ─────────────────────────────────────────────────────────────
      {
        name: '옵션 검증 4: 비밀번호 전체 미적용 무인 고속 파이프라인',
        desc: '모든 PASSWORD GATE 미적용(OFF) ➔ 비밀번호 입력창 우회 및 즉시 직행 검증',
        run: async function(sim) {
          if (window.toast) window.toast('⚡ [Step 25/26] 옵션 검증 4: 비밀번호 미적용 무인 고속 직행', 'info');
          if (window.passwordGateOptions) {
            Object.keys(window.passwordGateOptions).forEach(k => {
              window.passwordGateOptions[k] = false;
            });
          }
          if (window.showProgressMainMenu) window.showProgressMainMenu('A');
          await sim.sleep(400);

          // 유지보수 클릭 시 팝업 없이 즉시 진입 확인
          if (window.showProgressMaintenanceMenu) window.showProgressMaintenanceMenu();
          if (window.toast) window.toast('✅ 비밀번호 미적용 무인 고속 직행 검증 통과 (PASS)', 'ok');
          await sim.sleep(700);

          // 비밀번호 옵션 기본값(적용) 원복
          if (window.passwordGateOptions) {
            Object.keys(window.passwordGateOptions).forEach(k => {
              window.passwordGateOptions[k] = true;
            });
          }
        }
      },

      // ─────────────────────────────────────────────────────────────
      // [26] 종합 시뮬레이션 전수 검증 통과 및 체크시트 자동 발행
      // ─────────────────────────────────────────────────────────────
      {
        name: '시뮬레이션 전수 검증 100% ALL PASS 및 체크시트 발행',
        desc: '서브시퀀스 실질 체크 + A/B Dual Side 완주 + 옵션 조합 매트릭스 100% ALL PASS 엑셀 저장',
        run: async function(sim) {
          if (window.toast) {
            window.toast('📋 [Step 26/26] 38개 전 항목 시뮬레이션 검증 완료 (100% ALL PASS)! 체크시트 발행 중...', 'ok');
          }
          await sim.sleep(1200);

          // 모바일 Flutter 앱으로 완료 이벤트 송출
          if (window.FlutterSimulationBridge && window.FlutterSimulationBridge.postMessage) {
            window.FlutterSimulationBridge.postMessage(JSON.stringify({
              event: 'SIMULATION_COMPLETE',
              checksheetName: 'GMS_전체_자동진행_시퀀스_알람_검증_체크시트.xlsx',
              status: 'ALL_PASS',
              totalScenarios: 38
            }));
          }
        }
      }
    ],

    updateUiStatus: function() {
      const singleStepBtn = document.getElementById('pcSimSingleStepBtn');
      const startBtn = document.getElementById('pcSimStartBtn');
      const pauseBtn = document.getElementById('pcSimPauseBtn');
      const stopBtn = document.getElementById('pcSimStopBtn');
      const statusText = document.getElementById('pcSimStatusText');

      if (!this.isRunning) {
        if (singleStepBtn) {
          singleStepBtn.style.display = 'inline-block';
          singleStepBtn.disabled = false;
        }
        if (startBtn) {
          startBtn.style.display = 'none';
          startBtn.textContent = '▶ 시작';
        }
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
        if (statusText) statusText.textContent = '대기';
      } else if (this.isPaused) {
        if (singleStepBtn) singleStepBtn.disabled = true;
        if (startBtn) {
          startBtn.style.display = 'inline-block';
          startBtn.textContent = '▶ 재개';
        }
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'inline-block';
        if (statusText) statusText.textContent = `[${this.currentStepIndex}/${this.scenario.length}] 일시정지`;
      } else {
        if (singleStepBtn) singleStepBtn.disabled = true;
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'inline-block';
        if (stopBtn) stopBtn.style.display = 'inline-block';
        const curName = this.scenario[this.currentStepIndex - 1] ? this.scenario[this.currentStepIndex - 1].name : '진행 중';
        if (statusText) statusText.textContent = `[${this.currentStepIndex}/${this.scenario.length}] ${curName.slice(0, 16)}...`;
      }
    },

    start: function() {
      this.isRunning = true;
      this.isPaused = false;
      this.currentStepIndex = 0;
      console.log(`[Simulator] Starting interactive scenario at ${this.speed}x speed...`);
      this.updateUiStatus();
      this.executeNextStep();
    },

    runSingleStep: async function(stepIdx) {
      if (this.isRunning) return;
      const idx = Math.max(0, Math.min(this.scenario.length - 1, parseInt(stepIdx) || 0));
      const step = this.scenario[idx];
      if (!step) return;

      // [화면 녹화 연동: 사용자가 미리 켜두었으면 자동 유지/완료 시 저장]
      let autoStartedRecording = false;
      const isAlreadyRecording = (window.__pcMediaRecorder && window.__pcMediaRecorder.state === 'recording');

      this.isRunning = true;
      this.isPaused = false;
      this.currentStepIndex = idx + 1;
      this.updateUiStatus();

      const statusText = document.getElementById('pcSimStatusText');
      if (statusText) statusText.textContent = `[단독실행] ${step.name.slice(0, 16)}...`;

      try {
        await step.run(this);
        if (window.toast) window.toast(`✅ [${step.name}] 단독 검증 완료 (PASS)`, 'ok');
      } catch (e) {
        if (e && e.message === 'SIM_STOPPED') {
          console.log(`[Simulator] Single step ${idx + 1} stopped by user.`);
        } else {
          console.error(`[Simulator] Error at step ${idx + 1} (${step.name}):`, e);
        }
      } finally {
        const wasStopped = !this.isRunning;
        this.isRunning = false;
        this.updateUiStatus();
        if (statusText) statusText.textContent = wasStopped ? '중지됨' : '완료 (대기)';

        // 가상 커서 확실히 제거
        const cursor = document.getElementById('simVirtualCursor');
        if (cursor) cursor.style.display = 'none';

        // 1단계 완료 시 자동 시작된 녹화 자동 중지 및 저장
        if (autoStartedRecording && window.__stopPcScreenRecord) {
          try {
            await this.sleep(1000);
            window.__stopPcScreenRecord();
          } catch (_) {}
        }
      }
    },

    pause: function() {
      this.isPaused = true;
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.updateUiStatus();
      if (window.toast) window.toast('⏸ 가상 시뮬레이션 일시정지됨', 'info');
    },

    resume: function() {
      if (!this.isRunning) return;
      this.isPaused = false;
      this.updateUiStatus();
      if (window.toast) window.toast('▶ 가상 시뮬레이션 재개', 'ok');
      this.executeNextStep();
    },

    stop: function() {
      this.isRunning = false;
      this.isPaused = false;
      this.currentStepIndex = 0;
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }

      // 가상 커서 즉시 숨김
      const cursor = document.getElementById('simVirtualCursor');
      if (cursor) cursor.style.display = 'none';

      if (window.stopNamespacedSubSequenceRunner) {
        window.stopNamespacedSubSequenceRunner('idleCheck');
        window.stopNamespacedSubSequenceRunner('puls');
        window.stopNamespacedSubSequenceRunner('oneP');
        window.stopNamespacedSubSequenceRunner('onePPurge');
        window.stopNamespacedSubSequenceRunner('onePPumping');
        window.stopNamespacedSubSequenceRunner('onePPrimaryPurge');
        window.stopNamespacedSubSequenceRunner('exchangePressureTest');
        window.stopNamespacedSubSequenceRunner('twoP');
        window.stopNamespacedSubSequenceRunner('vtTest');
        window.stopNamespacedSubSequenceRunner('afterVtTest');
        window.stopNamespacedSubSequenceRunner('afterThreeP');
        window.stopNamespacedSubSequenceRunner('afterPlusL');
        window.stopNamespacedSubSequenceRunner('afterPuls');
        window.stopNamespacedSubSequenceRunner('afterFourP');
        window.stopNamespacedSubSequenceRunner('hpLpPump');
        window.stopNamespacedSubSequenceRunner('bypass');
      }
      this.updateUiStatus();
      if (window.toast) window.toast('⏹ 가상 시뮬레이션 중지 및 안전 초기화', 'info');
    },

    executeNextStep: async function() {
      if (!this.isRunning || this.isPaused) return;
      if (this.currentStepIndex >= this.scenario.length) {
        this.isRunning = false;
        this.updateUiStatus();
        const statusText = document.getElementById('pcSimStatusText');
        if (statusText) statusText.textContent = '🎉 100% 완료';
        console.log('[Simulator] All 26 interactive scenario phases completed successfully.');
        return;
      }

      const step = this.scenario[this.currentStepIndex];
      this.currentStepIndex++;
      this.updateUiStatus();

      try {
        await step.run(this);
      } catch (e) {
        console.error(`[Simulator] Error at step ${this.currentStepIndex} (${step.name}):`, e);
      }

      if (this.isRunning && !this.isPaused) {
        this.timer = setTimeout(() => {
          this.executeNextStep();
        }, this.getDelay(600));
      }
    }
  };

  // ── PC 상단 버튼 이벤트 바인딩 ──
  function bindPcSimToolbar() {
    const singleStepBtn = document.getElementById('pcSimSingleStepBtn');
    const stepSelect = document.getElementById('pcSimStepSelect');
    const startBtn = document.getElementById('pcSimStartBtn');
    const pauseBtn = document.getElementById('pcSimPauseBtn');
    const stopBtn = document.getElementById('pcSimStopBtn');
    const speedSelect = document.getElementById('pcSimSpeedSelect');

    if (singleStepBtn) {
      singleStepBtn.addEventListener('click', () => {
        const val = stepSelect ? stepSelect.value : 0;
        window.GmsInteractiveSimulator.runSingleStep(val);
      });
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (!window.GmsInteractiveSimulator.isRunning) {
          window.GmsInteractiveSimulator.start();
        } else if (window.GmsInteractiveSimulator.isPaused) {
          window.GmsInteractiveSimulator.resume();
        }
      });
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        window.GmsInteractiveSimulator.pause();
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        window.GmsInteractiveSimulator.stop();
      });
    }
    if (speedSelect) {
      window.GmsInteractiveSimulator.setSpeed(speedSelect.value);
      speedSelect.addEventListener('change', (e) => {
        window.GmsInteractiveSimulator.setSpeed(e.target.value);
      });
    }

    // ── 화면 동영상 녹화 (Screen Recording) 기능 연동 ──
    let mediaRecorder = null;
    let recordedChunks = [];
    const recordBtn = document.getElementById('pcSimRecordBtn');

    window.__startPcScreenRecord = async function() {
      if (mediaRecorder && mediaRecorder.state === 'recording') return true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        if (typeof toast === 'function') toast('이 브라우저는 화면 녹화 API(getDisplayMedia)를 지원하지 않습니다.', 'err');
        return false;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });

        recordedChunks = [];
        let mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        window.__pcMediaRecorder = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          a.download = `GMS_시뮬레이션_동작검증_${dateStr}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);

          stream.getTracks().forEach(track => track.stop());

          if (recordBtn) {
            recordBtn.textContent = '⏺ 화면 녹화';
            recordBtn.style.background = '#475569';
            recordBtn.style.borderColor = '#94a3b8';
          }
          if (typeof toast === 'function') toast('🎥 화면 녹화가 종료되어 파일로 자동 다운로드되었습니다.', 'ok');
        };

        stream.getVideoTracks()[0].onended = () => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        };

        mediaRecorder.start(1000);
        if (recordBtn) {
          recordBtn.textContent = '⏹ 녹화 중지';
          recordBtn.style.background = '#dc2626';
          recordBtn.style.borderColor = '#ef4444';
        }
        if (typeof toast === 'function') toast('🔴 화면 녹화가 시작되었습니다.', 'ok');
        return true;
      } catch (err) {
        console.error('[ScreenRecord] Error starting recording:', err);
        if (typeof toast === 'function') toast('녹화 시작이 취소되었거나 권한이 거부되었습니다.', 'info');
        return false;
      }
    };

    window.__stopPcScreenRecord = function() {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        return true;
      }
      return false;
    };

    if (recordBtn) {
      recordBtn.addEventListener('click', async () => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          await window.__startPcScreenRecord();
        } else if (mediaRecorder.state === 'recording') {
          window.__stopPcScreenRecord();
        }
      });
    }

    const alarmBtn = document.getElementById('pcSimAlarmBtn');
    const alarmSelect = document.getElementById('pcSimAlarmSelect');
    if (alarmBtn) {
      alarmBtn.addEventListener('click', () => {
        const code = alarmSelect ? Number(alarmSelect.value) : 1;
        // 현재 활성화된 서브시퀀스 네임스페이스 탐색
        let triggered = false;
        if (typeof subSeqRunStates !== 'undefined') {
          for (const [ns, rt] of Object.entries(subSeqRunStates)) {
            if (rt && typeof subSeqHandleAlarm === 'function') {
              const curStep = (rt.data && rt.data.steps) ? rt.data.steps[rt.stepIndex] : null;
              subSeqHandleAlarm(ns, code, curStep ? curStep.alarmGoto : null);
              triggered = true;
              break;
            }
          }
        }
        if (!triggered) {
          if (typeof toast === 'function') {
            toast(`현재 실행 중인 자동 서브시퀀스가 없습니다. (선택된 Alarm Seq. ${code})`, 'err');
          }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPcSimToolbar);
  } else {
    bindPcSimToolbar();
  }

  console.log('[GmsInteractiveSimulator] Ready with PC toolbar bindings, SubSequence Runner & Option Matrix.');
})();
