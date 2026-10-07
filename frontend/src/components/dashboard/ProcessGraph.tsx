// frontend/src/components/dashboard/ProcessGraph.tsx
import React, { useState } from 'react';
import {
  Crown,
  BrainCircuit,
  Layers,
  Code2,
  ShieldCheck,
  Megaphone,
  X,
  Sparkles,
} from 'lucide-react';
import type { TaskItem } from '../../types';

export type WorkflowMode = 'mobile_design' | 'enterprise_full' | 'plc_backend';

export interface WorkflowNode {
  id: string;
  stageNumber: number;
  title: string;
  subtitle: string;
  agents: string[];
  icon: React.ElementType;
  themeColor: string;
  borderColor: string;
  accentBg: string;
  progressColor: string;
  x: number;
  y: number;
  w: number;
  h: number;
  description: string;
}

interface ProcessGraphProps {
  isExecuting?: boolean;
  executionStage?: number; // 0: IDLE, 1: CEO, 2: COO, 3: DESIGN, 4: DEV, 5: QA, 6: FINISH
  tasks?: TaskItem[];
  onSelectDeliverable?: (task: TaskItem) => void;
  currentMode?: WorkflowMode;
}

export const ProcessGraph: React.FC<ProcessGraphProps> = ({
  isExecuting = false,
  executionStage = 0,
  tasks = [],
  onSelectDeliverable,
  currentMode: initialMode = 'mobile_design',
}) => {
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(initialMode);

  // 1. 모바일 디자인 전용 파이프라인 (특허/백엔드/마케팅 제외한 5단계 집중 플로우)
  const mobileDesignNodes: WorkflowNode[] = [
    {
      id: 'm-node-ceo',
      stageNumber: 1,
      title: 'CEO 모바일 지시',
      subtitle: '모바일 화면 UI/UX 개편',
      agents: ['CEO (대표이사)'],
      icon: Crown,
      themeColor: '#D97706',
      borderColor: 'border-amber-500',
      accentBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      progressColor: 'bg-amber-500',
      x: 20,
      y: 105,
      w: 165,
      h: 96,
      description: '대표님의 모바일 전용 UI 수정 및 뷰포트 최적화 지시를 수신합니다.',
    },
    {
      id: 'm-node-coo',
      stageNumber: 2,
      title: 'COO 모바일 WBS 분해',
      subtitle: '터치/반응형 세부 과업 할당',
      agents: ['COO (최고운영책임자)'],
      icon: BrainCircuit,
      themeColor: '#6366F1',
      borderColor: 'border-indigo-500',
      accentBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      progressColor: 'bg-indigo-500',
      x: 220,
      y: 105,
      w: 180,
      h: 96,
      description: '모바일 360~430px 반응형, 44px 터치 타깃, 고대비 테마 과업을 분해합니다.',
    },
    {
      id: 'm-node-design',
      stageNumber: 3,
      title: '모바일 UI/UX 디자인 감리',
      subtitle: '상단 툴바 정리 & 초고대비',
      agents: ['수석 디자인 디렉터', 'UX 아키텍트'],
      icon: Sparkles,
      themeColor: '#EC4899',
      borderColor: 'border-pink-500',
      accentBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
      progressColor: 'bg-pink-500',
      x: 435,
      y: 105,
      w: 185,
      h: 96,
      description: '복잡한 툴바 제거, 컴팩트 정보바 및 가독성 100% 감리를 수행합니다.',
    },
    {
      id: 'm-node-builder',
      stageNumber: 4,
      title: '모바일 앱 빌더 구현',
      subtitle: 'Flutter / HMI 모바일 최적화',
      agents: ['모바일 앱 빌더', '프론트엔드 개발자'],
      icon: Code2,
      themeColor: '#3B82F6',
      borderColor: 'border-blue-500',
      accentBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      progressColor: 'bg-blue-500',
      x: 655,
      y: 105,
      w: 185,
      h: 96,
      description: '스마트폰 뷰포트 맞춤 레이아웃 및 직결 통신 화면을 핀포인트 코딩합니다.',
    },
    {
      id: 'm-node-qa',
      stageNumber: 5,
      title: '모바일 UI 마감 & 독립 QA',
      subtitle: '실기기 터치 & 시인성 승인',
      agents: ['UI 마감 감리관', '품질 QA'],
      icon: ShieldCheck,
      themeColor: '#10B981',
      borderColor: 'border-emerald-500',
      accentBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      progressColor: 'bg-emerald-500',
      x: 875,
      y: 105,
      w: 175,
      h: 96,
      description: '글자 잘림 0건, 터치 오작동 제로 검증 후 COO 최종 승인을 마감합니다.',
    },
  ];

  // 2. 전사 종합 R&D 파이프라인 (특허 + 풀스택 + 보안 + 상품화 7단계)
  const enterpriseNodes: WorkflowNode[] = [
    {
      id: 'node-ceo',
      stageNumber: 1,
      title: 'CEO 지시 하달',
      subtitle: '자연어 비즈니스 목표',
      agents: ['CEO (대표이사)'],
      icon: Crown,
      themeColor: '#D97706',
      borderColor: 'border-amber-500',
      accentBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      progressColor: 'bg-amber-500',
      x: 20,
      y: 105,
      w: 155,
      h: 96,
      description: '대표님의 목표 지시를 수신하여 전사 20대 자율 에이전트 오케스트레이션을 발의합니다.',
    },
    {
      id: 'node-coo',
      stageNumber: 2,
      title: 'COO 전략 총괄 분해',
      subtitle: 'WBS & 부서별 태스크 책정',
      agents: ['COO (최고운영책임자)'],
      icon: BrainCircuit,
      themeColor: '#6366F1',
      borderColor: 'border-indigo-500',
      accentBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      progressColor: 'bg-indigo-500',
      x: 215,
      y: 105,
      w: 175,
      h: 96,
      description: 'CEO 지시를 분석하여 20개 전문 에이전트 간의 역할 분담과 책임 규격을 수립합니다.',
    },
    {
      id: 'node-patent',
      stageNumber: 3,
      title: '특허 FTO 선행 조사',
      subtitle: '3개국 DB 침해분석 & 회피',
      agents: ['지식재산 총괄 변리사'],
      icon: Layers,
      themeColor: '#8B5CF6',
      borderColor: 'border-purple-500',
      accentBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      progressColor: 'bg-purple-500',
      x: 430,
      y: 25,
      w: 175,
      h: 94,
      description: 'KR/US/EP 3개국 특허를 전수 스크리닝하여 회피 설계를 개발팀에 전달합니다.',
    },
    {
      id: 'node-design',
      stageNumber: 3,
      title: 'UI/UX 디자인 감리',
      subtitle: 'VS Code 테마 & 터치 IA',
      agents: ['수석 디자인 디렉터', 'UI 마감감리관', 'UX 아키텍트'],
      icon: Sparkles,
      themeColor: '#EC4899',
      borderColor: 'border-pink-500',
      accentBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
      progressColor: 'bg-pink-500',
      x: 430,
      y: 185,
      w: 175,
      h: 94,
      description: '초고대비 다크/라이트 테마, 44px 터치 타깃, 반응형 인터페이스를 승인합니다.',
    },
    {
      id: 'node-dev',
      stageNumber: 4,
      title: '기술개발 엔지니어링',
      subtitle: 'Full-stack & PLC 펌웨어',
      agents: ['수석 아키텍트', '프론트', '백엔드', '모바일', 'PLC펌웨어', 'DB', 'DevOps'],
      icon: Code2,
      themeColor: '#3B82F6',
      borderColor: 'border-blue-500',
      accentBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      progressColor: 'bg-blue-500',
      x: 645,
      y: 105,
      w: 185,
      h: 96,
      description: 'FastAPI, React, Flutter, Omron PLC FINS 산업 통신 프로토콜을 병렬 구현합니다.',
    },
    {
      id: 'node-qa',
      stageNumber: 5,
      title: '2단계 다층 보안·품질',
      subtitle: 'OWASP / 제로트러스트 99점',
      agents: ['수석 보안', '품질 QA', 'SecOps', 'Senior QA'],
      icon: ShieldCheck,
      themeColor: '#14B8A6',
      borderColor: 'border-teal-500',
      accentBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      progressColor: 'bg-teal-500',
      x: 870,
      y: 35,
      w: 175,
      h: 94,
      description: '1차 보안/기능 통과 후 2차 산업제어망 침투 테스트 및 50대 엣지 부하를 최종 인가합니다.',
    },
    {
      id: 'node-mkt',
      stageNumber: 6,
      title: 'B2B 상품화 & 릴리즈',
      subtitle: '카탈로그 / 매뉴얼 / COO 감사',
      agents: ['상품화 마케터', 'COO 품질승인관'],
      icon: Megaphone,
      themeColor: '#F43F5E',
      borderColor: 'border-rose-500',
      accentBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      progressColor: 'bg-rose-500',
      x: 870,
      y: 180,
      w: 175,
      h: 94,
      description: 'B2B 5대 USP 카탈로그와 운용 가이드를 원장에 영구 봉인하고 전사 릴리즈합니다.',
    },
  ];

  // 활성 모드에 따른 노드 및 와이어 결정
  const isMobileMode = workflowMode === 'mobile_design';
  const nodes = isMobileMode ? mobileDesignNodes : enterpriseNodes;

  // 와이어 정의
  const mobileWires = [
    { fromX: 20 + 165, fromY: 105 + 48, toX: 220, toY: 105 + 48, active: executionStage >= 1 },
    { fromX: 220 + 180, fromY: 105 + 48, toX: 435, toY: 105 + 48, active: executionStage >= 2 },
    { fromX: 435 + 185, fromY: 105 + 48, toX: 655, toY: 105 + 48, active: executionStage >= 3 },
    { fromX: 655 + 185, fromY: 105 + 48, toX: 875, toY: 105 + 48, active: executionStage >= 4 },
  ];

  const enterpriseWires = [
    { fromX: 20 + 155, fromY: 105 + 48, toX: 215, toY: 105 + 48, active: executionStage >= 1 },
    { fromX: 215 + 175, fromY: 105 + 32, toX: 430, toY: 25 + 47, active: executionStage >= 2 },
    { fromX: 215 + 175, fromY: 105 + 64, toX: 430, toY: 185 + 47, active: executionStage >= 2 },
    { fromX: 430 + 175, fromY: 25 + 47, toX: 645, toY: 105 + 32, active: executionStage >= 3 },
    { fromX: 430 + 175, fromY: 185 + 47, toX: 645, toY: 105 + 64, active: executionStage >= 3 },
    { fromX: 645 + 185, fromY: 105 + 32, toX: 870, toY: 35 + 47, active: executionStage >= 4 },
    { fromX: 645 + 185, fromY: 105 + 64, toX: 870, toY: 180 + 47, active: executionStage >= 4 },
  ];

  const wires = isMobileMode ? mobileWires : enterpriseWires;

  // 노드별 상태 판정 함수
  const getNodeStatus = (stageNum: number) => {
    if (!isExecuting && executionStage === 0) {
      if (tasks.length > 0) {
        return { status: 'COMPLETED', label: 'OK', isRunning: false };
      }
      return { status: 'IDLE', label: '대기', isRunning: false };
    }

    if (executionStage === stageNum) {
      return { status: 'WORKING', label: '실행 중', isRunning: true };
    }
    if (executionStage > stageNum) {
      return { status: 'COMPLETED', label: 'OK', isRunning: false };
    }
    return { status: 'QUEUED', label: '대기열', isRunning: false };
  };

  // 전체 공정률
  const maxStages = isMobileMode ? 5 : 6;
  const progressPercent = Math.min(
    100,
    isExecuting
      ? Math.round((executionStage / maxStages) * 100)
      : tasks.length > 0
      ? 100
      : 0
  );

  return (
    <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg backdrop-blur-sm transition-colors space-y-4">
      {/* 상단 타이틀 바 & 작업 방식 모드 선택기 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
              <BrainCircuit className="w-5 h-5" />
            </span>
            <h2 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg flex items-center gap-2">
              실시간 비주얼 노드 공정 파이프라인 (Visual Node Flow)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            작업 방식에 따라 파이프라인이 동적으로 재구성되는 지능형 n8n 오케스트레이션 캔버스
          </p>
        </div>

        {/* 작업 방식(플로우 모드) 전환 탭 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-800 text-xs">
            <button
              onClick={() => setWorkflowMode('mobile_design')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                workflowMode === 'mobile_design'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>📱 모바일 디자인 전용</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-800 text-white font-mono">현재</span>
            </button>
            <button
              onClick={() => setWorkflowMode('enterprise_full')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                workflowMode === 'enterprise_full'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🏢 전사 종합 R&D</span>
            </button>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">공정 완수율</span>
            <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* 노드 캔버스 영역 (수평 스크롤 지원 및 베지에 곡선 와이어 연결) */}
      <div className="relative w-full overflow-x-auto scrollbar-thin py-2">
        <div className="relative min-w-[1060px] h-[305px] bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800/80 p-2">
          {/* 1. SVG 베지에 곡선 와이어 레이어 (노드 사이를 아름답게 연결) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {wires.map((wire, idx) => {
              // 부드러운 S자 베지에 곡선 계산
              const dx = (wire.toX - wire.fromX) * 0.5;
              const pathD = `M ${wire.fromX} ${wire.fromY} C ${wire.fromX + dx} ${wire.fromY}, ${wire.toX - dx} ${wire.toY}, ${wire.toX} ${wire.toY}`;
              const isWireActive = wire.active;

              return (
                <g key={idx}>
                  {/* 베이스 와이어 라인 */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isWireActive ? '#10B981' : '#94A3B8'}
                    strokeWidth={isWireActive ? '2.5' : '1.5'}
                    strokeDasharray={isWireActive ? 'none' : '4 3'}
                    strokeOpacity={isWireActive ? 0.9 : 0.4}
                    className="transition-all duration-500"
                  />
                  {/* 활성화된 라인 위의 빛 펄스 애니메이션 */}
                  {isWireActive && isExecuting && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                      strokeDasharray="8 20"
                      className="animate-[dash_1.5s_linear_infinite]"
                      strokeOpacity={0.8}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* 2. 인터랙티브 노드 카드 레이어 (레퍼런스 이미지 디자인 완벽 반영) */}
          {nodes.map((node) => {
            const { status, label, isRunning } = getNodeStatus(node.stageNumber);
            const isCompleted = status === 'COMPLETED';
            const Icon = node.icon;

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                style={{
                  position: 'absolute',
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.w}px`,
                  height: `${node.h}px`,
                }}
                className={`group rounded-xl p-3 border-2 transition-all cursor-pointer select-none bg-white dark:bg-slate-900 shadow-md flex flex-col justify-between z-10 hover:scale-[1.02] hover:shadow-lg ${
                  isRunning
                    ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-blue-500/20'
                    : isCompleted
                    ? 'border-emerald-500/80 hover:border-emerald-500'
                    : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
              >
                {/* 좌측 입력 포트 핀 (Dot) */}
                <div
                  style={{ backgroundColor: node.themeColor }}
                  className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"
                />

                {/* 우측 출력 포트 핀 (Dot) */}
                <div
                  style={{ backgroundColor: isCompleted ? '#10B981' : node.themeColor }}
                  className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"
                />

                {/* 상단 헤더: 아이콘 + 이름 + 상태 뱃지 */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: node.themeColor }} />
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                      {node.title}
                    </h3>
                  </div>

                  <span
                    className={`text-[9px] font-black px-1 py-0.2 rounded shrink-0 ${
                      isRunning
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 animate-pulse'
                        : isCompleted
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {label}
                  </span>
                </div>

                {/* 부제목 & 담당자 요약 */}
                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 font-medium">
                  {node.subtitle}
                </p>

                {/* 하단 미니 진행률 바 및 참여 인원 (레퍼런스 이미지 스타일) */}
                <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                    <span className="truncate max-w-[95px]">{node.agents[0]}</span>
                    <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                      {isCompleted ? '100%' : isRunning ? '50%' : '0%'}
                    </span>
                  </div>
                  {/* 노드 하단 진행률 바 */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted
                          ? 'bg-emerald-500 w-full'
                          : isRunning
                          ? `${node.progressColor} w-1/2 animate-pulse`
                          : 'w-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 노드 클릭 시 나타나는 원클릭 상세 모달 */}
      {selectedNode && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  style={{ backgroundColor: `${selectedNode.themeColor}20`, color: selectedNode.themeColor }}
                  className="p-2 rounded-xl"
                >
                  <selectedNode.icon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    {selectedNode.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedNode.subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">공정 설명</h4>
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 leading-relaxed border border-slate-200 dark:border-slate-800">
                  {selectedNode.description}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">배정된 에이전트</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.agents.map((agent, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/80"
                    >
                      {agent}
                    </span>
                  ))}
                </div>
              </div>

              {/* 실제 태스크 산출물 연동 */}
              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">실시간 산출물 및 태스크</h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {tasks.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 bg-slate-50 dark:bg-slate-950 rounded-xl">
                      등록된 태스크가 없습니다.
                    </div>
                  ) : (
                    tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          if (onSelectDeliverable) {
                            onSelectDeliverable(t);
                            setSelectedNode(null);
                          }
                        }}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
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

            <div className="pt-2 flex justify-end border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedNode(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
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
