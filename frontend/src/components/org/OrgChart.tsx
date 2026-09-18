// frontend/src/components/org/OrgChart.tsx
import React, { useState } from 'react';
import {
  Users,
  Code2,
  Award,
  Layers,
  UserCheck,
  CheckCircle2,
  ShieldAlert,
  BrainCircuit,
  Briefcase,
  Lock,
  Palette,
} from 'lucide-react';
import type { TaskItem } from '../../types';

export interface OrgAgentNode {
  id: string;
  name: string;
  koreanName: string;
  role: string;
  team: string;
  isHuman?: boolean;
  model: string;
  description: string;
  responsibilities: string[];
  color: string;
  borderColor: string;
  accentBg: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface OrgChartProps {
  tasks?: TaskItem[];
  isExecuting?: boolean;
  executionStage?: number; // 0: 대기, 1: COO 분해, 2: 특허 조사, 3: 개발 구현, 4: 보안 심사, 5: QA 검수
}

const AGENT_NODES: OrgAgentNode[] = [
  {
    id: 'CEO',
    name: '인간 CEO',
    koreanName: '최고 의사결정권자 (Human)',
    role: '전략 비전 수립 및 최종 결재권자',
    team: '경영전략 최고위원회',
    isHuman: true,
    model: 'Human-In-The-Loop',
    description: '자연어로 가상 회사에 사업 목표와 핵심 프로젝트 지시를 하달하고 최종 산출물을 승인합니다.',
    responsibilities: [
      '자연어 경영 지시 하달',
      '사업 예산 및 우선순위 (P0~P4) 결정',
      '특허 침해 및 핵심 위험 최종 승인/반려',
    ],
    color: 'text-amber-400',
    borderColor: 'border-amber-500/50',
    accentBg: 'bg-amber-950/40',
    icon: UserCheck,
  },
  {
    id: 'COO',
    name: 'COOAgent',
    koreanName: '총괄 운영 에이전트',
    role: '지시 분석, 업무 분해 및 자율 오케스트레이션',
    team: '운영본부 (Operations)',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: 'CEO의 자연어 지시를 분석하여 하위 세부 태스크로 분해하고 선행특허-개발-보안-QA 파이프라인을 자율 지휘합니다.',
    responsibilities: [
      'CEO 지시의 목표 및 요구사항 분석',
      '하위 실행 태스크 분해 및 부서별 업무 배정',
      '4대 장부(지시·업무·회의·특허) 실시간 동기화',
      '각 에이전트 산출물 전수 감사 및 최종 품질 종합검수 (Quality Gate)',
      '전 공정 모니터링 및 최종 종합 브리핑 작성',
    ],
    color: 'text-sky-400',
    borderColor: 'border-sky-500/50',
    accentBg: 'bg-sky-950/40',
    icon: Layers,
  },
  {
    id: 'PATENT',
    name: 'PatentSearchAgent',
    koreanName: '특허 조사 Gatekeeper',
    role: '선행기술 조사 및 FTO 침해방지 게이트키퍼',
    team: 'IP·특허법무실',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '개발 착수 전 필수적으로 선행 특허를 조사하여 FTO 리스크를 평가하고 회피설계 가이드를 도출합니다.',
    responsibilities: [
      'KIPRIS/USPTO 스타일 선행 특허 DB 심층 검색',
      '핵심 청구항 침해 위험도(FTO Risk) 분석',
      '개발팀을 위한 특허 회피설계 전략 도출',
      '특허 원장(KNOWLEDGE_PATENT) 자동 등재',
    ],
    color: 'text-purple-400',
    borderColor: 'border-purple-500/50',
    accentBg: 'bg-purple-950/40',
    icon: ShieldAlert,
  },
  {
    id: 'FRONTEND',
    name: 'FrontendDevAgent',
    koreanName: '프론트엔드 UI/UX 개발자',
    role: '모바일 반응형 화면 설계 및 디자인 시스템 구현',
    team: '프론트엔드팀',
    isHuman: false,
    model: 'Gemini 2.5 Flash',
    description: 'CEO의 디자인 수정 지시 및 사용자 인터페이스를 완벽하게 구현하며, 모바일 최적화 및 3종 테마 전환을 전담합니다.',
    responsibilities: [
      '모바일(360~430px) 반응형 레이아웃 및 터치 UX 최적화',
      '사이버 다크, OLED 제트블랙, 모던 라이트 3종 테마 시스템 구축',
      '원클릭 전체화면 및 5단계 칸반 인터랙션 구현',
      '웹 접근성(WCAG) 및 컴포넌트 단위 품질 검증',
    ],
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/50',
    accentBg: 'bg-cyan-950/40',
    icon: Palette,
  },
  {
    id: 'DEV',
    name: 'BackendDevAgent',
    koreanName: '백엔드 개발 에이전트',
    role: '특허 회피설계 아키텍처 및 시스템 구현',
    team: '기술개발본부',
    isHuman: false,
    model: 'Gemini 2.5 Flash',
    description: '특허 Gatekeeper의 회피 권고안을 반영하여 견고하고 확장 가능한 프로덕션 코드를 구현합니다.',
    responsibilities: [
      '특허 침해를 회피하는 클린 아키텍처 설계',
      '산업용 통신(PLC/IoT) 및 분산 서비스 구현',
      '단위/통합 테스트 코드 작성 및 1차 산출물 제출',
      '개발 산출물 원장 등록',
    ],
    color: 'text-blue-400',
    borderColor: 'border-blue-500/50',
    accentBg: 'bg-blue-950/40',
    icon: Code2,
  },
  {
    id: 'SECURITY',
    name: 'SecurityAgent',
    koreanName: '정보보안 심사관',
    role: 'OWASP / CVE 취약점 진단 및 암호화 심사',
    team: '정보보안실 (CISO)',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '개발 산출물의 인젝션 방어, 암호화 표준 준수, 민감정보 노출 및 CVE 취약점을 엄격히 검증합니다.',
    responsibilities: [
      'OWASP Top 10 웹/API 취약점 전수 진단',
      'SQLi, XSS, SSRF 등 입력값 검증 및 인젝션 방어',
      'TLS 1.3 암호화 및 시크릿 키 하드코딩 탐지',
      '오픈소스 라이브러리 CVE 위험도 평가 (LOW/HIGH)',
      '보안 점수 산출 및 취약점 개선 권고안 발행',
    ],
    color: 'text-rose-400',
    borderColor: 'border-rose-500/50',
    accentBg: 'bg-rose-950/40',
    icon: Lock,
  },
  {
    id: 'QA',
    name: 'QAAgent',
    koreanName: '독립 품질검수 에이전트',
    role: '품질 검증, 적합성 심사 및 업무 종결 승인',
    team: '품질보증실 (QA)',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '개발팀과 완전히 독립된 시각에서 CEO 지시 요건 만족 여부와 코드 안정성을 검증하여 업무 종결을 결정합니다.',
    responsibilities: [
      'CEO 요구사항 충족도 및 기능 적합성 평가',
      '코드 보안성, 예외 처리 및 성능 스트레스 검증',
      '검수 통과 시 VERIFIED/CLOSED 승인 처리',
      '품질 미달 시 BLOCKED 반려 및 피드백 전송',
    ],
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
    accentBg: 'bg-emerald-950/40',
    icon: Award,
  },
];

export const OrgChart: React.FC<OrgChartProps> = ({
  tasks = [],
  isExecuting = false,
  executionStage = 0,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<OrgAgentNode | null>(AGENT_NODES[1]); // COO 기본 선택

  // 에이전트별 실시간 상태 도출
  const getAgentStatus = (agentId: string) => {
    if (agentId === 'CEO') {
      return isExecuting
        ? { status: '명령 하달 완료', color: 'bg-sky-500', isPulse: false }
        : { status: '지시 대기 중', color: 'bg-emerald-500', isPulse: false };
    }

    if (isExecuting) {
      if (agentId === 'COO') {
        if (executionStage === 1) return { status: '지시 분해 중...', color: 'bg-sky-400', isPulse: true };
        if (executionStage > 1) return { status: '공정 감독 중', color: 'bg-emerald-500', isPulse: false };
      }
      if (agentId === 'PATENT') {
        if (executionStage === 2) return { status: '특허 FTO 조사 중...', color: 'bg-purple-400', isPulse: true };
        if (executionStage > 2) return { status: '조사 완료', color: 'bg-emerald-500', isPulse: false };
      }
      if (agentId === 'DEV') {
        if (executionStage === 3) return { status: '회피설계 구현 중...', color: 'bg-blue-400', isPulse: true };
        if (executionStage > 3) return { status: '산출물 제출 완료', color: 'bg-emerald-500', isPulse: false };
      }
      if (agentId === 'SECURITY') {
        if (executionStage === 4) return { status: '보안 취약점 심사 중...', color: 'bg-rose-400', isPulse: true };
        if (executionStage > 4) return { status: '보안 승인 완료', color: 'bg-emerald-500', isPulse: false };
      }
      if (agentId === 'QA') {
        if (executionStage === 5) return { status: '독립 품질 검수 중...', color: 'bg-emerald-400', isPulse: true };
      }
    }

    // 실제 tasks 기록 기반 상태 확인
    const relevantTasks = tasks.filter((t) => {
      const a = (t.assignee || '').toLowerCase();
      if (agentId === 'PATENT' && a.includes('patent')) return true;
      if (agentId === 'DEV' && (a.includes('backend') || a.includes('dev'))) return true;
      if (agentId === 'SECURITY' && (a.includes('security') || a.includes('보안'))) return true;
      if (agentId === 'QA' && a.includes('qa')) return true;
      if (agentId === 'COO' && a.includes('coo')) return true;
      return false;
    });

    if (relevantTasks.some((t) => t.status === 'WORKING')) {
      return { status: '작업 수행 중', color: 'bg-sky-400', isPulse: true };
    }
    if (relevantTasks.some((t) => t.status === 'REVIEW')) {
      return { status: '검수/심사 중', color: 'bg-amber-400', isPulse: true };
    }
    if (relevantTasks.some((t) => t.status === 'BLOCKED')) {
      return { status: '차단/반려', color: 'bg-rose-500', isPulse: false };
    }
    if (relevantTasks.length > 0 && relevantTasks.every((t) => t.status === 'CLOSED' || t.status === 'VERIFIED')) {
      return { status: '대기 (마감 완료)', color: 'bg-emerald-500', isPulse: false };
    }

    return { status: '대기 중 (IDLE)', color: 'bg-slate-500', isPulse: false };
  };

  const ceoNode = AGENT_NODES[0];
  const cooNode = AGENT_NODES[1];
  const specialistNodes = AGENT_NODES.slice(2);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 안내 바 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              가상 회사 조직도 및 에이전트 실시간 관제
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400">
              인간 최고 의사결정권자(CEO)와 5대 전문 자율 에이전트가 협력하는 기업 거버넌스
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-end">
          <span className="px-2.5 py-1 rounded-full bg-slate-950 text-slate-400 border border-slate-800 flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            자율 에이전트 6개체 가동 중
          </span>
        </div>
      </div>

      {/* 조직도 계층 뷰어 & 상세 모달/사이드 패널 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 좌측 2열: 계층도 시각화 */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-sm flex flex-col items-center">
          {/* 계층 1: 인간 CEO */}
          <div className="w-full max-w-md flex flex-col items-center">
            {renderAgentCard(ceoNode, getAgentStatus('CEO'), selectedAgent?.id === 'CEO', () => setSelectedAgent(ceoNode))}
          </div>

          {/* 연결선 1 */}
          <div className="h-6 sm:h-8 w-0.5 bg-gradient-to-b from-amber-500/80 to-sky-500/80 my-1" />

          {/* 계층 2: COO Agent */}
          <div className="w-full max-w-md flex flex-col items-center">
            {renderAgentCard(cooNode, getAgentStatus('COO'), selectedAgent?.id === 'COO', () => setSelectedAgent(cooNode))}
          </div>

          {/* 연결선 2 (수평 분기선) */}
          <div className="w-full max-w-3xl flex flex-col items-center my-1 hidden sm:flex">
            <div className="h-4 w-0.5 bg-sky-500/80" />
            <div className="w-[92%] h-0.5 bg-slate-700" />
            <div className="w-[92%] flex justify-between">
              <div className="h-4 w-0.5 bg-purple-500/80" />
              <div className="h-4 w-0.5 bg-cyan-500/80" />
              <div className="h-4 w-0.5 bg-blue-500/80" />
              <div className="h-4 w-0.5 bg-rose-500/80" />
              <div className="h-4 w-0.5 bg-emerald-500/80" />
            </div>
          </div>

          {/* 모바일 연결선 */}
          <div className="sm:hidden h-4 w-0.5 bg-sky-500/80 my-1" />

          {/* 계층 3: 5대 전문 실무 에이전트 (특허, 프론트, 백엔드, 보안, QA) */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 sm:gap-2.5 pt-1">
            {specialistNodes.map((agent) => (
              <div key={agent.id} className="flex flex-col items-center">
                {renderAgentCard(
                  agent,
                  getAgentStatus(agent.id),
                  selectedAgent?.id === agent.id,
                  () => setSelectedAgent(agent)
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 우측 1열: 선택된 에이전트 상세 프로필 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm flex flex-col">
          {selectedAgent ? (
            <div className="space-y-4 sm:space-y-5 flex-1 flex flex-col">
              {/* 상단 프로필 헤더 */}
              <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 sm:p-3 rounded-xl ${selectedAgent.accentBg} border ${selectedAgent.borderColor} ${selectedAgent.color} shrink-0`}>
                    <selectedAgent.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      {selectedAgent.team}
                    </span>
                    <h3 className="font-bold text-base sm:text-lg text-white leading-tight">
                      {selectedAgent.koreanName}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">{selectedAgent.name}</span>
                  </div>
                </div>
              </div>

              {/* 상태 및 엔진 뱃지 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-950/80 p-2.5 sm:p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] sm:text-[11px] text-slate-500 block mb-1">실시간 상태</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${getAgentStatus(selectedAgent.id).color} ${
                        getAgentStatus(selectedAgent.id).isPulse ? 'animate-ping' : ''
                      }`}
                    />
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {getAgentStatus(selectedAgent.id).status}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-2.5 sm:p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] sm:text-[11px] text-slate-500 block mb-1">지능 엔진</span>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-sky-400 truncate">
                    <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
                    <span>{selectedAgent.model}</span>
                  </div>
                </div>
              </div>

              {/* 역할 설명 */}
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  주요 역할 및 미션
                </span>
                <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  {selectedAgent.description}
                </p>
              </div>

              {/* 핵심 담당 업무 목록 */}
              <div className="flex-1">
                <span className="text-xs font-semibold text-slate-300 block mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  책임 업무 (Responsibilities)
                </span>
                <ul className="space-y-1.5">
                  {selectedAgent.responsibilities.map((resp, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-300 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/60 flex items-start gap-2"
                    >
                      <span className="text-sky-500 font-bold">•</span>
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 푸터 배너 */}
              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                <span>자율 에이전트 V4.0 프로토콜</span>
                <span className="text-sky-400 font-medium">활성 가동</span>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-8">
              에이전트를 터치하여 상세 정보를 조회하세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function renderAgentCard(
  agent: OrgAgentNode,
  liveStatus: { status: string; color: string; isPulse: boolean },
  isSelected: boolean,
  onClick: () => void
) {
  const Icon = agent.icon;

  return (
    <div
      onClick={onClick}
      className={`w-full p-3 sm:p-4 rounded-xl border cursor-pointer transition-all duration-200 relative group overflow-hidden ${
        isSelected
          ? `${agent.accentBg} ${agent.borderColor} ring-2 ring-sky-500/40 shadow-lg shadow-sky-500/10`
          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 sm:p-2 rounded-lg ${agent.accentBg} border ${agent.borderColor} ${agent.color} shrink-0`}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 block truncate">{agent.team}</span>
            <h4 className="font-bold text-xs sm:text-sm text-white leading-tight truncate">
              {agent.koreanName}
            </h4>
          </div>
        </div>

        {/* 상태 라이트 */}
        <div className="flex items-center gap-1.5 shrink-0" title={liveStatus.status}>
          <span
            className={`w-2 h-2 rounded-full ${liveStatus.color} ${
              liveStatus.isPulse ? 'animate-ping' : ''
            }`}
          />
        </div>
      </div>

      <div className="text-[10px] sm:text-[11px] text-slate-400 line-clamp-1 mb-1.5">
        {agent.role}
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[9px] sm:text-[10px]">
        <span className="text-slate-500 font-mono truncate">{agent.name}</span>
        <span className="font-medium text-slate-300 truncate ml-1">{liveStatus.status}</span>
      </div>
    </div>
  );
}
