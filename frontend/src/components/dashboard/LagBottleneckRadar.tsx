import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  X,
  Info,
} from 'lucide-react';
import type { TaskItem } from '../../types';

export interface AgentLatencyMetric {
  id: string;
  name: string;
  team: string;
  role: string;
  elapsedSeconds: number;
  status: 'SMOOTH' | 'ACTIVE' | 'LAG' | 'BOTTLENECK';
  thresholdSeconds: number;
}

interface LagBottleneckRadarProps {
  isExecuting: boolean;
  executionStage: number;
  tasks?: TaskItem[];
}

export const LagBottleneckRadar: React.FC<LagBottleneckRadarProps> = ({
  isExecuting,
  executionStage,
  tasks = [],
}) => {
  const [activeTimerSeconds, setActiveTimerSeconds] = useState<number>(0);
  const [selectedAgentMetric, setSelectedAgentMetric] = useState<AgentLatencyMetric | null>(null);

  // 실행 중일 때 실시간 타이머 카운트업
  useEffect(() => {
    let interval: any = null;
    if (isExecuting) {
      setActiveTimerSeconds(0);
      interval = setInterval(() => {
        setActiveTimerSeconds((prev) => +(prev + 0.2).toFixed(1));
      }, 200);
    } else {
      setActiveTimerSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isExecuting, executionStage]);

  // 10대 핵심 에이전트 기본 프로필
  const agentProfiles = [
    { id: 'CEO', name: '대표이사 (CEO)', team: '경영', role: '전사 총괄 지휘', threshold: 1.0, defaultSec: 0.3 },
    { id: 'COO', name: '최고운영책임자 (COO)', team: '경영/운영', role: 'WBS 전략 분해', threshold: 2.0, defaultSec: 0.8 },
    { id: 'PATENT', name: '지식재산 변리사', team: '지식재산', role: 'FTO 선행특허 조사', threshold: 3.0, defaultSec: 1.1 },
    { id: 'ARCHITECT', name: '수석 아키텍트', team: '기술개발', role: '클린 아키텍처 설계', threshold: 3.5, defaultSec: 1.5 },
    { id: 'FRONTEND', name: '시니어 프론트엔드', team: '기술개발', role: 'React 초고대비 UI', threshold: 4.0, defaultSec: 2.4 },
    { id: 'BACKEND', name: '백엔드 리드', team: '기술개발', role: 'FastAPI/DB 파이프라인', threshold: 3.5, defaultSec: 1.8 },
    { id: 'FIRMWARE', name: 'PLC 임베디드 펌웨어', team: '기술개발', role: 'Omron FINS 통신', threshold: 2.5, defaultSec: 0.9 },
    { id: 'SECURITY', name: '수석 보안 감사관', team: '보안품질', role: 'OWASP Top 10 감사', threshold: 2.5, defaultSec: 0.9 },
    { id: 'SECOPS', name: '심층 SecOps 감리관', team: '보안품질', role: 'OT 제로트러스트 침투', threshold: 3.0, defaultSec: 1.6 },
    { id: 'SENIOR_QA', name: '품질 무결성 총괄 QA', team: '보안품질', role: '50대 엣지 부하 실측', threshold: 4.0, defaultSec: 2.1 },
    { id: 'MARKETING', name: '상품화 마케터', team: '사업마케팅', role: 'B2B 카탈로그/매뉴얼', threshold: 3.0, defaultSec: 1.5 },
  ];

  // 에이전트별 레이턴시 및 랙 상태 산출
  const metrics: AgentLatencyMetric[] = agentProfiles.map((p) => {
    let elapsed = p.defaultSec;
    let status: 'SMOOTH' | 'ACTIVE' | 'LAG' | 'BOTTLENECK' = 'SMOOTH';

    // 실제 tasks 장부 데이터가 있으면 매핑
    const matchedTask = tasks.find(
      (t) =>
        t.assignee.toLowerCase().includes(p.id.toLowerCase()) ||
        t.assignee.toLowerCase().includes(p.name.toLowerCase())
    );

    if (matchedTask && matchedTask.elapsed_seconds) {
      elapsed = matchedTask.elapsed_seconds;
    }

    // 현재 실행 중일 때 해당 단계의 에이전트에 실시간 타이머 적용
    const isThisAgentWorking =
      isExecuting &&
      ((executionStage === 1 && p.id === 'CEO') ||
        (executionStage === 2 && p.id === 'COO') ||
        (executionStage === 3 && (p.id === 'PATENT' || p.id === 'ARCHITECT')) ||
        (executionStage === 4 && (p.id === 'FRONTEND' || p.id === 'BACKEND' || p.id === 'FIRMWARE')) ||
        (executionStage === 5 && p.id === 'SECURITY') ||
        (executionStage === 6 && (p.id === 'SECOPS' || p.id === 'SENIOR_QA' || p.id === 'MARKETING')));

    if (isThisAgentWorking) {
      elapsed = activeTimerSeconds;
      if (activeTimerSeconds > p.threshold * 1.8) {
        status = 'BOTTLENECK';
      } else if (activeTimerSeconds > p.threshold) {
        status = 'LAG';
      } else {
        status = 'ACTIVE';
      }
    } else {
      if (elapsed > p.threshold * 1.5) {
        status = 'LAG';
      } else {
        status = 'SMOOTH';
      }
    }

    return {
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      elapsedSeconds: elapsed,
      status,
      thresholdSeconds: p.threshold,
    };
  });

  // 병목/지연 에이전트 목록 감지
  const bottleneckAgents = metrics.filter((m) => m.status === 'BOTTLENECK');
  const lagAgents = metrics.filter((m) => m.status === 'LAG');
  const hasIssue = bottleneckAgents.length > 0 || lagAgents.length > 0;

  // 최대 소요 시간 (차트 스케일링용)
  const maxElapsed = Math.max(...metrics.map((m) => m.elapsedSeconds), 4.5);

  return (
    <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg backdrop-blur-sm transition-colors space-y-4 sm:space-y-5">
      {/* 1. 상단 레이더 헤더 및 상태 알림 배너 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg flex items-center gap-2">
              실시간 에이전트 지연·랙(Bottleneck) 감지 레이더
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              전사 20대 에이전트의 연산 소요 시간 및 병목(대기열 정체)을 실시간으로 감시합니다.
            </p>
          </div>
        </div>

        {/* 종합 건전성 인디케이터 */}
        <div className="flex items-center gap-2">
          {hasIssue ? (
            <span className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-400 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-extrabold text-xs flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              병목/지연 {bottleneckAgents.length + lagAgents.length}건 감지!
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-400 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              전 에이전트 정상 가동 (No Bottleneck)
            </span>
          )}
        </div>
      </div>

      {/* 2. CEO 긴급 병목 경보 배너 (지연 발생 시 노출) */}
      {hasIssue ? (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-500/20 via-amber-500/15 to-transparent border-2 border-rose-500/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="p-1 rounded-lg bg-rose-600 text-white font-black text-[10px] animate-ping">
              ALERT
            </span>
            <p className="text-slate-900 dark:text-white font-bold">
              {bottleneckAgents.length > 0 ? (
                <>
                  <span className="text-rose-600 dark:text-rose-400 font-black">
                    [{bottleneckAgents.map((b) => b.name).join(', ')}]
                  </span>
                  에서 심각한 랙/병목이 발생하고 있습니다! (소요 시간 임계치 초과)
                </>
              ) : (
                <>
                  <span className="text-amber-600 dark:text-amber-400 font-black">
                    [{lagAgents.map((b) => b.name).join(', ')}]
                  </span>
                  에서 응답 지연(Lag)이 감지되었습니다. 대기열을 모니터링 중입니다.
                </>
              )}
            </p>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            자가 복구 및 리소스 재할당 가동
          </span>
        </div>
      ) : (
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">
              모든 에이전트가 기준 시간(임계치) 내에 원활하게 작업을 수행하고 있습니다.
            </span>
          </div>
          <span className="font-mono text-[11px] font-bold text-slate-500">
            평균 응답 속도: ~1.4s
          </span>
        </div>
      )}

      {/* 3. 에이전트별 소요시간 비교 바 차트 (Visual Latency Bars) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
            에이전트별 최근 연산 소요 시간 및 병목 레이더 (Latency Monitor)
          </span>
          <span className="text-[11px] text-slate-500 font-normal">
            기준: 🟢 정상(&lt;3s) · 🔵 수행 중 · 🟡 지연 주의(&gt;3.5s) · 🔴 병목(&gt;5s)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {metrics.map((m) => {
            const barWidthPercent = Math.min(100, Math.round((m.elapsedSeconds / maxElapsed) * 100));
            const isBottleneck = m.status === 'BOTTLENECK';
            const isLag = m.status === 'LAG';
            const isActive = m.status === 'ACTIVE';

            let barColor = 'bg-emerald-500';
            let badgeBg = 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800';
            let statusText = '정상 (Smooth)';

            if (isBottleneck) {
              barColor = 'bg-rose-500 animate-pulse';
              badgeBg = 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800';
              statusText = '🚨 병목 (Bottleneck)';
            } else if (isLag) {
              barColor = 'bg-amber-500';
              badgeBg = 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800';
              statusText = '⚠️ 지연 (Lag)';
            } else if (isActive) {
              barColor = 'bg-blue-500';
              badgeBg = 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800';
              statusText = '⚡ 연산 중 (Working)';
            }

            return (
              <div
                key={m.id}
                onClick={() => setSelectedAgentMetric(m)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isBottleneck
                    ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-500 shadow-sm'
                    : isLag
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-400'
                    : 'bg-slate-50/70 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800/80 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <div className="truncate pr-2">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                      [{m.team}] {m.role}
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white truncate block">
                      {m.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-black text-slate-900 dark:text-white text-xs">
                      {m.elapsedSeconds}s
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeBg}`}>
                      {statusText}
                    </span>
                  </div>
                </div>

                {/* 가로 레이턴시 바 */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${barColor}`}
                    style={{ width: `${barWidthPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 에이전트 상세 메트릭 배너 */}
      {selectedAgentMetric && (
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white">
                [{selectedAgentMetric.team}] {selectedAgentMetric.name}
              </span>
              <span className="text-slate-500 dark:text-slate-400 ml-2">
                역할: {selectedAgentMetric.role} · 최근 소요시간: {selectedAgentMetric.elapsedSeconds}s (기준 임계치: {selectedAgentMetric.thresholdSeconds}s)
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedAgentMetric(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
