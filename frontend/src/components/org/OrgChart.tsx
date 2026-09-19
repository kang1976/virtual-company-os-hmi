// frontend/src/components/org/OrgChart.tsx
import React, { useState } from 'react';
import {
  Code2,
  Award,
  Layers,
  UserCheck,
  CheckCircle2,
  ShieldAlert,
  BrainCircuit,
  Lock,
  Palette,
  Megaphone,
  Sparkles,
  Cpu,
  Database,
  Smartphone,
  GitPullRequest,
  Wrench,
  Sliders,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import type { TaskItem } from '../../types';

export type DivisionType = 'all' | 'engineering' | 'design' | 'security_qa' | 'marketing' | 'management';

export interface OrgAgentNode {
  id: string;
  name: string;
  koreanName: string;
  role: string;
  team: string;
  division: DivisionType;
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
  executionStage?: number;
}

export const ALL_AGENT_NODES: OrgAgentNode[] = [
  // ── 1. 최고경영 및 운영본부 (Management) ──
  {
    id: 'CEO',
    name: '인간 CEO',
    koreanName: '최고 의사결정권자 (Human)',
    role: '전략 비전 수립 및 최종 결재권자',
    team: '경영전략 최고위원회',
    division: 'management',
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
    division: 'management',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: 'CEO의 자연어 지시를 분석하여 하위 세부 태스크로 분해하고 기술·디자인·보안·QA 파이프라인을 자율 지휘합니다.',
    responsibilities: [
      'CEO 지시의 목표 및 요구사항 분석',
      '하위 실행 태스크 분해 및 부서별 업무 배정',
      '4대 장부(지시·업무·회의·특허) 실시간 동기화',
      '전 공정 모니터링 및 최종 종합 감사 브리핑',
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
    division: 'management',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '개발 착수 전 필수적으로 선행 특허를 조사하여 FTO 리스크를 평가하고 회피설계 가이드를 도출합니다.',
    responsibilities: [
      'KIPRIS/USPTO 선행 특허 DB 심층 검색',
      '핵심 청구항 침해 위험도(FTO Risk) 분석',
      '개발팀을 위한 독자 특허 회피설계 전략 도출',
    ],
    color: 'text-purple-400',
    borderColor: 'border-purple-500/50',
    accentBg: 'bg-purple-950/40',
    icon: ShieldAlert,
  },

  // ── 2. 기술개발본부 (Engineering Division - 9대 전문 체제) ──
  {
    id: 'ARCHITECT',
    name: 'SoftwareArchitectAgent',
    koreanName: '소프트웨어 수석 아키텍트',
    role: '시스템 도메인 모델링, 클린 아키텍처 및 트레이드오프 분석',
    team: '기술개발본부 (Engineering)',
    division: 'engineering',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '전체 엔지니어링 시스템의 도메인 주도 설계(DDD), 비동기 이벤트 큐 계층 격리 및 고동시성 확장 구조를 수립합니다.',
    responsibilities: [
      '클린 아키텍처 및 도메인 모델(DDD) 설계',
      '모듈 간 결합도 최소화 및 인터페이스 표준화',
      '고동시성 및 대용량 트랜잭션 확장 전략 수립',
    ],
    color: 'text-indigo-400',
    borderColor: 'border-indigo-500/50',
    accentBg: 'bg-indigo-950/40',
    icon: BrainCircuit,
  },
  {
    id: 'DEV',
    name: 'BackendDevAgent',
    koreanName: '백엔드 시스템 엔지니어',
    role: '특허 회피설계 아키텍처 및 분산 백엔드 API 구현',
    team: '기술개발본부 (Engineering)',
    division: 'engineering',
    isHuman: false,
    model: 'Gemini 2.5 Flash',
    description: '특허 Gatekeeper의 권고안을 반영하여 FastAPI, aiosqlite 비동기 트랜잭션 및 REST/WebSocket 엔드포인트를 구현합니다.',
    responsibilities: [
      'FastAPI 비동기 서비스 및 엔드포인트 구현',
      '이중 원장(SQLite + Markdown/JSON) 원자적 영속화',
      '비동기 이벤트 디스패처 및 락 동기화',
    ],
    color: 'text-blue-400',
    borderColor: 'border-blue-500/50',
    accentBg: 'bg-blue-950/40',
    icon: Code2,
  },
  {
    id: 'FRONTEND',
    name: 'FrontendDevAgent',
    koreanName: '프론트엔드 UI 개발자',
    role: 'React/Vite 반응형 대시보드 및 컴포넌트 구현',
    team: '기술개발본부 (Engineering)',
    division: 'engineering',
    isHuman: false,
    model: 'Gemini 2.5 Flash',
    description: '모바일 360~430px 반응형 레이아웃, 실시간 WebSocket 관제 피드 및 고대비 테마 컴포넌트를 코딩합니다.',
    responsibilities: [
      'React/Tailwind 모던 반응형 화면 구현',
      '실시간 관제 이벤트 및 칸반 인터랙션 연동',
      'WCAG 2.1 AA 접근성 및 터치 이벤트 최적화',
    ],
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/50',
    accentBg: 'bg-cyan-950/40',
    icon: Palette,
  },
  {
    id: 'MOBILE_BUILDER',
    name: 'MobileAppBuilderAgent',
    koreanName: '모바일 앱 전문 빌더',
    role: 'Flutter/Dart 크로스플랫폼 및 Z폴드/스마트폰 네이티브 구현',
    team: '기술개발본부 (Engineering)',
    division: 'engineering',
    isHuman: false,
    model: 'Gemini 2.5 Flash',
    description: '스마트폰 직결 P2P 제어를 위한 Flutter 네이티브 앱(APK) 및 Z폴드5 듀얼 화면 반응형 레이아웃을 전담 빌드합니다.',
    responsibilities: [
      'Flutter/Dart 기반 안드로이드/iOS 네이티브 빌드',
      '스마트폰 ↔ PLC 0.01초 직결 P2P 통신 최적화',
      'Z폴드 듀얼 화면 및 태블릿 반응형 UI 빌드',
    ],
    color: 'text-sky-400',
    borderColor: 'border-sky-500/50',
    accentBg: 'bg-sky-950/40',
    icon: Smartphone,
  },
  {
    id: 'EMBEDDED_FIRMWARE',
    name: 'EmbeddedFirmwareAgent',
    koreanName: '임베디드·산업제어 엔지니어',
    role: 'Omron CJ2H PLC FINS 통신 프로토콜 및 실시간 펌웨어 제어',
    team: '기술개발본부 (Engineering)',
    division: 'engineering',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '산업용 PLC FINS/UDP 통신 패킷 구조, 메모리 I/O 맵(DM/CIO/WR) 파싱 및 비상 페일세이프 셧다운 로직을 설계합니다.',
    responsibilities: [
      'Omron CJ2H FINS/UDP 통신 프로토콜 정밀 구현',
      '실시간 제어 보장 및 통신 패킷 위변조/손실 방지',
      '통신 단절 시 비상 안전 셧다운(Fail-Safe) 제어',
    ],
    color: 'text-amber-400',
    borderColor: 'border-amber-500/50',
    accentBg: 'bg-amber-950/40',
    icon: Cpu,
  },
  {
    id: 'DB_OPTIMIZER',
    name: 'DatabaseOptimizerAgent',
    koreanName: '데이터베이스 최적화 전문가',
    role: '스키마 인덱싱, 트랜잭션 격리 및 쿼리 실행계획 튜닝',
    team: '기술개발본부 (Engineering)',
    division: 'engineering',
    isHuman: false,
    model: 'Gemini 2.5 Flash',
    description: 'SQLite WAL 모드 및 PostgreSQL 인덱스 전략, 락 경합 방지, 복합 쿼리 N+1 문제 해결을 전담합니다.',
    responsibilities: [
      '고동시성 원자적 트랜잭션 격리 레벨 수립',
      '쿼리 실행계획(EXPLAIN) 분석 및 인덱스 최적화',
      '디스크 I/O 절감 및 장부 데이터 영속화 튜닝',
    ],
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
    accentBg: 'bg-emerald-950/40',
    icon: Database,
  },
  {
    id: 'DEVOPS',
    name: 'DevOpsAutomatorAgent',
    koreanName: '데브옵스·SRE 자동화 엔지니어',
    role: 'CI/CD 파이프라인, 무중단 자동화 및 헬스 자가복구(SRE)',
    team: '기술개발본부 (Engineering)',
    division: 'engineering',
    isHuman: false,
    model: 'Gemini 2.5 Flash',
    description: '무중단 배포, 프로세스 크래시 시 자가복구(Auto-Restart), 실시간 헬스 모니터링 및 자동 백업 정책을 관제합니다.',
    responsibilities: [
      '빌드/테스트 자동화 CI/CD 파이프라인 수립',
      '서버 크래시 감지 및 데몬 자가복구 자동화',
      '99.99% 시스템 가용성(SLO) 및 에러 버짓 모니터링',
    ],
    color: 'text-teal-400',
    borderColor: 'border-teal-500/50',
    accentBg: 'bg-teal-950/40',
    icon: Sliders,
  },
  {
    id: 'CODE_REVIEWER',
    name: 'CodeReviewerAgent',
    koreanName: '수석 코드 리뷰어',
    role: 'PR 코드 전수 감사, 안티패턴 검출 및 클린코드 품질 게이트',
    team: '기술개발본부 (Engineering)',
    division: 'engineering',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '개발팀이 제출한 모든 PR에 대해 정적 분석, 타입 안정성, 가독성, 예외 처리를 검토하여 최종 머지 승인을 판정합니다.',
    responsibilities: [
      'PR Diff 전수 정밀 코드 리뷰 및 안티패턴 제거',
      '타입 안정성 및 비동기 데드락 방지 검증',
      '클린코드 기준 충족 시 머지 승인(REVIEW_PASS) 부여',
    ],
    color: 'text-violet-400',
    borderColor: 'border-violet-500/50',
    accentBg: 'bg-violet-950/40',
    icon: GitPullRequest,
  },
  {
    id: 'MINIMAL_CHANGE',
    name: 'MinimalChangeAgent',
    koreanName: '최소 수정 패치 전문가',
    role: '무결점 핀포인트 패치, 스코프 크립 방지 및 사이드이펙트 제로',
    team: '기술개발본부 (Engineering)',
    division: 'engineering',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '불필요한 코드 변경(Scope Creep)을 철저히 차단하고, 요청된 요구사항만 핀포인트로 가장 안전하게 수정(Minimal Viable Diff)합니다.',
    responsibilities: [
      '최소 변경 원칙(Minimal Viable Diff) 감리',
      '수정 외 기능에 대한 사이드이펙트 0건 보장',
      '코드 변경 영향도 분석 및 핀포인트 패치 승인',
    ],
    color: 'text-blue-500',
    borderColor: 'border-blue-500/50',
    accentBg: 'bg-blue-950/40',
    icon: Wrench,
  },

  // ── 3. 디자인센터 (Design Division - 3대 정예 체제) ──
  {
    id: 'CHIEF_DESIGN',
    name: 'ChiefDesignAgent',
    koreanName: '수석 크리에이티브 디렉터',
    role: '색채 심리학, WCAG AAA 7:1 초고대비 및 디자인 시스템 총괄',
    team: '디자인센터 (Design & Creative Lab)',
    division: 'design',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '디자인 전공 수석 디렉터로서 WCAG AAA 7:1 이상 초고대비 배색, 텍스트 섀도우, 버튼 시인성(Affordance)을 총괄 설계합니다.',
    responsibilities: [
      'WCAG AAA 7:1 초고대비 명암비 설계 및 가이드 수립',
      'VS Code Light / Cyber Dark 듀얼 테마 총괄 감리',
      '버튼 텍스트 시인성 및 텍스트 섀도우 규격 수립',
    ],
    color: 'text-violet-400',
    borderColor: 'border-violet-500/50',
    accentBg: 'bg-violet-950/40',
    icon: Sparkles,
  },
  {
    id: 'UI_FINISH_GATE',
    name: 'UIFinishGateAgent',
    koreanName: 'UI 출시 마감 감리관',
    role: '출시 전 디자인 마감 감리, Anti-Generic 및 디자인 계약 승인',
    team: '디자인센터 (Design & Creative Lab)',
    division: 'design',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '출시 전 뭉개지거나 뻔한 UI를 걸러내고, 텍스트 하단 잘림(Clipping 0건), 1px 보더 정밀도 및 디자인 계약 준수를 최종 승인합니다.',
    responsibilities: [
      'Anti-Generic 원칙 기반 고유 브랜드 마감 심사',
      '텍스트 하단 잘림(Descender Clipping) 0건 실측',
      '출시 전 최종 디자인 게이트(GATE_PASS) 인가',
    ],
    color: 'text-pink-400',
    borderColor: 'border-pink-500/50',
    accentBg: 'bg-pink-950/40',
    icon: ShieldCheck,
  },
  {
    id: 'UX_ARCHITECT',
    name: 'UXArchitectAgent',
    koreanName: 'UX 정보구조 아키텍트',
    role: '터치 타깃 44px 보장, 반응형 시선 동선 및 인지 부하 최소화',
    team: '디자인센터 (Design & Creative Lab)',
    division: 'design',
    isHuman: false,
    model: 'Gemini 2.5 Flash',
    description: '모바일 360px 환경 터치 타깃 44px 보장, 3단계 시선 계층 구조 및 오조작 방지 인터랙션 흐름을 설계합니다.',
    responsibilities: [
      '모바일 터치 타깃 최소 44px 이상 전수 보장',
      '사용자 시선 흐름(Eye-tracking) 및 정보 계층 최적화',
      '인지 부하 지수(Cognitive Load) 절감 설계',
    ],
    color: 'text-fuchsia-400',
    borderColor: 'border-fuchsia-500/50',
    accentBg: 'bg-fuchsia-950/40',
    icon: Compass,
  },

  // ── 4. 보안·품질본부 (Security & QA Division - 4대 체제) ──
  {
    id: 'SECURITY',
    name: 'SecurityAgent',
    koreanName: '1차 정보보안 심사관',
    role: 'OWASP Top 10 / CVE 취약점 진단 및 시크릿 유출 검사',
    team: '정보보안실 (CISO)',
    division: 'security_qa',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '개발 산출물의 인젝션 방어, 암호화 표준 준수, 민감정보 노출 및 CVE 취약점을 엄격히 검증합니다.',
    responsibilities: [
      'OWASP Top 10 웹/API 취약점 전수 진단',
      '하드코딩된 API Key 및 시크릿 유출 탐지',
      '보안 점수 산출 및 취약점 개선 권고안 발행',
    ],
    color: 'text-rose-400',
    borderColor: 'border-rose-500/50',
    accentBg: 'bg-rose-950/40',
    icon: Lock,
  },
  {
    id: 'SECOPS',
    name: 'SecOpsAuditAgent',
    koreanName: '2차 수석 보안 감리관',
    role: '산업제어망 OT/PLC FINS 제로트러스트 심층 감리',
    team: '보안감리실 (SecOps)',
    division: 'security_qa',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '산업제어망 FINS 통신 패킷 위변조, Replay Attack 방어, 제로트러스트 권한 탈취 모의 침투를 감리합니다.',
    responsibilities: [
      '산업용 PLC FINS 통신 패킷 스니핑/Replay Attack 방어 실측',
      '런타임 권한 상승 모의 침투(Pen-Test)',
      '최종 보안 인가 상태 (CLEARED / REJECTED) 부여',
    ],
    color: 'text-red-400',
    borderColor: 'border-red-500/50',
    accentBg: 'bg-red-950/40',
    icon: Lock,
  },
  {
    id: 'QA',
    name: 'QAAgent',
    koreanName: '1차 독립 품질검수관',
    role: '기능 규격 검증 및 요구사항 적합성 심사',
    team: '품질보증실 (QA)',
    division: 'security_qa',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '개발팀과 독립된 시각에서 CEO 지시 요건 만족 여부와 기능 일치도를 검증하여 1차 품질 합격을 판정합니다.',
    responsibilities: [
      'CEO 요구사항 충족도 및 기능 적합성 평가',
      '핵심 사용자 시나리오 End-to-End 동작 검증',
      '1차 기능 결함 검출 및 리포팅',
    ],
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
    accentBg: 'bg-emerald-950/40',
    icon: Award,
  },
  {
    id: 'SENIOR_QA',
    name: 'SeniorQAAgent',
    koreanName: '2차 수석 품질 재검증관',
    role: '1차 통과 항목 엣지케이스 50건 및 극한 스트레스 실측',
    team: '품질보증위원회 (Senior QA)',
    division: 'security_qa',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '경계 조건 50건 무작위 샘플링, 동시 100건 부하 응답 지연(120ms 이내) 실측 및 최종 품질 인증을 부여합니다.',
    responsibilities: [
      '경계 조건 엣지 케이스 50건 무작위 샘플링 검증',
      '동시 100건 부하 시 응답 지연(120ms 이내) 실측',
      '2차 수석 품질 재검증 최종 합격 인증(REVERIFIED_PASS) 수여',
    ],
    color: 'text-teal-400',
    borderColor: 'border-teal-500/50',
    accentBg: 'bg-teal-950/40',
    icon: CheckCircle2,
  },

  // ── 5. 사업전략 & 상품화본부 (Product & Marketing Division) ──
  {
    id: 'MARKETING',
    name: 'ProductMarketingAgent',
    koreanName: '상품화·기술문서 마케터',
    role: 'B2B 공식 카탈로그, 기술 배틀카드 및 종합 운용 매뉴얼 제작',
    team: '사업전략·마케팅실 (Product & Marketing)',
    division: 'marketing',
    isHuman: false,
    model: 'Gemini 2.5 Pro',
    description: '기술 산출물을 분석하여 B2B 제품 카탈로그(USP/스펙/ROI), 경쟁사 대비 배틀카드 및 엔지니어용 종합 매뉴얼을 집필합니다.',
    responsibilities: [
      'B2B 산업용 제품 공식 카탈로그 및 브로슈어 작성',
      '경쟁사 대비 기술 비교 배틀카드(Battlecard) 수립',
      '사용자 및 엔지니어 종합 운용 매뉴얼 집필',
    ],
    color: 'text-amber-500',
    borderColor: 'border-amber-500/50',
    accentBg: 'bg-amber-950/40',
    icon: Megaphone,
  },
];

export const OrgChart: React.FC<OrgChartProps> = ({
  tasks = [],
  isExecuting = false,
  executionStage = 0,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<OrgAgentNode | null>(ALL_AGENT_NODES[1]); // COO 기본
  const [activeDivision, setActiveDivision] = useState<DivisionType>('all');

  const filteredAgents = ALL_AGENT_NODES.filter((a) => {
    if (activeDivision === 'all') return true;
    return a.division === activeDivision;
  });

  // 에이전트 상태 계산
  const getAgentStatus = (agentId: string) => {
    // 실시간 태스크 장부 연동 확인
    const assigned = tasks.filter((t) => t.assignee === agentId);
    const activeTask = assigned.find((t) => t.status === 'WORKING');
    if (activeTask) {
      return { status: `수행 중: ${activeTask.title.slice(0, 10)}...`, color: 'bg-indigo-500', isPulse: true };
    }

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
      if (agentId === 'CHIEF_DESIGN' || agentId === 'UI_FINISH_GATE' || agentId === 'UX_ARCHITECT') {
        if (executionStage === 3) return { status: '디자인 마감 감리 중...', color: 'bg-violet-400', isPulse: true };
        if (executionStage > 3) return { status: '디자인 승인(DESIGN_PASS)', color: 'bg-emerald-500', isPulse: false };
      }
      if (agentId === 'FRONTEND' || agentId === 'DEV' || agentId === 'ARCHITECT' || agentId === 'MOBILE_BUILDER' || agentId === 'EMBEDDED_FIRMWARE') {
        if (executionStage === 4) return { status: '시스템 개발 구현 중...', color: 'bg-blue-400', isPulse: true };
        if (executionStage > 4) return { status: '구현 제출 완료', color: 'bg-emerald-500', isPulse: false };
      }
      if (agentId === 'SECURITY' || agentId === 'QA') {
        if (executionStage === 5) return { status: '1차 보안/품질 심사 중...', color: 'bg-rose-400', isPulse: true };
        if (executionStage > 5) return { status: '1차 합격 완료', color: 'bg-emerald-500', isPulse: false };
      }
      if (agentId === 'SECOPS' || agentId === 'SENIOR_QA') {
        if (executionStage === 6) return { status: '2차 심층 재검증 중...', color: 'bg-teal-400', isPulse: true };
        if (executionStage > 6) return { status: '최종 인증(PASS)', color: 'bg-emerald-500', isPulse: false };
      }
      if (agentId === 'MARKETING') {
        if (executionStage === 6) return { status: '카탈로그/매뉴얼 제작 중...', color: 'bg-amber-400', isPulse: true };
        if (executionStage > 6) return { status: '상품화 완료', color: 'bg-emerald-500', isPulse: false };
      }
    }

    return { status: '정상 가동 (IDLE)', color: 'bg-slate-500', isPulse: false };
  };

  const divisions: { id: DivisionType; label: string; count: number }[] = [
    { id: 'all', label: '전체 조직', count: ALL_AGENT_NODES.length },
    { id: 'engineering', label: '💻 기술개발본부', count: ALL_AGENT_NODES.filter((a) => a.division === 'engineering').length },
    { id: 'design', label: '🎨 디자인센터', count: ALL_AGENT_NODES.filter((a) => a.division === 'design').length },
    { id: 'security_qa', label: '🛡️ 보안·품질본부', count: ALL_AGENT_NODES.filter((a) => a.division === 'security_qa').length },
    { id: 'marketing', label: '📢 사업·마케팅실', count: ALL_AGENT_NODES.filter((a) => a.division === 'marketing').length },
    { id: 'management', label: '🏛️ 경영·운영·특허', count: ALL_AGENT_NODES.filter((a) => a.division === 'management').length },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 헤더 안내 바 */}
      <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
              소프트웨어 전문 개발사 조직도 (Agency Agents 내재화 체계)
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
              기술개발본부 9명 · 디자인센터 3명 · 보안·품질 4명 · 사업마케팅 1명 · 최고경영/운영 3명 총 20개체 자율 협업 체제
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-end">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-800 flex items-center gap-1.5 text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            자율 에이전트 20개체 풀가동 중 (글로벌 소프트웨어 하우스 규격)
          </span>
        </div>
      </div>

      {/* 부서 필터 탭 바 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {divisions.map((div) => {
          const isActive = activeDivision === div.id;
          return (
            <button
              key={div.id}
              onClick={() => setActiveDivision(div.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{div.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-indigo-800 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                {div.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 조직도 계층 뷰어 & 상세 모달/사이드 패널 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 좌측 2열: 에이전트 카드 그리드 */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredAgents.map((agent) => {
              const status = getAgentStatus(agent.id);
              const isSelected = selectedAgent?.id === agent.id;
              const IconComponent = agent.icon;

              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-md scale-[1.02]'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-400 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${agent.accentBg} ${agent.color} shrink-0 border ${agent.borderColor}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {agent.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 font-mono">
                          {agent.model.replace('Gemini ', '')}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate font-medium mt-0.5">
                        {agent.koreanName}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 dark:text-slate-400 truncate">{agent.team}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {status.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측 1열: 선택된 에이전트 상세 프로필 */}
        <div className="bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm flex flex-col">
          {selectedAgent ? (
            <div className="space-y-4 sm:space-y-5 flex-1 flex flex-col">
              {/* 상단 프로필 헤더 */}
              <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 sm:p-3 rounded-xl ${selectedAgent.accentBg} border ${selectedAgent.borderColor} ${selectedAgent.color} shrink-0`}>
                    <selectedAgent.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      {selectedAgent.team}
                    </span>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                      {selectedAgent.name}
                    </h3>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                      {selectedAgent.koreanName}
                    </p>
                  </div>
                </div>
              </div>

              {/* 핵심 역할 및 지능 엔진 */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">지능 엔진</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedAgent.model}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">가동 상태</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    정상 배치
                  </span>
                </div>
              </div>

              {/* 상세 직무 설명 */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">직무 소개</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {selectedAgent.description}
                </p>
              </div>

              {/* 핵심 책임 및 표준 산출물 (agency-agents 표준) */}
              <div className="flex-1">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">핵심 책임 및 업무 규격</h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {selectedAgent.responsibilities.map((resp, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800/80">
                      <span className="text-indigo-500 font-bold shrink-0">✓</span>
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              에이전트를 선택하면 상세 프로필과 산출물 규격을 확인할 수 있습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
