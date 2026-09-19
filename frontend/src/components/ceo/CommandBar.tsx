// frontend/src/components/ceo/CommandBar.tsx
import React, { useState } from 'react';
import {
  Terminal,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  Code2,
  Award,
  Layers,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  FolderOpen,
  ShieldAlert,
  Lock,
  Palette,
  ShieldCheck,
  X,
  Copy,
  Check,
  HelpCircle,
  BookOpen,
  Kanban,
} from 'lucide-react';
import type { CommandResponse, Priority, TaskItem } from '../../types';

export interface CommandBarProps {
  onCommandSubmit: (instruction: string, targetTeam: string, priority: Priority) => Promise<CommandResponse | void>;
  isExecuting: boolean;
  executionStage?: number; // 0: 대기, 1: COO 분해, 2: 특허 조사, 3: 프론트 UI, 4: 백엔드 개발, 5: 보안 심사, 6: QA/COO 승인
  latestResult: CommandResponse | null;
  onNavigateTab?: (tab: 'kanban' | 'ledgers' | 'org') => void;
  onSelectDeliverable?: (task: TaskItem) => void;
}

const PRESET_COMMANDS = [
  'PLC 모바일 제어 선행특허 동향 조사 및 FTO 회피설계',
  '모바일 관제 대시보드 UI/UX 개편 및 3종 테마 구축',
  '스마트 팩토리 PLC 모니터링 시스템 구축',
  '산업제어망 OT 보안 심사 및 침해사고 대응 체계 수립',
  '클라우드 네이티브 MES 제조 실행 시스템 설계',
];

const TARGET_TEAMS = [
  { id: '전체', label: '전사 총괄 (COO 자율 분해 및 다층 검증)' },
  { id: '운영기획팀', label: '운영기획팀 (COO)' },
  { id: 'IP특허팀', label: 'IP·특허팀 (Gatekeeper)' },
  { id: '프론트엔드팀', label: '프론트엔드팀 (UI/UX 디자인)' },
  { id: '백엔드개발팀', label: '백엔드개발팀 (회피설계)' },
  { id: '보안팀', label: '1차 보안팀 (OWASP/CVE 심사)' },
  { id: '품질QA팀', label: '1차 품질QA팀 (독립 검수)' },
  { id: '수석보안감리실', label: '2차 수석보안감리실 (OT/PLC 제로트러스트)' },
  { id: '품질보증위원회', label: '2차 품질보증위원회 (극한 스트레스/엣지 검증)' },
];

const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: 'P0', label: 'P0 (긴급)', color: 'border-rose-500/50 text-rose-400 bg-rose-950/40' },
  { id: 'P1', label: 'P1 (높음)', color: 'border-amber-500/50 text-amber-400 bg-amber-950/40' },
  { id: 'P2', label: 'P2 (보통)', color: 'border-sky-500/50 text-sky-400 bg-sky-950/40' },
  { id: 'P3', label: 'P3 (낮음)', color: 'border-emerald-500/50 text-emerald-400 bg-emerald-950/40' },
  { id: 'P4', label: 'P4 (예비)', color: 'border-slate-600 text-slate-400 bg-slate-900/60' },
];

const PIPELINE_STEPS = [
  { step: 1, name: 'COO 분해', desc: '지시 분석 및 업무 할당', icon: Layers },
  { step: 2, name: '특허 FTO', desc: '선행특허 회피설계', icon: ShieldAlert },
  { step: 3, name: '프론트 UI', desc: '모바일/테마 UI 개발', icon: Palette },
  { step: 4, name: '시스템 개발', desc: '백엔드 아키텍처 구현', icon: Code2 },
  { step: 5, name: '1차 보안/QA', desc: 'OWASP & 기능 검수', icon: Lock },
  { step: 6, name: '2차 심층 재검증', desc: 'OT 제로트러스트 & 스트레스', icon: ShieldCheck },
  { step: 7, name: 'COO 종합검수', desc: '품질 승인 및 원장 마감', icon: Award },
];

export const CommandBar: React.FC<CommandBarProps> = ({
  onCommandSubmit,
  isExecuting,
  executionStage = 0,
  latestResult,
  onNavigateTab,
  onSelectDeliverable,
}) => {
  const [instruction, setInstruction] = useState('');
  const [targetTeam, setTargetTeam] = useState('전체');
  const [priority, setPriority] = useState<Priority>('P0');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // 새로운 결과가 생성되면 모달 자동 열기
  React.useEffect(() => {
    if (latestResult) {
      setShowResultModal(true);
    }
  }, [latestResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed) {
      setErrorMsg('CEO 업무 지시 내용을 입력해주세요.');
      return;
    }
    setErrorMsg(null);
    try {
      await onCommandSubmit(trimmed, targetTeam, priority);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Failed to')) {
        setErrorMsg('⚠️ 백엔드 서버(:8000) 통신 일시 단절: 서버 프로세스가 종료되었거나 재기동 중입니다. 폴더의 [start_all.bat] 또는 [run_backend.bat]을 실행하여 서버를 재기동해 주세요.');
      } else {
        setErrorMsg(msg || '명령 전달 중 오류가 발생했습니다.');
      }
    }
  };

  const handleSelectPreset = (preset: string) => {
    setInstruction(preset);
    setErrorMsg(null);
  };

  const handleCopyResult = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* CEO 지시 입력 메인 패널 */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-sm transition-colors">
        {/* 상단 액센트 글로우 */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500" />

        {/* 헤더 & 설명 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border-2 border-sky-500/40 text-sky-600 dark:text-sky-400 shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base md:text-lg flex items-center gap-1.5 sm:gap-2">
                CEO 자율 지시 관제실
                <span className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400">
                  (Executive Terminal)
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 font-medium">
                자연어로 지시를 내리면 가상 조직의 7대 에이전트가 2차 다층 검증 파이프라인을 자율 구동합니다.
              </p>
            </div>
          </div>

          {/* 대상 팀 & 우선순위 셀렉터 */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* 우선순위 선택 */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border-2 border-slate-300 dark:border-slate-700 text-xs flex-1 sm:flex-initial shadow-sm">
              <span className="text-slate-700 dark:text-slate-300 font-bold shrink-0">우선순위:</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                disabled={isExecuting}
                className="bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer font-bold w-full sm:w-auto"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 담당 팀 선택 */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border-2 border-slate-300 dark:border-slate-700 text-xs flex-1 sm:flex-initial shadow-sm">
              <span className="text-slate-700 dark:text-slate-300 font-bold shrink-0">수신:</span>
              <select
                value={targetTeam}
                onChange={(e) => setTargetTeam(e.target.value)}
                disabled={isExecuting}
                className="bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer font-bold w-full sm:w-auto"
              >
                {TARGET_TEAMS.map((t) => (
                  <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 명령어 입력 폼 (모바일 대응 터치 UI) */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={isExecuting}
              placeholder="예: Omron PLC 모바일 제어 선행특허 동향 조사 및 FTO 회피설계 분석 지시"
              className="w-full bg-white dark:bg-slate-950 border-2 border-slate-400 dark:border-slate-600 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all shadow-inner font-medium disabled:opacity-60 min-h-[46px]"
            />
            <button
              type="submit"
              disabled={isExecuting || !instruction.trim()}
              className={`min-h-[46px] px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shrink-0 border-2 ${
                isExecuting || !instruction.trim()
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 cursor-not-allowed shadow-none'
                  : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-600 shadow-md shadow-sky-600/30 active:scale-95 cursor-pointer text-white-force'
              }`}
            >
              {isExecuting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span className="text-white-force font-bold">실행 중...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-white" />
                  <span className="text-white-force font-bold">지시 발령</span>
                </>
              )}
            </button>
          </div>

          {/* 에러 메시지 알림 */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950 border-2 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 추천 지시 프리셋 칩 목록 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold mr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              추천 지시:
            </span>
            {PRESET_COMMANDS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                disabled={isExecuting}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 transition-all hover:border-sky-500 dark:hover:border-sky-400 active:scale-95 disabled:opacity-40 shadow-sm"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* 결과 확인 방법 실시간 팁 배너 (중복 완수보고서 버튼 제거) */}
          <div className="pt-2.5 border-t-2 border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sky-700 dark:text-sky-400">💡 결과물 확인 경로:</span>
              <span>지시 발령 시 7대 전문 에이전트가 협업하여 즉시</span>
              <strong className="text-indigo-700 dark:text-indigo-400 font-bold underline cursor-pointer hover:text-indigo-600" onClick={() => onNavigateTab?.('kanban')}>[칸반 보드]</strong>
              <span>와</span>
              <strong className="text-emerald-700 dark:text-emerald-400 font-bold underline cursor-pointer hover:text-emerald-600" onClick={() => onNavigateTab?.('ledgers')}>[4대 장부 원장]</strong>
              <span>에 4단계로 영구 기록됩니다.</span>
            </div>
          </div>
        </form>

        {/* 자율 실행 중 실시간 파이프라인 7단계 스테퍼 */}
        {isExecuting && (
          <div className="mt-4 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
                7단계 다층 재검증 파이프라인 자율 수행 중
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold">
                진행: {executionStage}/7
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {PIPELINE_STEPS.map((item) => {
                const IconComponent = item.icon;
                const isCurrent = executionStage === item.step;
                const isPassed = executionStage > item.step;
                return (
                  <div
                    key={item.step}
                    className={`p-2.5 rounded-xl border-2 text-xs transition-all ${
                      isCurrent
                        ? 'bg-sky-50 dark:bg-sky-950/80 border-sky-500 text-sky-950 dark:text-sky-100 shadow-md ring-2 ring-sky-500/30 font-bold'
                        : isPassed
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-semibold'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center gap-1 text-[11px] sm:text-xs">
                        <IconComponent
                          className={`w-3.5 h-3.5 ${
                            isCurrent ? 'text-sky-600 dark:text-sky-400 animate-bounce' : isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                          }`}
                        />
                        {item.name}
                      </span>
                      {isPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : isCurrent ? (
                        <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 animate-spin" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">대기</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight line-clamp-1">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 최근 실행 결과 브리핑 카드 */}
      {latestResult && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-4 sm:p-5 shadow-xl relative transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b-2 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    최근 명령 처리 브리핑
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-400 dark:border-emerald-700">
                    {latestResult.status === 'SUCCESS' ? '전 공정 검증 완료' : latestResult.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-600 dark:text-slate-300 mt-1 font-mono">
                  <span>프로젝트: <strong className="text-slate-900 dark:text-white font-bold">{latestResult.project_id}</strong></span>
                  <span>·</span>
                  <span>지시: <strong className="text-slate-900 dark:text-white font-bold">{latestResult.command_id}</strong></span>
                </div>
              </div>
            </div>

            {/* 완수 보고서 팝업 및 탭 이동 단일 대표 액션 버튼군 */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowResultModal(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-xs text-white font-bold shadow-md ring-1 ring-sky-400/50 transition-all active:scale-95 text-white-force cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-300" />
                <span>🏆 CEO 업무 완수 종합 보고서 열람</span>
              </button>
              {onNavigateTab && (
                <>
                  <button
                    onClick={() => onNavigateTab('kanban')}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 font-bold border-2 border-slate-300 dark:border-slate-700 transition-colors shadow-sm cursor-pointer"
                  >
                    <span>칸반 보드</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onNavigateTab('ledgers')}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 font-bold border-2 border-slate-300 dark:border-slate-700 transition-colors shadow-sm cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>4대 장부 원장</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 총평 및 요약 */}
          <div className="bg-slate-50 dark:bg-slate-950/70 rounded-lg p-3 border border-slate-200 dark:border-slate-800/80 mb-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="font-semibold text-sky-600 dark:text-sky-400 block mb-0.5">총괄 요약 (COO 브리핑):</span>
            {latestResult.summary || '전 공정 검증 완료 및 4대 장부 최종 마감되었습니다.'}
          </div>

          {/* COO 최종 종합 품질검수 (Quality Gate) 감사 리포트 */}
          {latestResult.coo_audit && (
            <div className="bg-indigo-50/60 dark:bg-slate-950/90 rounded-xl p-3.5 border border-indigo-200 dark:border-indigo-900/60 mb-3 text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-slate-900 dark:text-white">COO 전사 최종 품질 종합검수 (Quality Gate)</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    latestResult.coo_audit.approved
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  }`}
                >
                  {latestResult.coo_audit.approved ? '최종 마감 승인 (CLOSED)' : '재검토 권고 (REVISION)'}
                </span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
                {latestResult.coo_audit.executive_summary}
              </p>
              {latestResult.coo_audit.checked_items && latestResult.coo_audit.checked_items.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2 bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-indigo-100 dark:border-slate-800/60">
                  {latestResult.coo_audit.checked_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span className="truncate text-slate-700 dark:text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              )}
              {latestResult.coo_audit.directive_feedback && (
                <div className="text-[11px] text-indigo-700 dark:text-indigo-300 italic">
                  &bull; COO 총평: {latestResult.coo_audit.directive_feedback}
                </div>
              )}
            </div>
          )}

          {/* 생성/완료된 태스크 목록 */}
          {latestResult.completed_tasks && latestResult.completed_tasks.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2 flex items-center justify-between">
                <span>공정별 산출물 ({latestResult.completed_tasks.length}건)</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">클릭하여 4단계 원장 상세 보기</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
                {latestResult.completed_tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectDeliverable?.(task)}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-sky-500/60 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono text-slate-500 dark:text-slate-400">{task.id}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60">
                        {task.status}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors line-clamp-1">
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span className="line-clamp-1">담당: {task.assignee}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-sky-500 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🏆 CEO 업무 완수 종합 보고서 인터랙티브 모달 */}
      {showResultModal && latestResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl ring-1 ring-slate-200 dark:ring-slate-500/30 overflow-hidden transition-colors">
            {/* 모달 헤더 */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between bg-slate-50 dark:bg-slate-950/80">
              <div className="flex-1 pr-3">
                <div className="flex items-center flex-wrap gap-2 mb-1.5">
                  <span className="font-mono text-xs text-sky-600 dark:text-sky-400 font-bold bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-800/60">
                    지시: {latestResult.command_id}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    상태: {latestResult.status === 'SUCCESS' ? '전 공정 검증 종결 (CLOSED)' : latestResult.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    프로젝트: {latestResult.project_id}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug flex items-center gap-2">
                  <span>🏆 CEO 업무 지시 완수 종합 보고서</span>
                </h3>
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 🧭 결과물 확인 위치 3대 경로 가이드 배너 (CEO 질문 직접 해결) */}
            <div className="px-5 py-3.5 bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-800 text-xs">
              <div className="flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="text-sky-900 dark:text-sky-300 font-bold block mb-1">
                    📌 결과물은 어디서 어떻게 확인하나요? (3대 열람 경로)
                  </strong>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-800 dark:text-slate-200 mt-1.5">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800">
                      <strong className="text-purple-700 dark:text-purple-400 block mb-0.5 font-bold">1. 특허·지식 원장 (4대 장부)</strong>
                      <span>특허 조사 지시 시 <code className="font-mono text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-1 rounded">KNOWLEDGE_PATENT</code>에 FTO 리스크 및 회피 청구항 보고서 전문이 영구 보존됩니다.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800">
                      <strong className="text-indigo-700 dark:text-indigo-400 block mb-0.5 font-bold">2. 5단계 칸반 보드</strong>
                      <span>하단 산출물 카드나 [칸반 보드] 탭에서 <code className="font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-1 rounded">PatentSearchAgent</code> 카드를 클릭하면 4단계 심층 데이터가 열립니다.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800">
                      <strong className="text-emerald-700 dark:text-emerald-400 block mb-0.5 font-bold">3. 본 완수 보고서 브리핑</strong>
                      <span>COO의 전사 품질검수(Quality Gate) 승인 결과 및 5대 공정 산출물 요약을 즉시 확인합니다.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 모달 본문 정보 스크롤 영역 (하단 pb-14로 잘림 방지 및 여백 확보) */}
            <div className="p-5 pb-14 flex-1 overflow-y-auto space-y-5 text-xs">
              {/* 1. 총괄 요약 브리핑 */}
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border-2 border-slate-300 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs sm:text-sm">
                    <Terminal className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    총괄 수행 요약 (COO 브리핑)
                  </span>
                  <button
                    onClick={() => handleCopyResult(latestResult.summary || '')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium transition-colors border border-slate-300 dark:border-slate-700"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">복사됨!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>요약 복사</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap text-safe-render">
                  {latestResult.summary || '전 공정 검증 완료 및 4대 장부 최종 마감되었습니다.'}
                </div>
              </div>

              {/* 2. COO 최종 품질검수 감사 결과 */}
              {latestResult.coo_audit && (
                <div className="bg-indigo-50/70 dark:bg-slate-950/90 rounded-xl p-4 border-2 border-indigo-200 dark:border-indigo-900/80 shadow-sm">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">COO 전사 최종 품질 종합검수 (Quality Gate) 감사 리포트</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        latestResult.coo_audit.approved
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                      }`}
                    >
                      {latestResult.coo_audit.approved ? '최종 마감 승인 (CLOSED)' : '재검토 권고 (REVISION)'}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 mb-3 leading-relaxed text-safe-render">
                    {latestResult.coo_audit.executive_summary}
                  </p>
                  {latestResult.coo_audit.checked_items && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3 bg-white dark:bg-slate-900 p-2.5 rounded-lg border-2 border-indigo-100 dark:border-slate-800">
                      {latestResult.coo_audit.checked_items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-slate-800 dark:text-slate-200 truncate font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {latestResult.coo_audit.directive_feedback && (
                    <div className="text-[11px] text-indigo-900 dark:text-indigo-300 italic bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-indigo-200 dark:border-slate-800/80 leading-relaxed text-safe-render">
                      &bull; COO 총평: {latestResult.coo_audit.directive_feedback}
                    </div>
                  )}
                </div>
              )}

              {/* 3. 생성된 세부 공정별 산출물 태스크 목록 (고대비 2px 보더 및 텍스트 잘림 방지) */}
              {latestResult.completed_tasks && latestResult.completed_tasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs sm:text-sm">
                      <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      공정별 개별 산출물 ({latestResult.completed_tasks.length}건)
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">카드를 클릭하면 상세 원장 팝업이 열립니다</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {latestResult.completed_tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => {
                          setShowResultModal(false);
                          onSelectDeliverable?.(task);
                        }}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800/90 transition-all cursor-pointer group shadow-sm text-safe-render"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs text-sky-700 dark:text-sky-400 font-bold">{task.id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                            {task.status}
                          </span>
                        </div>
                        <h5 className="font-bold text-slate-900 dark:text-white text-xs mb-1.5 group-hover:text-sky-600 dark:group-hover:text-sky-300 line-clamp-1">
                          {task.title}
                        </h5>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed mb-2.5 text-safe-render line-clamp-2">
                          {task.deliverable || '산출물이 원장에 동기화되었습니다.'}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400">
                          <span>담당: <strong className="text-slate-900 dark:text-slate-200 font-bold">{task.assignee}</strong></span>
                          <span className="text-sky-700 dark:text-sky-400 font-semibold flex items-center gap-0.5 group-hover:underline">
                            <span>4단계 원장 보기</span>
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 모달 하단 액션 바 (고대비 2px 보더 및 뚜렷한 배경) */}
            <div className="p-4 border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/95 flex flex-wrap items-center justify-between gap-2 shadow-inner">
              <div className="flex items-center gap-2">
                {onNavigateTab && (
                  <>
                    <button
                      onClick={() => {
                        setShowResultModal(false);
                        onNavigateTab('ledgers');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 text-white-force shadow-sm border border-emerald-500"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>🏛️ 4대 장부(특허 원장) 바로 열람</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowResultModal(false);
                        onNavigateTab('kanban');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 text-white-force shadow-sm border border-indigo-500"
                    >
                      <Kanban className="w-3.5 h-3.5" />
                      <span>📊 5단계 칸반 보드 이동</span>
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                className="px-5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs transition-colors border border-slate-300 dark:border-slate-600"
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
