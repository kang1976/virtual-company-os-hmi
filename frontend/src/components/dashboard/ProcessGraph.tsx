import React, { useState } from 'react';
import {
  Crown,
  BrainCircuit,
  Layers,
  Code2,
  ShieldCheck,
  Megaphone,
  ChevronRight,
  X,
} from 'lucide-react';
import type { TaskItem } from '../../types';

export interface ProcessStageNode {
  id: string;
  stageNumber: number;
  title: string;
  subtitle: string;
  agents: string[];
  icon: React.ElementType;
  color: string;
  borderColor: string;
  accentBg: string;
  description: string;
}

const STAGES: ProcessStageNode[] = [
  {
    id: 'stage-1',
    stageNumber: 1,
    title: 'CEO 지시 하달',
    subtitle: '명령 발의 및 방향성 수립',
    agents: ['CEO (대표이사)'],
    icon: Crown,
    color: 'text-amber-500',
    borderColor: 'border-amber-500',
    accentBg: 'bg-amber-500/10',
    description: '대표님의 자연어 비즈니스 목표를 수신하여 전사 가상 오피스 파이프라인을 기동합니다.',
  },
  {
    id: 'stage-2',
    stageNumber: 2,
    title: 'COO 전략 분해',
    subtitle: 'WBS 수립 & 우선순위 책정',
    agents: ['COO (최고운영책임자)'],
    icon: BrainCircuit,
    color: 'text-indigo-500',
    borderColor: 'border-indigo-500',
    accentBg: 'bg-indigo-500/10',
    description: 'CEO 지시를 20대 전문 에이전트별 단위 태스크와 책임 규격으로 자동 분해하고 일정을 조율합니다.',
  },
  {
    id: 'stage-3',
    stageNumber: 3,
    title: '특허 및 아키텍처 기획',
    subtitle: 'FTO 선행조사 & 클린설계',
    agents: ['변리사', '수석 아키텍트', 'UX 아키텍트'],
    icon: Layers,
    color: 'text-purple-500',
    borderColor: 'border-purple-500',
    accentBg: 'bg-purple-500/10',
    description: '글로벌 3개국 특허 침해(FTO) 분석과 회피 설계를 수립하고, 클린 아키텍처와 반응형 UI 명세를 확정합니다.',
  },
  {
    id: 'stage-4',
    stageNumber: 4,
    title: '기술개발 엔지니어링',
    subtitle: '풀스택 & 크로스플랫폼 구현',
    agents: ['프론트엔드', '백엔드', '모바일', 'PLC펌웨어', 'DB', 'DevOps'],
    icon: Code2,
    color: 'text-blue-500',
    borderColor: 'border-blue-500',
    accentBg: 'bg-blue-500/10',
    description: 'React, FastAPI, Flutter, Omron PLC FINS 통신 프로토콜 코드를 병렬 작성하고 정밀 패치합니다.',
  },
  {
    id: 'stage-5',
    stageNumber: 5,
    title: '2단계 다층 보안·품질 심사',
    subtitle: 'OWASP / 제로트러스트 / 50대 엣지테스트',
    agents: ['수석 보안', '품질보증 QA', '심층 SecOps', '총괄 Senior QA'],
    icon: ShieldCheck,
    color: 'text-teal-500',
    borderColor: 'border-teal-500',
    accentBg: 'bg-teal-500/10',
    description: '1차 보안/기능 검수 후 2차 산업제어망 제로트러스트 모의 침투 및 엣지 케이스 극한 부하를 최종 인가합니다.',
  },
  {
    id: 'stage-6',
    stageNumber: 6,
    title: 'B2B 상품화 & 마케팅 릴리즈',
    subtitle: '카탈로그 / 매뉴얼 / COO 최종 감사',
    agents: ['상품화 마케터', 'COO 품질 승인관'],
    icon: Megaphone,
    color: 'text-rose-500',
    borderColor: 'border-rose-500',
    accentBg: 'bg-rose-500/10',
    description: 'B2B 5대 USP 브로슈어와 사용자 가이드를 마크다운/원장에 동기화하고, 전사 감사 회의록을 영구 봉인합니다.',
  },
];

interface ProcessGraphProps {
  isExecuting: boolean;
  executionStage: number; // 0: IDLE, 1: CEO, 2: COO, 3: DESIGN/PATENT, 4: DEV, 5: QA1, 6: QA2/MKT, 7: CLOSED
  tasks?: TaskItem[];
  onSelectDeliverable?: (task: TaskItem) => void;
}

export const ProcessGraph: React.FC<ProcessGraphProps> = ({
  isExecuting,
  executionStage,
  tasks = [],
  onSelectDeliverable,
}) => {
  const [selectedStage, setSelectedStage] = useState<ProcessStageNode | null>(null);

  // 단계별 상태 판정 함수
  const getStageStatus = (stageNum: number) => {
    if (!isExecuting && executionStage === 0) {
      if (tasks.length > 0) {
        return { status: 'COMPLETED', label: '완료됨', color: 'bg-emerald-500', isCurrent: false };
      }
      return { status: 'IDLE', label: '대기 중', color: 'bg-slate-400', isCurrent: false };
    }

    if (executionStage === stageNum) {
      return { status: 'ACTIVE', label: '실시간 가동 중', color: 'bg-blue-500', isCurrent: true };
    }
    if (executionStage > stageNum) {
      return { status: 'COMPLETED', label: '승인 통과', color: 'bg-emerald-500', isCurrent: false };
    }
    return { status: 'QUEUED', label: '대기열', color: 'bg-slate-400', isCurrent: false };
  };

  // 전체 진척률 계산 (0 ~ 100%)
  const progressPercent = Math.min(
    100,
    isExecuting
      ? Math.round((executionStage / 6) * 100)
      : tasks.length > 0
      ? 100
      : 0
  );

  return (
    <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg backdrop-blur-sm transition-colors relative overflow-hidden">
      {/* 상단 헤더 및 실시간 진척도 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
              <BrainCircuit className="w-5 h-5" />
            </span>
            <h2 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
              CEO 실시간 오케스트레이션 공정 그래프 (Process Flow Graph)
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            대표님 지시가 20대 전문 에이전트 간에 인계되며 검증되는 6단계 전사 공정 파이프라인
          </p>
        </div>

        {/* 종합 진척률 게이지 바 */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-right">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
              전체 공정 진척도
            </span>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {progressPercent}%
            </span>
          </div>
          <div className="w-32 sm:w-44 bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700">
            <div
              className="bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500 h-full transition-all duration-500 rounded-full relative"
              style={{ width: `${progressPercent}%` }}
            >
              {isExecuting && (
                <div className="absolute inset-0 bg-white/30 animate-[shimmer_1.5s_infinite] w-full" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6단계 노드 파이프라인 그래프 (데스크톱: 가로 연결선, 모바일: 그리드) */}
      <div className="relative">
        {/* 배경 연결 라인 (데스크톱) */}
        <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-1 -translate-y-1/2 bg-slate-200 dark:bg-slate-800 z-0" />
        {/* 진행 완료 연결 라인 (데스크톱) */}
        <div
          className="hidden lg:block absolute top-1/2 left-8 h-1 -translate-y-1/2 bg-indigo-500 transition-all duration-500 z-0"
          style={{
            width: `${Math.max(0, (progressPercent / 100) * 85)}%`,
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 relative z-10">
          {STAGES.map((stage) => {
            const { status, label, isCurrent } = getStageStatus(stage.stageNumber);
            const Icon = stage.icon;
            const isCompleted = status === 'COMPLETED';

            return (
              <div
                key={stage.id}
                onClick={() => setSelectedStage(stage)}
                className={`group relative rounded-xl p-3 sm:p-3.5 border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/20 scale-[1.02]'
                    : isCompleted
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/70 hover:border-emerald-500'
                    : 'bg-white dark:bg-slate-950/60 border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
              >
                {/* 상단 단계 번호 및 펄스 뱃지 */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      isCurrent
                        ? 'bg-blue-600 text-white animate-pulse'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isCompleted ? '✓' : stage.stageNumber}
                  </span>

                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      isCurrent
                        ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />}
                    {label}
                  </span>
                </div>

                {/* 노드 아이콘 및 타이틀 */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`p-1.5 rounded-lg ${stage.accentBg} ${stage.color} shrink-0`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-1">
                    {stage.title}
                  </h3>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2 font-medium">
                  {stage.subtitle}
                </p>

                {/* 하단 에이전트 참여 뱃지 */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 dark:text-slate-400 truncate max-w-[85px]">
                    {stage.agents[0]} {stage.agents.length > 1 && `외 ${stage.agents.length - 1}인`}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 단계 상세 모달 (클릭 시 팝업) */}
      {selectedStage && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <selectedStage.icon className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      STEP {selectedStage.stageNumber}
                    </span>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                      {selectedStage.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedStage.subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStage(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">공정 개요</h4>
                <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed">
                  {selectedStage.description}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1.5">투입 전문 에이전트</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStage.agents.map((agent, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-medium"
                    >
                      {agent}
                    </span>
                  ))}
                </div>
              </div>

              {/* 연관된 실제 태스크 리스트 */}
              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1.5">실행 장부 태스크 연동</h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {tasks.length === 0 ? (
                    <div className="p-2.5 text-center text-slate-400 bg-slate-50 dark:bg-slate-950 rounded-lg">
                      등록된 실행 태스크가 없습니다.
                    </div>
                  ) : (
                    tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          if (onSelectDeliverable) {
                            onSelectDeliverable(t);
                            setSelectedStage(null);
                          }
                        }}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                          {t.title}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
                          {t.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedStage(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
